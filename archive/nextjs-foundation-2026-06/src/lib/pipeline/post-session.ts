// src/lib/pipeline/post-session.ts
// Orchestrates all agent runs after an interview session ends.
// Runs asynchronously — founder never waits for this.
// All future agents plug in here as additional steps.

import { createClient } from '@supabase/supabase-js'
import { runSynthesisAgent } from '@/lib/agents/synthesis'
import { runCriticAgent, runScorerAgent } from '@/lib/agents/critic'
import { updateMemoryThreads } from '@/lib/pipeline/memory'
import { snapshotVersion } from '@/lib/pipeline/versioning'
import { embed } from '@/lib/ai/client'
import type { InterviewMessage, ConceptMap, Module } from '@/types/modules'

// Service-role client for pipeline operations (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface PostSessionInput {
  interviewId: string
  ideaId: string
  userId: string
  sessionNumber: number
  depthScore: number
  conceptMap: ConceptMap
}

export async function runPostSession(input: PostSessionInput): Promise<void> {
  const db = getServiceClient()
  const { interviewId, ideaId, userId, sessionNumber, depthScore, conceptMap } = input

  console.log(`[Pipeline] Starting post-session for interview ${interviewId}`)

  try {
    // ── Step 1: Load full transcript ──────────────────────────────────────────
    const { data: messages } = await db
      .from('interview_messages')
      .select('role, content, agent_persona')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true })

    const transcript = (messages ?? [])
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`)
      .join('\n\n')

    // ── Step 2: Mark core modules as 'generating' ─────────────────────────────
    await db
      .from('modules')
      .update({ generation_status: 'generating' })
      .eq('idea_id', ideaId)
      .in('module_type', ['summary', 'problem', 'solution', 'customer', 'scorecard'])

    // ── Step 3: Synthesis Agent ───────────────────────────────────────────────
    const synthesisOutput = await runSynthesisAgent({
      ideaId,
      transcript,
      conceptMap,
      sessionNumber,
    })

    // Write core modules
    for (const [moduleType, { content, confidence_map }] of Object.entries(synthesisOutput)) {
      await db.from('modules').upsert(
        {
          idea_id: ideaId,
          module_type: moduleType,
          content_json: content,
          confidence_map,
          generation_status: 'complete',
          generated_at: new Date().toISOString(),
          edit_source: 'ai',
        },
        { onConflict: 'idea_id,module_type' }
      )
    }

    // ── Step 4: Critic + Scorer in parallel ───────────────────────────────────
    const [concerns, _] = await Promise.all([
      runCriticAgent(synthesisOutput, ideaId),
      Promise.resolve(null), // placeholder for future parallel agent
    ])

    const scorecard = await runScorerAgent(synthesisOutput, concerns, ideaId, sessionNumber)

    await db.from('modules').upsert(
      {
        idea_id: ideaId,
        module_type: 'scorecard',
        content_json: scorecard,
        generation_status: 'complete',
        generated_at: new Date().toISOString(),
        edit_source: 'ai',
      },
      { onConflict: 'idea_id,module_type' }
    )

    // ── Step 5: Update AI memory ──────────────────────────────────────────────
    await updateMemoryThreads({
      ideaId,
      userId,
      transcript,
      conceptMap,
      synthesisOutput,
      sessionNumber,
    })

    // ── Step 6: Version snapshot if depth is meaningful ───────────────────────
    if (depthScore >= 0.5) {
      await snapshotVersion(ideaId, `Session ${sessionNumber} complete — depth ${(depthScore * 100).toFixed(0)}%`)
    }

    // ── Step 7: Trigger Researcher Agent if market score is low ──────────────
    const marketScore = scorecard.market?.score ?? 10
    if (marketScore < 6) {
      // Enqueue async — does not block pipeline completion
      // In production: use Inngest event: inngest.send('researcher/run', { ideaId })
      console.log(`[Pipeline] Market score ${marketScore} < 6 — Researcher Agent queued for idea ${ideaId}`)
      // TODO: wire Inngest here in Sprint 3
    }

    // ── Step 8: Notify founder ────────────────────────────────────────────────
    // In production: use Supabase Realtime or Resend
    // For now: update a notifications table (V2 feature — log only)
    console.log(`[Pipeline] Post-session complete for idea ${ideaId}, session ${sessionNumber}`)

  } catch (err) {
    console.error(`[Pipeline] Error in post-session for interview ${interviewId}:`, err)

    // Graceful degradation: mark failed modules as 'draft' not 'error'
    // so founder can still see the workspace
    await db
      .from('modules')
      .update({ generation_status: 'draft' })
      .eq('idea_id', ideaId)
      .eq('generation_status', 'generating')

    throw err  // re-throw so the caller can log it
  }
}
