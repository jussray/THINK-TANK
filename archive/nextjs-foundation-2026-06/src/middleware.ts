// src/middleware.ts
// Clerk middleware: protects /dashboard, /ideas, /onboarding.
// Public routes: /, /sign-in, /sign-up, /api/webhooks, public idea pages.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/ideas/public(.*)',          // public idea pages (no auth)
  '/api/webhooks(.*)',          // Clerk webhooks
  '/api/trpc(.*)',              // tRPC — auth checked per-procedure
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
