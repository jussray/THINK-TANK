// src/server/routers/pivot.ts
// Pivot Mode router.
// generateDirections — snapshot current state, run pivot agent, return 3 directions
// startExploration   — create pivot interview session for a specific direction
// commitPivot        — overwrite modules with branch content, preserve original in versions
// abandonBranch      — mark branch as abandoned (original idea untouched)
// listBranches       — all pivot branches for an idea

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import { generatePivotDirections } from '@/lib/agents/pivot'
import { snapshotVersion } from '@/lib/pipeline/versioning'
import type {
  SummaryContent,
  ProblemContent,
  SolutionContent,
  CustomerContent,
  ScorecardContent,
} from '@/types/modules'

export const pivotRouter = createTRPCRouter({

  // ── Generate pivot directions ──────────────────────────────────────────────
  // Called when founder enters Pivot Mode.
  // 1. Snapshot the current idea state (preservation)
  // 2. Load all modules
  // 3. Run Pivot Agent → 3 directions
  // 4. Write pivot_branches rows (status: proposed)
  // Returns the three directions with their branch IDs.

  generateDirections: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
      founderDoubt: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const { data: idea } = await ctx.db
        .from('ideas')
        .select('id, owner_id')
        .eq('id', input.ideaId)
        .eq('owner_id', ctx.userId)
        .single()

      if (!idea) throw new TRPCError({ code: 'NOT_FOUND' })

      // Load required modules
      const { data: modules } = await ctx.db
        .from('modules')
        .select('module_type, content_json')
        .eq('idea_id', input.ideaId)
        .in('module_type', ['summary', 'problem', 'solution', 'customer', 'scorecard'])
        .eq('generation_status', 'complete')

      if (!modules || modules.length < 4) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'At least summary, problem, solution, and customer modules must be complete before entering Pivot Mode.',
        })
      }

      const moduleMap = Object.fromEntries(modules.map(m => [m.module_type, m.content_json]))

      // 1. Snapshot current state — this is the restoration point
      const prePivotVersionId = await snapshotVersion(
        input.ideaId,
        'Pre-pivot snapshot — entering Pivot Mode'
      )

      // 2. Generate pivot directions
      const directions = await generatePivotDirections(
        {
          summary:      moduleMap.summary as SummaryContent,
          problem:      moduleMap.problem as ProblemContent,
          solution:     moduleMap.solution as SolutionContent,
          customer:     moduleMap.customer as CustomerContent,
          scorecard:    moduleMap.scorecard as ScorecardContent,
          founderDoubt: input.founderDoubt,
        },
        input.ideaId
      )

      // 3. Write pivot_branches rows
      const { data: branches, error } = await ctx.db
        .from('pivot_branches')
        .insert(
          directions.map(d => ({
            idea_id: input.ideaId,
            user_id: ctx.userId,
            pre_pivot_version_id: prePivotVersionId,
            retained_component: d.retained_component,
            direction_label: d.direction_label,
            direction_summary: d.direction_summary,
            direction_rationale: d.direction_rationale,
            hypothesis: d.hypothesis,
            status: 'proposed',
          }))
        )
        .select()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return {
        prePivotVersionId,
        branches: branches ?? [],
      }
    }),

  // ── Start exploring a specific branch ─────────────────────────────────────
  // Creates a 'pivot' interview session seeded with the direction's hypothesis.
  // The interview agent's mode is 'pivot' with the direction baked into context.

  startExploration: protectedProcedure
    .input(z.object({
      branchId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: branch } = await ctx.db
        .from('pivot_branches')
        .select('*, ideas!inner(owner_id)')
        .eq('id', input.branchId)
        .single()

      if (!branch) throw new TRPCError({ code: 'NOT_FOUND' })
      if ((branch.ideas as { owner_id: string }).owner_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Get next session number for this idea
      const { data: lastSession } = await ctx.db
        .from('interviews')
        .select('session_number')
        .eq('idea_id', branch.idea_id)
        .order('session_number', { ascending: false })
        .limit(1)
        .single()

      const sessionNumber = (lastSession?.session_number ?? 0) + 1

      // Create pivot interview session
      const { data: session, error } = await ctx.db
        .from('interviews')
        .insert({
          idea_id: branch.idea_id,
          user_id: ctx.userId,
          session_number: sessionNumber,
          interview_mode: 'pivot',
          concept_map: {
            problem_clarity:       { value: branch.hypothesis, confidence: 0.3 },
            solution_specificity:  { value: '', confidence: 0 },
            customer_definition:   { value: '', confidence: 0 },
            revenue_hypothesis:    { value: '', confidence: 0 },
            market_awareness:      { value: '', confidence: 0 },
            competitive_awareness: { value: '', confidence: 0 },
            founder_motivation:    { value: '', confidence: 0 },
            execution_readiness:   { value: '', confidence: 0 },
            overall_completeness:  0.04,
          },
        })
        .select()
        .single()

      if (error || !session) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      }

      // Update branch status
      await ctx.db
        .from('pivot_branches')
        .update({ status: 'exploring', exploration_interview_id: session.id })
        .eq('id', input.branchId)

      // Seed system prompt for pivot session
      const systemPrompt = buildPivotSessionPrompt(branch)
      await ctx.db.from('interview_messages').insert({
        interview_id: session.id,
        role: 'system',
        content: systemPrompt,
        agent_persona: 'interview',
      })

      return { sessionId: session.id, sessionNumber }
    }),

  // ── Commit to a pivot direction ────────────────────────────────────────────
  // Marks a branch as committed.
  // The post-session pipeline (already wired) regenerates modules from the
  // pivot interview — no special handling needed here beyond status updates.

  commitPivot: protectedProcedure
    .input(z.object({
      branchId: z.string().uuid(),
      sessionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: branch } = await ctx.db
        .from('pivot_branches')
        .select('*, ideas!inner(owner_id)')
        .eq('id', input.branchId)
        .single()

      if (!branch) throw new TRPCError({ code: 'NOT_FOUND' })
      if ((branch.ideas as { owner_id: string }).owner_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Snapshot the committed pivot state
      const committedVersionId = await snapshotVersion(
        branch.idea_id,
        `Pivot committed: ${branch.direction_label}`
      )

      // Mark branch committed, abandon others
      await ctx.db
        .from('pivot_branches')
        .update({ status: 'abandoned' })
        .eq('idea_id', branch.idea_id)
        .neq('id', input.branchId)
        .eq('status', 'proposed')

      await ctx.db
        .from('pivot_branches')
        .update({
          status: 'committed',
          committed_at: new Date().toISOString(),
          committed_version_id: committedVersionId,
        })
        .eq('id', input.branchId)

      return { committedVersionId }
    }),

  // ── Abandon a branch ───────────────────────────────────────────────────────
  abandonBranch: protectedProcedure
    .input(z.object({ branchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('pivot_branches')
        .update({ status: 'abandoned' })
        .eq('id', input.branchId)
        .eq('user_id', ctx.userId)

      return { success: true }
    }),

  // ── List all branches for an idea ──────────────────────────────────────────
  listBranches: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('pivot_branches')
        .select('*')
        .eq('idea_id', input.ideaId)
        .order('created_at', { ascending: false })

      return data ?? []
    }),

  // ── Get a single branch ────────────────────────────────────────────────────
  getBranch: protectedProcedure
    .input(z.object({ branchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('pivot_branches')
        .select('*')
        .eq('id', input.branchId)
        .eq('user_id', ctx.userId)
        .single()

      if (!data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),
})

// ─── Pivot session system prompt builder ──────────────────────────────────────

function buildPivotSessionPrompt(branch: {
  direction_label: string
  direction_summary: string
  direction_rationale: string
  hypothesis: string
  retained_component: string
}): string {
  return `You are the Think Tank Pivot Strategist.

The founder is exploring a specific pivot direction. Your job is to help them think through
whether this direction is viable — through questions, not advice.

Pivot direction being explored:
- Label: ${branch.direction_label}
- Summary: ${branch.direction_summary}
- What's retained: ${branch.retained_component} — ${branch.direction_rationale}
- Core hypothesis: ${branch.hypothesis}

Rules:
- Ask exactly ONE question per turn.
- Focus entirely on this direction — do not compare to the original idea.
- Probe the hypothesis: what evidence exists? Who would be the first customer? What changes about the business model?
- After 4–5 turns, signal: "I have enough to generate a scorecard for this direction."
- Never validate prematurely. Never say "great."
- Keep questions specific to this direction's hypothesis.

Start by asking what initially made the founder interested in THIS direction specifically.`
}
