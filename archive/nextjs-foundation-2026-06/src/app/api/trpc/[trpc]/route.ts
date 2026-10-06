// src/app/api/trpc/[trpc]/route.ts
// Next.js App Router handler for all tRPC requests.

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/root'
import { createContext } from '@/server/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(`[tRPC] Error on /${path}:`, error)
          }
        : undefined,
  })

export { handler as GET, handler as POST }
