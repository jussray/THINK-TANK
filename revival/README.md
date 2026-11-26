# Think Tank — June AI revival (isolated workbench)

This package revives the **June 8, 2026** Socratic interview rules as a
provider-agnostic, executable module. It is designed to connect to the
current IdeaRecordV1 and preserve the founder-approved October visual
experience rather than replace it.

## Truth / privacy boundary

- **Not wired to the deployed static V0**, Cloudflare routes, or browser UI.
- The deterministic four-question interview and scoring remain the only
  verified live-local capabilities until the AI seam is authenticated,
  connected, and tested.
- No account, server persistence, billing, marketplace, or live research is
  claimed by this folder.
- The external model adapter is **opt-in**. Running the pure tests does not
  make an API call or transmit an idea.
- `ANTHROPIC_API_KEY` is server-side only; never place it in HTML or a
  `NEXT_PUBLIC_` variable.
- Do not connect this engine to a public endpoint without verified
  authentication, per-idea ownership checks, usage limits, and consent.
- Each turn receives only the selected Idea Record and the history supplied
  for that idea. No cross-idea memory is injected.
- The provider is not allowed to change or publish ideas or infer scores.
  Founder approval and versioned writes remain in the existing app.

## Founder-only authenticated AI pilot (2026-11-25)

The current **public Worker source** now has a staged, disabled-by-default
server API built on its existing Supabase Auth cookies and private idea vault:

- `GET /api/ai/status` (authenticated) reports whether this account can
  use the provider without exposing secret configuration.
- `POST /api/ai/interview` requires `{"ideaId":"<uuid>","externalAIConsent":true}`.
  The selected private-vault record supplies all model context; the client
  cannot supply a different idea or transcript. Returns one unverified
  follow-up question, **not a stored session**.
- `POST /api/ai/synthesize` uses the same consent and ownership controls,
  returning nine draft startup modules marked `pending-founder-review`.
  No version or module is ever overwritten by this endpoint.

Before **any** model call the Worker verifies the signed-in identity through
Supabase Auth, checks same-origin mutation controls, loads an owner-filtered
record under that user's bearer token and requires a configured founder user
ID and Cloudflare `AI_RATE_LIMIT` binding.

The existing private cloud vault UI renders AI actions **only** after
`/api/ai/status` reports enabled for that signed-in founder. Each request
presents a separate explicit consent dialog explaining disclosure to
Anthropic. Dismissing the dialog sends nothing. Neither action auto-saves
drafts or transmits other local browser ideas.

### Configuration — do not activate without founder approval

Provide these in the deployed public front-door Worker (not in source files):

- `THINK_TANK_AI_OWNER_USER_ID` — actual Supabase Auth UUID from the
  founder's verified user account; do not use an invented/test UUID.
- `THINK_TANK_AI_MODEL` — supported Anthropic model identifier, verified
  from provider configuration.
- `ANTHROPIC_API_KEY` — secret, server-side only.
- `THINK_TANK_AI_ENABLED` — set to `true` **only** after owner approval,
  independent cost authorization and real credentials are verified.

`wrangler.frontdoor.jsonc` declares an `AI_RATE_LIMIT` binding (5 per
60s **per Cloudflare location**, approximate). It is a misuse safeguard, **not
a strict global budget cap**; a centralized spend limit and provider usage
budget are still required before activating paid-model traffic at scale.

Unconfigured AI remains disabled and the existing local deterministic
interview remains usable. CI tests mock the provider and Supabase Auth;
they are not proof of actual production token delivery or live RLS.
Paid/public user entitlements are **not implemented**, so model usage stays
restricted to a single explicitly configured founder account.

### Additional gates

1. Verify real login, owner identity, Supabase RLS, and Cloudflare bindings
   without handling or publishing private data in CI logs.
2. Add durable, exportable AI session history and a per-idea iterative
   conversation. This first pilot returns a single question per request.
3. Add founder-approved application of draft modules to the versioned
   workspace, with conflict checks and rollback.
4. Require exact-head unit, browser, visual-diff, private-API and production
   tests before deployment. Cloudflare is the only deploy authority.

## Developer tests

Run `node --test revival/ai/*.test.mjs` at the repository root.

## Next integration gates

1. Keep the approved cinematic HTML/CSS/assets, and preserve the current
   `LocalIdeaStore` export/import format.
2. Implement a **protected, consented server API** for `interviewTurn`.
   Do not expose the provider key or enable a public API prematurely.
3. Map authenticated founder ID to the requested IdeaRecord and validate
   permission **server-side**. A decoded JWT payload without signature
   verification is not authentication.
4. Add an AI session history store with durable, exportable state. Never
   auto-overwrite existing modules; show proposals for review.
5. Add a founder-controlled opt-in mode to the existing cinematic interview
   panel. Keep the fixed-question offline engine as an explicit fallback.
6. Run red-team, cost-limit, cancellation, interruption/resume,
   privacy-isolation, browser, and deployment-artifact tests before exposure.

The original 43-file Next/Supabase/Clerk project remains preserved in
`archive/nextjs-foundation-2026-06/`; it is a **reference, not a live app**.
The original streaming route's unverified JWT decoding must not be copied
into a production runtime.
