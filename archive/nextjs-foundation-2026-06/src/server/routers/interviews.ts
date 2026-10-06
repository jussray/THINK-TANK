// src/server/routers/interviews.ts
// tRPC router for interview session management.
// Streaming handled separately via /api/interview/stream route (Next.js route handler).

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import { retrieveIdeaContext, retrieveFounderProfile } from '@/lib/pipeline/memory'
import { emptyConceptMap, buildInterviewSystemPrompt, updateConceptMap, isSessionReadyToEnd } from '@/lib/agents/interview'
import { runPostSession } from '@/lib/pipeline/post-session'
import type { InterviewMode, ModuleType, ConceptMap } from '@/types/modules'

export const interviewsRouter = createTRPCRouter({

  // ── Start a new session ────────────────────────────────────────────────────
  startSession: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
      mode: z.enum(['initial','module_refine','pivot','checkin','discovery']).default('initial'),
      targetModule: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify idea belongs to this user
      const { data: idea } = await ctx.db
        .from('ideas')
        .select('id, owner_id')
        .eq('id', input.ideaId)
        .eq('owner_id', ctx.userId)
        .single()

      if (!idea) throw new TRPCError({ code: 'NOT_FOUND', message: 'Idea not found' })

      // Get next session number
      const { data: lastSession } = await ctx.db
        .from('interviews')
        .select('session_number')
        .eq('idea_id', input.ideaId)
        .order('session_number', { ascending: false })
        .limit(1)
        .single()

      const sessionNumber = (lastSession?.session_number ?? 0) + 1

      // Create session row with empty concept map
      const { data: session, error } = await ctx.db
        .from('interviews')
        .insert({
          idea_id: input.ideaId,
          user_id: ctx.userId,
          session_number: sessionNumber,
          interview_mode: input.mode,
          target_module: input.targetModule ?? null,
          concept_map: emptyConceptMap(),
        })
        .select()
        .single()

      if (error || !session) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create session' })
      }

      // Pre-fetch memory context for Interview Agent (done async — streamed into first turn)
      const [ideaContext, founderContext] = await Promise.all([
        retrieveIdeaContext(input.ideaId, ctx.userId, `Session ${sessionNumber} context`),
        retrieveFounderProfile(ctx.userId),
      ])

      // Build and cache system prompt for this session
      const systemPrompt = buildInterviewSystemPrompt({
        ideaContext,
        founderContext,
        conceptMap: session.concept_map as ConceptMap,
        mode: input.mode as InterviewMode,
        targetModule: (input.targetModule ?? null) as ModuleType | null,
        sessionNumber,
      })

      // Store system prompt as first message (role: system)
      await ctx.db.from('interview_messages').insert({
        interview_id: session.id,
        role: 'system',
        content: systemPrompt,
        agent_persona: 'interview',
      })

      return {
        sessionId: session.id,
        sessionNumber,
        mode: input.mode,
      }
    }),

  // ── End a session + trigger post-session pipeline ─────────────────────────
  endSession: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: session } = await ctx.db
        .from('interviews')
        .select('*, ideas!inner(owner_id)')
        .eq('id', input.sessionId)
        .single()

      if (!session) throw new TRPCError({ code: 'NOT_FOUND' })
      if ((session.ideas as { owner_id: string }).owner_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      // Compute depth score from concept map
      const map = session.concept_map as ConceptMap
      const depthScore = map.overall_completeness

      // Mark session as ended
      await ctx.db
        .from('interviews')
        .update({
          ended_at: new Date().toISOString(),
          depth_score: depthScore,
        })
        .eq('id', input.sessionId)

      // Trigger post-session pipeline (fire-and-forget in MVP)
      // In production: use Inngest for reliable async execution
      runPostSession({
        interviewId: input.sessionId,
        ideaId: session.idea_id,
        userId: ctx.userId,
        sessionNumber: session.session_number,
        depthScore,
        conceptMap: map,
      }).catch(err => {
        console.error('[endSession] Post-session pipeline failed:', err)
      })

      return {
        depthScore,
        readyForGeneration: depthScore >= 0.5,
        sessionComplete: depthScore >= 0.75,
      }
    }),

  // ── Flag a message as a key insight ───────────────────────────────────────
  flagInsight: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      flagged: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .from('interview_messages')
        .update({ flagged_as_insight: input.flagged })
        .eq('id', input.messageId)

      return { success: true }
    }),

  // ── Get message history for a session ─────────────────────────────────────
  getHistory: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { data: messages } = await ctx.db
        .from('interview_messages')
        .select('*')
        .eq('interview_id', input.sessionId)
        .neq('role', 'system')  // never expose system prompt to client
        .order('created_at', { ascending: true })

      return messages ?? []
    }),

  // ── Get all sessions for an idea ──────────────────────────────────────────
  listSessions: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { data: sessions } = await ctx.db
        .from('interviews')
        .select('id, session_number, interview_mode, depth_score, started_at, ended_at')
        .eq('idea_id', input.ideaId)
        .order('session_number', { ascending: false })

      return sessions ?? []
    }),
})
