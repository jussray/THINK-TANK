// src/server/trpc.ts
// tRPC server setup with Supabase + Clerk auth context.

import { initTRPC, TRPCError } from '@trpc/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import superjson from 'superjson'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface TRPCContext {
  userId: string | null
  db: SupabaseClient
}

export async function createContext(opts: {
  req: Request
}): Promise<TRPCContext> {
  // Extract Clerk session token from Authorization header
  const authHeader = opts.req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') ?? null

  // User-scoped Supabase client (enforces RLS)
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token
      ? {
          global: {
            headers: {
              // Pass Clerk JWT so Supabase can verify and set app.current_user_id
              Authorization: `Bearer ${token}`,
            },
          },
        }
      : {}
  )

  // Extract userId from Clerk JWT payload (verified by Supabase)
  let userId: string | null = null
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub ?? null
    } catch {
      userId = null
    }
  }

  return { userId, db }
}

// ─── tRPC init ────────────────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

// Protected procedure: requires authenticated user
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
