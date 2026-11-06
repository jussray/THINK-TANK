# Auth candidate integration contract

This is a reviewable candidate, NOT a production fix. The historical June archive is unchanged.

## Preconditions
- Install and lock a compatible `jose` version in the eventual working application (not done).
- Obtain Clerk's actual JWT template issuer, audience, JWKS endpoint, and signing algorithm from trusted provider configuration. The candidate currently accepts RS256 only; verify the template actually uses RS256.
- Restrict the JWKS URL to a trusted configured endpoint, not user input. Review token key rotation and network-failure behavior.
- Confirm how Supabase validates the Clerk token and maps verified `sub` to RLS identity. Do not assume a verified app identity automatically establishes Supabase RLS claims.

## Wiring
- In the tRPC context, derive `userId` only from `verifyBearerIdentity`, not `atob`.
- In the streaming route, verify before creating the service-role client, and independently verify session/idea ownership.
- Never use a service-role client for operations that can be safely scoped to the authenticated user.
- Validate session ID and idea ID against the same record. Check all database errors.
- Add explicit ownership checks to flagInsight, getHistory and listSessions.

## Required tests
- Signed valid fixture accepted.
- Unsigned, tampered, expired, wrong issuer, wrong audience, missing subject, and unsupported algorithm rejected.
- Cross-user ownership denied for stream and every protected procedure.
- Supabase RLS integration proven with real test identities.
- Typecheck, dependency install and end-to-end tests required before merge.

No tests have been run; no production claim.
