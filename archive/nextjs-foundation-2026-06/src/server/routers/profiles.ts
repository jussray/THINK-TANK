// src/server/routers/profiles.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc'

export const profilesRouter = createTRPCRouter({

  // Get own profile
  getOwn: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.db
      .from('profiles')
      .select('*')
      .eq('id', ctx.userId)
      .single()
    return data
  }),

  // Update own profile
  update: protectedProcedure
    .input(z.object({
      displayName: z.string().optional(),
      bio: z.string().optional(),
      domainTags: z.array(z.string()).optional(),
      founderMode: z.enum(['dreamer','builder','investor','team_builder']).optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.db
        .from('profiles')
        .update({
          ...(input.displayName !== undefined && { display_name: input.displayName }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.domainTags !== undefined && { domain_tags: input.domainTags }),
          ...(input.founderMode !== undefined && { founder_mode: input.founderMode }),
          ...(input.isPublic !== undefined && { is_public: input.isPublic }),
        })
        .eq('id', ctx.userId)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      return data
    }),

  // Get public profile by id
  getPublic: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.db
        .from('profiles')
        .select('id, display_name, bio, domain_tags, avatar_url, is_public, reputation_score')
        .eq('id', input.userId)
        .eq('is_public', true)
        .single()
      if (!data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),
})
