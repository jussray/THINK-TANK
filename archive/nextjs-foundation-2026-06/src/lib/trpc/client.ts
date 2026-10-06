// src/lib/trpc/client.ts
// Browser-side tRPC client.
// All authenticated requests attach the Clerk session token automatically.

import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/root'

export const trpc = createTRPCReact<AppRouter>()
