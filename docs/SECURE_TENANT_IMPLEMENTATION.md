# Think Tank customer security — implementation and release gates

## Boundary
- Public: thinktank.jussco.company landing, onboarding, local-first interview, workspace, static assets.
- Private customer: /api/auth/* and /api/ideas* handled by think-tank-public-front-door **before** any asset proxy. Credentials are only sent to the same-origin API when GET /api/auth/me returns 200 or 401.
- Founder: FCR founder interfaces, creator-only projects, keys, and privileges remain separate. Think Tank signup never calls or updates founder_users, is_founder(), projects or FCR founder operations.
- Origin: thinktank-app.jussco.company remains Cloudflare Access protected, with public access granted only to the **separate** frontdoor Worker.
- Local records: unchanged LocalIdeaStore. Browser-local storage is device/browser scoped, not account isolated. Logout cannot and does not delete local work; share-device warning is mandatory.

## Backend source candidate
- worker/frontdoor.mjs preserves public proxy routes and strict CSP, with connect-src 'self' for API requests.
- worker/secure-api.mjs implements email signup, verified login, HttpOnly __Host- session cookies, same-origin mutation checks, token refresh, logout, and private IdeaRecordV1 CRUD **without DELETE**.
- No user content is transmitted to external AI or made public. The cloud vault requires an explicit Save action.
- Supabase project: existing founder-control-room identity project, with a **separate** think_tank_idea_records table. RLS is owner-bound, scoped to authenticated non-anonymous users. No service_role key is used by the public Worker; only a publishable key and each verified user's JWT.
- Optimistic revision preconditions fail on stale updates; collisions require an explicit founder/user decision, never overwrite silently.
- This is an additive integration, not proof that a separate new Supabase project has been created.

## Non-negotiable release gates
1. Owner approves reusing the existing FCR auth tenant for customer identity; separate app data must never have founder grants.
2. Supabase Auth email confirmations, redirect allowlist and password recovery flow are configured and tested. Existing FCR leaked-password advisory must be addressed.
3. Apply migration from supabase/migrations/20261121000000_think_tank_private_idea_records.sql to the correct FCR project. Verify RLS, grants, schema and security advisors **in the live project**.
4. Configure public Worker environment: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY; set PUBLIC_ORIGIN to the canonical https://thinktank.jussco.company. The publishable key is NOT a service-role key. No secret values committed to GitHub.
5. Add auth-specific Cloudflare WAF/rate-limit and bot/Turnstile protections without gating legitimate public pages. Confirm public Worker route bindings, no overlapping deployments, and rollback to prior worker version.
6. Pass Node unit/security tests, Playwright desktop+mobile, static artifact manifest, live anonymous public flow, signup/verification/login/recovery, tenant A vs B read/write denial, and private origin Access denial.
7. Exact-head green checks, founder release authority, no unrelated production deployment, and a rollback receipt before enabling production. **Do not deploy from this draft PR until gates pass.**

## Rollback
- Roll back only the public frontdoor Worker to its previously observed version. Local V0 workspaces continue to function; no account credentials are accepted while account API is absent.
- Revoke environment variables if needed; do not delete customer cloud records automatically.
- The additive RLS-protected table may remain closed/unused. Any data deletion requires separate authorization.

## Evidence status
- Source authored/committed to draft Think Tank PR #50; branch integration and exact-head CI must be rechecked.
- Local isolated Worker tests passed. That is not production proof.
- No production Cloudflare API Worker update or FCR database migration is claimed by this document.
