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

## Live hostname roles (2026-10-22)

- Public marketing entrance: `https://thinktank.jussco.company/`.
  Dedicated Cloudflare Worker `think-tank-public-front-door`; public root
  works with and without a query string.
- WWW alias: `https://www.thinktank.jussco.company/`, permanent 301 to
  the canonical public hostname, preserving path and query string.
- Protected V0 static app: `https://thinktank-app.jussco.company/`,
  served by the `think-tank` Worker under its existing Cloudflare Access
  policy. The local-first interview lives at `index.html`, and the idea
  workspace at `workspace.html`.
- Legacy non-root URLs on the public hostname temporarily 302 to the
  protected application hostname. The public Worker is NOT authorized to
  expose private application files or assets.
- `wrangler.jsonc` declares the private app route exclusively. Public
  Worker routes and redirects are managed in Cloudflare and must be
  verified separately from every Workers Builds deployment.

Unauthenticated Cloudflare browser tests confirmed a public homepage and
Access protection for the private V0 workspace on 2026-10-22. This is
not an account signup or backend authentication capability: those
features remain outside V0. The production source-artifact manifest
has **not** been independently proven against an exact deployed SHA.
The manual live verifier must target the protected app hostname and
requires authorized Access credentials to fetch application artifacts.

Cloudflare is the **only** publication path. The GitHub Pages workflow
was removed rather than left as a dormant second owner. A Vercel project
also builds this repository; it is not a deployment surface for this
product and nothing here treats its output as public truth.

The review-only `.github/workflows/deploy-worker.yml` is a manual-only fallback (`workflow_dispatch`). Merging it cannot deploy. Before it can invoke Wrangler, the operator must confirm the competing Workers Builds integration is disabled, choose the exact current `main` SHA, and pass the project gates. Never run both deployers against the same Worker. `verify-live.yml` remains the separate required proof after either deployment path.

## Marketplace boundary

Do not describe the project as a live SaaS merely because the repository and Playwright lane are green. Marketplace-readiness additionally requires verified public deployment and the account/persistence capabilities demanded by the target marketplace at decision time.
