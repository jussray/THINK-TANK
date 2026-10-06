// src/server/root.ts
import { createTRPCRouter } from '@/server/trpc'
import { ideasRouter } from '@/server/routers/ideas'
import { interviewsRouter } from '@/server/routers/interviews'
import { modulesRouter } from '@/server/routers/modules'
import { profilesRouter } from '@/server/routers/profiles'
import { pivotRouter } from '@/server/routers/pivot'

export const appRouter = createTRPCRouter({
  ideas: ideasRouter,
  interviews: interviewsRouter,
  modules: modulesRouter,
  profiles: profilesRouter,
  pivot: pivotRouter,
})

export type AppRouter = typeof appRouter
