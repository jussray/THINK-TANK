// Working candidate, not wired into the recovered June application.
// Replaces unverified JWT payload decoding with signature verification.
import { initTRPC, TRPCError } from '@trpc/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import superjson from 'superjson'
import { verifyBearerIdentity } from '../auth/verified-identity'

export interface TRPCContext {
  userId: string | null
  db: SupabaseClient
}

export async function createContext(opts: { req: Request }): Promise<TRPCContext> {
  const identity = await verifyBearerIdentity(opts.req.headers.get('Authorization'), {
    issuer: process.env.CLERK_JWT_ISSUER ?? '',
    audience: process.env.CLERK_JWT_AUDIENCE ?? '',
    jwksUrl: process.env.CLERK_JWKS_URL ?? '',
  })
  // Token must be independently accepted by Supabase's JWT/RLS integration.
  // Verification here does not establish that Supabase RLS policies are correct.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    identity ? { global: { headers: { Authorization: `Bearer ${identity.token}` } } } : {}
  )
  return { userId: identity?.userId ?? null, db }
}

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson })
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
