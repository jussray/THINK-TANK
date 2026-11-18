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
