# Think Tank — public product definition

Think Tank is a local-first idea interview system that helps founders turn a rough idea into a durable Idea Record by asking hard questions, challenging assumptions, scoring a fixed first-pass rubric, and preserving pivots over time.

## What it does

- Interviews the founder about buyer, alternatives, switching triggers, and defensibility.
- Captures answers in one shared Idea Record.
- Produces a fixed scorecard for market specificity, differentiation, and timing.
- Surfaces the weakest assumption and a strategic pattern to test next.
- Keeps local versions so changes in the idea stay visible.
- Exports and restores a versioned portable Idea Record.

## Truth boundary

Think Tank's V0 scorecard is a structured heuristic based on the founder's answers. It is not external market validation, customer research, investment advice, or proof of demand.

A coherent interview record can improve an idea, but it does not convert assumptions into evidence. External validation remains a separate next gate.

## Public CTA

The canonical entry surface is `index.html`.

`landing.html` is a presentation surface only. It introduces the product and routes into `index.html`; it runs no deterministic role, stores nothing, and is covered by `tests/landing.spec.js`, which fails if it claims accounts, billing, team seats or API access. Which surface the public root serves is a founder decision and is **not** settled here.

Canonical source repository:

https://github.com/jussray/THINK-TANK

The intended public deployment URL is `https://thinktank.jussco.company`, served by **Cloudflare Workers** (`wrangler.jsonc`, assets-only, serving the inspected `_site` artifact). Cloudflare is the single owner of that hostname.

Whether that URL is **live** remains **UNVERIFIED** here. It becomes verified when `scripts/verify-live-runtime.mjs` passes against it: that script re-fetches every file named in `artifactFileHashes` and re-hashes the bytes, so a pass attests to the served application rather than merely to a reachable page or a `version.json` that claims a SHA. Until such a run exists, treat the URL as intended, not as evidence of a deployment.

`wrangler.jsonc` binds `thinktank.jussco.company` as a Cloudflare custom domain and sets `preview_urls: false`, so no branch build publishes an unapproved artifact under this product's name at a public `*.workers.dev` URL. Whether Workers Builds runs at all for non-production branches is a dashboard setting this repository cannot express.

Cloudflare is the **only** publication path. The GitHub Pages workflow was removed rather than left as a dormant second owner. A Vercel project also builds this repository; it is not a deployment surface for this product and nothing here treats its output as public truth. Disconnecting it is a provider-side action that this repository cannot perform.

## Marketplace boundary

Do not describe the project as a live SaaS merely because the repository and Playwright lane are green. Marketplace-readiness additionally requires verified public deployment and the account/persistence capabilities demanded by the target marketplace at decision time.
