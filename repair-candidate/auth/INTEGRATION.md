# Auth candidate integration contract

This is a reviewable candidate, NOT a production fix. The historical June archive is unchanged.

## Preconditions
- No `jose` dependency. `verified-identity.ts` uses the dependency-free RS256 verifier in `jwt-rs256.ts` (node:crypto), so its tests need no install.
- Obtain Clerk's actual JWT template issuer, audience, JWKS endpoint, and signing algorithm from trusted provider configuration. The candidate currently accepts RS256 only; verify the template actually uses RS256.
- VERIFIED (clerk.com/docs/guides/sessions/session-tokens): default Clerk session tokens carry no `aud` claim. The audience check therefore rejects default session tokens, and sign-in fails closed for every real user until a Clerk JWT template sets `aud` to `CLERK_JWT_AUDIENCE`. Do not weaken the audience check to get past this.
- Creating a Clerk JWT template **does not automatically change the default session token**. Clerk documents JWT templates as separately generated custom JWTs, while the regular session-token claims are configured under Sessions. Before treating a configured `aud` as a solution, inspect the application's actual `getToken()` / session-token acquisition path, determine which token the API and Supabase receive, and prove the issuer, audience, signature, expiration, and RLS mapping with a real test session. If using a template, request the intended template token explicitly and prove the complete consumer path; do not silently switch to `azp` as a substitute audience. Sources: https://clerk.com/docs/guides/sessions/jwt-templates and https://clerk.com/docs/guides/sessions/customize-session-tokens.
- Restrict the JWKS URL to a trusted configured endpoint, not user input. Review token key rotation and network-failure behavior.
- Confirm how Supabase validates the Clerk token and maps verified `sub` to RLS identity. Do not assume a verified app identity automatically establishes Supabase RLS claims.

## Wiring
- Done in the candidate: `repair-candidate/server/trpc.ts` and `repair-candidate/api/interview/stream/route.ts` derive identity only from `verifyBearerIdentity`. The `atob` sites exist only in the immutable archive (`archive/nextjs-foundation-2026-06/src/server/trpc.ts:42`, `archive/nextjs-foundation-2026-06/src/app/api/interview/stream/route.ts:25`) and are not changed.
- The candidate streaming route must import auth helpers relative to its own location using `../../../auth/verified-identity` and `../../../auth/interview-scope`; regression coverage lives in `consumer-import-paths.test.ts`.
- In the streaming route, verify before creating the service-role client, and independently verify session/idea ownership.
- Never use a service-role client for operations that can be safely scoped to the authenticated user.
- Validate session ID and idea ID against the same record. Check all database errors.
- Add explicit ownership checks to flagInsight, getHistory and listSessions.

## Required tests
- Signed valid fixture accepted.
- Unsigned, tampered, expired, wrong issuer, wrong audience, missing subject, and unsupported algorithm rejected.
- Cross-user ownership denied for stream and every protected procedure. Helper level DONE: `interview-scope.test.ts` (7 cases; mutant without the owner check fails 2). Route and procedure level OPEN.
- Supabase RLS integration proven with real test identities.
- Run `node --test repair-candidate/auth/jwt-rs256.test.ts repair-candidate/auth/verified-identity.test.ts repair-candidate/auth/interview-scope.test.ts repair-candidate/auth/consumer-import-paths.test.ts` on the exact candidate branch. Typecheck, dependency install and end-to-end tests required before merge.

Verified here: `node --test repair-candidate/auth/jwt-rs256.test.ts repair-candidate/auth/verified-identity.test.ts repair-candidate/auth/interview-scope.test.ts` gives 40/40 pass; strict `tsc` is clean on the auth files; decode-only mutant of `verified-identity.ts` fails 8 tests; no-owner-check mutant of `interview-scope.ts` fails 2 tests.
Import paths corrected and source-level import resolution checked. `consumer-import-paths.test.ts` gives 2/2 pass after its regex escapes were fixed (the file did not parse before); a wrong-path route mutant fails it.
Not verified: the consumers (`trpc.ts`, `route.ts`) need `@trpc/server`, `@supabase/supabase-js`, Next.js and the app's `@/lib` modules, none installed here. Their wiring is unverified. No production claim.
