// src/server/routers/modules.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc'
import type { ModuleType } from '@/types/modules'

export const modulesRouter = createTRPCRouter({

  // ── Get all modules for an idea ───────────────────────────────────────────
  getAll: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('modules')
        .select('*')
        .eq('idea_id', input.ideaId)
        .order('module_type')

      return data ?? []
    }),

  // ── Get a specific module ─────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
      moduleType: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('modules')
        .select('*')
        .eq('idea_id', input.ideaId)
        .eq('module_type', input.moduleType)
        .single()

      if (!data) throw new TRPCError({ code: 'NOT_FOUND' })

      return data
    }),

  // ── Founder edits a module directly ──────────────────────────────────────
  updateContent: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
      moduleType: z.string(),
      contentJson: z.record(z.unknown()),  // validated at application layer per module type
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify idea ownership
      const { data: idea } = await ctx.db
        .from('ideas')
        .select('id')
        .eq('id', input.ideaId)
        .eq('owner_id', ctx.userId)
        .single()

      if (!idea) throw new TRPCError({ code: 'FORBIDDEN' })

      const { data, error } = await ctx.db
        .from('modules')
        .update({
          content_json: input.contentJson,
          last_edited_at: new Date().toISOString(),
          edit_source: 'user',
          generation_status: 'complete',
        })
        .eq('idea_id', input.ideaId)
        .eq('module_type', input.moduleType)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

      return data
    }),

  // ── Poll generation status for all modules ────────────────────────────────
  pollStatus: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('modules')
        .select('module_type, generation_status, generated_at')
        .eq('idea_id', input.ideaId)

      const statusMap: Record<string, { status: string; generatedAt: string | null }> = {}

      for (const row of (data ?? [])) {
        statusMap[row.module_type as ModuleType] = {
          status: row.generation_status,
          generatedAt: row.generated_at,
        }
      }

      const allComplete = Object.values(statusMap).every(s => s.status === 'complete')
      const anyGenerating = Object.values(statusMap).some(s => s.status === 'generating')

      return { statusMap, allComplete, anyGenerating }
    }),
})
