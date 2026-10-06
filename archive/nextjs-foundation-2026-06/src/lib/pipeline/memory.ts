// src/lib/pipeline/memory.ts
// Upserts ai_memory_threads after each session.
// Generates embeddings for RAG retrieval by Interview Agent next session.

import { createClient } from '@supabase/supabase-js'
import { claude, embed, MODELS, heliconeTag } from '@/lib/ai/client'
import type { ConceptMap } from '@/types/modules'
import type { SynthesisOutput } from '@/lib/agents/synthesis'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface MemoryUpdateInput {
  ideaId: string
  userId: string
  transcript: string
  conceptMap: ConceptMap
  synthesisOutput: SynthesisOutput
  sessionNumber: number
}

// ─── Idea Context Thread ──────────────────────────────────────────────────────
// Per-idea, all sessions rolled up. Used by Interview Agent as RAG context.

async function buildIdeaContextSummary(input: MemoryUpdateInput): Promise<string> {
  const prompt = `
Summarize this interview session for long-term memory storage.
This summary will be retrieved by the AI in future sessions to understand what has already been covered.

Session number: ${input.sessionNumber}
Concept map completeness: ${(input.conceptMap.overall_completeness * 100).toFixed(0)}%

Key concept map values:
${Object.entries(input.conceptMap)
  .filter(([k]) => k !== 'overall_completeness')
  .map(([k, v]) => `${k}: ${(v as { value: string; confidence: number }).value || '(not yet defined)'}`)
  .join('\n')}

Generated modules summary:
- One-liner: ${input.synthesisOutput.summary.content.one_liner}
- Problem: ${input.synthesisOutput.problem.content.problem_statement}
- Customer: ${input.synthesisOutput.customer.content.primary_segment}

Write a dense 3–5 paragraph summary capturing what is known, what was inferred, and what remains unclear.
Do not use bullet points. Write as if briefing the AI for the next session.`

  const response = await claude.messages.create(
    {
      model: MODELS.interview,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(input.ideaId, 'memory-summarizer')
  )

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── Founder Profile Thread ───────────────────────────────────────────────────
// Per-founder, cross-idea patterns. Used by Coach Agent.

async function buildFounderProfileUpdate(
  userId: string,
  ideaId: string,
  transcript: string,
  existingProfile: string | null
): Promise<string> {
  const prompt = `
You are updating a founder's long-term profile based on a new interview session.

Existing profile (may be empty for new founders):
${existingProfile ?? '(No profile yet — this is the first session)'}

New session transcript excerpt (last 2000 chars):
${transcript.slice(-2000)}

Update the founder profile to capture:
- Communication style (verbose/concise, technical/non-technical, confident/uncertain)
- Recurring themes or concerns across sessions
- Stated goals and timeline expectations
- Patterns in how they respond to probing questions
- Any personal motivation signals ("I've seen this problem myself", "I worked in this industry")

Write as a dense paragraph. Do not use bullet points. Preserve useful information from the existing profile.`

  const response = await claude.messages.create(
    {
      model: MODELS.coach,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    },
    heliconeTag(ideaId, 'founder-profile-updater')
  )

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function updateMemoryThreads(input: MemoryUpdateInput): Promise<void> {
  const db = getServiceClient()

  // Fetch existing founder profile for update (cross-idea — queried by user only)
  const { data: existingFounderThread } = await db
    .from('ai_memory_threads')
    .select('raw_content')
    .eq('user_id', input.userId)
    .eq('thread_type', 'founder_profile')
    .is('idea_id', null)
    .single()

  // Build both summaries in parallel
  const [ideaContextSummary, founderProfileUpdate] = await Promise.all([
    buildIdeaContextSummary(input),
    buildFounderProfileUpdate(
      input.userId,
      input.ideaId,
      input.transcript,
      existingFounderThread?.raw_content ?? null
    ),
  ])

  // Generate embeddings for both
  const [ideaEmbedding, founderEmbedding] = await Promise.all([
    embed(ideaContextSummary),
    embed(founderProfileUpdate),
  ])

  // Upsert idea_context thread
  await db.from('ai_memory_threads').upsert(
    {
      idea_id: input.ideaId,
      user_id: input.userId,
      thread_type: 'idea_context',
      raw_content: ideaContextSummary,
      content_embedding: ideaEmbedding,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'idea_id,user_id,thread_type' }
  )

  // Upsert session_summary thread (one per session — uses composite unique)
  // We store session summaries separately so they can be retrieved individually
  const sessionSummary = `Session ${input.sessionNumber}: ${ideaContextSummary.slice(0, 500)}`
  const sessionEmbedding = await embed(sessionSummary)

  await db.from('ai_memory_threads').upsert(
    {
      idea_id: input.ideaId,
      user_id: input.userId,
      thread_type: 'session_summary',
      raw_content: sessionSummary,
      content_embedding: sessionEmbedding,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'idea_id,user_id,thread_type' }
  )

  // Upsert founder_profile thread (idea_id = NULL — cross-idea)
  await db.from('ai_memory_threads').upsert(
    {
      idea_id: null,
      user_id: input.userId,
      thread_type: 'founder_profile',
      raw_content: founderProfileUpdate,
      content_embedding: founderEmbedding,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'idea_id,user_id,thread_type' }
  )
}

// ─── Memory Retrieval ─────────────────────────────────────────────────────────
// Called by Interview Agent context builder at session start.

export async function retrieveIdeaContext(
  ideaId: string,
  userId: string,
  queryText: string
): Promise<string | null> {
  const db = getServiceClient()
  const queryEmbedding = await embed(queryText)

  const { data } = await db.rpc('search_memory', {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_idea_id: ideaId,
    match_type: 'idea_context',
    match_count: 3,
  })

  if (!data || data.length === 0) return null

  return data.map((r: { raw_content: string }) => r.raw_content).join('\n\n---\n\n')
}

export async function retrieveFounderProfile(userId: string): Promise<string | null> {
  const db = getServiceClient()

  const { data } = await db
    .from('ai_memory_threads')
    .select('raw_content')
    .eq('user_id', userId)
    .eq('thread_type', 'founder_profile')
    .is('idea_id', null)
    .single()

  return data?.raw_content ?? null
}
