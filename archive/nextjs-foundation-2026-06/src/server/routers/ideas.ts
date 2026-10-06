// src/server/routers/ideas.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc'

export const ideasRouter = createTRPCRouter({

  // ── Create a new idea ─────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200).default('Untitled Idea'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: idea, error } = await ctx.db
        .from('ideas')
        .insert({
          owner_id: ctx.userId,
          title: input.title,
        })
        .select()
        .single()

      if (error || !idea) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create idea: ${error?.message}`,
        })
      }

      // Modules are scaffolded automatically by DB trigger (004_modules.sql)
      // Ledger genesis entry created by DB trigger (006_ownership_ledger.sql)

      return idea
    }),

  // ── Get a single idea with all modules ───────────────────────────────────
  get: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: idea } = await ctx.db
        .from('ideas')
        .select(`
          *,
          modules (
            id, module_type, content_json, generation_status,
            generated_at, last_edited_at, edit_source, confidence_map
          )
        `)
        .eq('id', input.ideaId)
        .eq('owner_id', ctx.userId)
        .single()

      if (!idea) throw new TRPCError({ code: 'NOT_FOUND' })

      return idea
    }),

  // ── Get a public idea by slug (no auth required) ──────────────────────────
  getPublic: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data: idea } = await ctx.db
        .from('ideas')
        .select(`
          id, title, slug, stage, created_at,
          modules (module_type, content_json, generation_status)
        `)
        .eq('slug', input.slug)
        .in('privacy_status', ['public','listed'])
        .eq('vault_flag', false)
        .single()

      if (!idea) throw new TRPCError({ code: 'NOT_FOUND' })

      return idea
    }),

  // ── List all ideas for current user ──────────────────────────────────────
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const { data: ideas } = await ctx.db
        .from('ideas')
        .select(`
          id, title, slug, stage, privacy_status, vault_flag, updated_at,
          modules!inner (module_type, content_json, generation_status)
        `)
        .eq('owner_id', ctx.userId)
        .eq('modules.module_type', 'summary')
        .order('updated_at', { ascending: false })

      return ideas ?? []
    }),

  // ── Update privacy status ─────────────────────────────────────────────────
  updatePrivacy: protectedProcedure
    .input(z.object({
      ideaId: z.string().uuid(),
      privacyStatus: z.enum(['private','public','listed']),
      vaultFlag: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // If moving to vault, must be private
      if (input.vaultFlag && input.privacyStatus !== 'private') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Vault ideas must be private',
        })
      }

      const { data, error } = await ctx.db
        .from('ideas')
        .update({
          privacy_status: input.privacyStatus,
          ...(input.vaultFlag !== undefined && { vault_flag: input.vaultFlag }),
        })
        .eq('id', input.ideaId)
        .eq('owner_id', ctx.userId)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

      return data
    }),

  // ── Get version history ───────────────────────────────────────────────────
  getVersions: protectedProcedure
    .input(z.object({ ideaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('idea_versions')
        .select('id, version_number, change_summary, created_at, hash_fingerprint')
        .eq('idea_id', input.ideaId)
        .order('version_number', { ascending: false })

      return data ?? []
    }),
})
