# Think Tank customer identity: dedicated Neon implementation

## Canonical boundary

- Public product: https://thinktank.jussco.company. Landing, onboarding, deterministic interview, browser-local Idea Records and exports remain available without sign-in.
- Private origin: https://thinktank-app.jussco.company, protected separately by Cloudflare Access.
- Dedicated identity + customer database: Neon project cool-bar-40730429 (think-tank), branch br-proud-fog-beq03glb, database think_tank. Neon Auth (Better Auth) issues end-user JWTs for the Neon Data API.
- Founder Control Room stays independent. Never reuse FCR founder auth or provider secrets for Think Tank customers. Historical FCR Supabase migration files remain preserved but are not the selected customer backend.
- Cloud saves are explicit opt-in. Do not transmit founder idea content to third-party AI or delete existing local records.

## Implemented source on the focused fix branch

- worker/frontdoor.mjs dispatches account and idea API requests to worker/neon-api.mjs before public asset forwarding. The CSP permits connect-src self.
- worker/neon-api.mjs requires a canonical PUBLIC_ORIGIN, NEON_AUTH_URL, NEON_DATA_API_URL and the NEON_AUTH_RELEASE=enabled flag, and rejects invalid or absent configuration with HTTP 503.
- Sessions use Secure HttpOnly cookies, with JWT use restricted to server-to-Neon Data API calls. Supports signup, verified sign-in, OTP verification and password recovery, logout, owner-specific idea list/create/read/update and optimistic revision checks. No DELETE route or service-role key.
- assets/auth-entry.js renders code verification and password reset controls only after the account API is available. Without it, credential fields stay disabled and local exploration works.
- tests/neon-api.test.mjs checks fail-closed behavior, CSRF origin restrictions, anonymous denial, session cookies, cross-tenant ownership and revision conflicts.
- .github/workflows/playwright.yml now includes fix branch push events for full browser proof.

## Verified provider status (2026-11-21)

- Dedicated Neon project, Neon Auth and Data API provisioned. Email verification is mandatory, OTP is selected, localhost is disallowed, and sessions are revoked on password reset.
- Registration remains DISABLED. Dedicated production SMTP and real email delivery proof are pending.
- Separate idea table: zero records. RLS enabled and forced, authenticated SELECT/INSERT/UPDATE owner-bound via auth.user_id(), no anonymous table grants and no DELETE grants.
- Direct anonymous Neon Data API call returned 401.
- Current public homepage and local workspace returned 200, private origin 403.
- The live public account API returned 404; the deployed old CSP has connect-src none. Branch code is NOT deployed. No public account is live.

## Proof and remaining gates

- Local: isolated new Neon gateway passed eight focused Node unit tests against mock upstream responses.
- Staged browser: six Playwright checks passed with exact branch UI source and simulated API responses, including mobile signup, OTP input, desktop recovery and narrow-screen overflow.
- These mocks DO NOT prove live Neon signup, email delivery, account recovery or end-user JWT and RLS enforcement.
- Current exact-head GitHub CI, real email transport, two-user isolation, production WAF/rate limits, deployment and live Playwright remain required.

## Release order

1. Pass the exact-branch Node + full Playwright CI and reconcile against current main, without unrelated changes.
2. Configure dedicated production SMTP, test real OTP email receipt and recovery.
3. Configure auth-specific edge rate limits and bot protection without gating public pages.
4. Deploy and verify only a staged public Worker version with a closed release gate and canonical Neon endpoints.
5. Test authorized disposable account A vs B: signup, verify, login, logout, reset, read/write ownership, revisions, local fallback and mobile/desktop behavior.
6. Require explicit founder approval tied to exact head before production promotion or opening registration.

## Rollback

Disable NEON_AUTH_RELEASE, or restore the previous verified public Worker deployment; preserve user records and local-first continuity. Never delete customer content as an automatic rollback.
