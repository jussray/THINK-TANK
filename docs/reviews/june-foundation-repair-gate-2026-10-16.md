# June foundation repair gate (2026-10-16)

Status: SECURITY REVIEW / NOT MERGE READY.

## Evidence preservation
The archived June source remains a historical reconstruction. Do not rewrite files under `archive/nextjs-foundation-2026-06/` as though they were the original June artifacts. Repair implementation belongs in a separate working tree, with exact-head tests before any promotion.

## Source-confirmed blockers
1. `src/app/api/interview/stream/route.ts` extracts JWT `sub` via `atob` without signature verification, then uses a service-role Supabase client.
2. `src/server/trpc.ts` extracts `sub` similarly; the protected-procedure gate checks only whether this unverified value exists. Passing a token to Supabase does not make the locally decoded identity verified.
3. `src/server/routers/interviews.ts` flags messages by ID without an explicit owner-scoped filter; verify RLS and enforce ownership at the operation boundary.
4. `endSession` invokes `runPostSession(...).catch(...)` without a durable queue. Serverless termination can lose the job.
5. `src/hooks/useInterview.ts` parses SSE by splitting each network chunk on newline; split frames can be dropped.

## Required acceptance tests
- Invalid signature, expired token, wrong audience/issuer, and forged subject all return 401 without data access.
- Cross-user session/message access is denied, including when database service credentials are present.
- End-session job is durably recorded, idempotent, retried after worker interruption, and surfaced as pending/succeeded/failed.
- SSE parser preserves partial UTF-8 and partial frames across arbitrary chunk boundaries.
- Dependency install, lockfile, type-check, unit tests, and Playwright interview happy-path and denied-path pass on exact branch SHA.

## Provenance boundary
The October 6 recovery commit describes a June 8 Claude implementation, but is not an authenticated June commit. Founder reports the concept passed ChatGPT → Perplexity → Claude. Earliest ChatGPT transcript remains unverified.

No tests, deployment, merge, or production fixes are claimed by this note.
