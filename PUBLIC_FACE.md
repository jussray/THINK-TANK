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

- Public marketing entrance (canonical): `https://www.thinktank.jussco.company/`.
  Dedicated Cloudflare Worker `think-tank-public-front-door`; public root
  works with and without a query string.
- Apex alias: `https://thinktank.jussco.company/`, permanent 301 to the
  canonical www host, preserving path and query string (Cloudflare Redirect
  Rule, managed in Cloudflare, not in this repository).
- Protected V0 static app: `https://thinktank-app.jussco.company/`,
  served by the `think-tank` Worker under its existing Cloudflare Access
  policy. The local-first interview lives at `index.html`, and the idea
  workspace at `workspace.html`.
- Legacy non-root URLs on the public hostnames temporarily 302 to the
  protected application hostname. The public Worker is NOT authorized to
  expose private application files or assets.
- `wrangler.jsonc` declares the private app route and the exact public
  journey file routes on the www host only. It never declares a wildcard or
  a Worker Custom Domain on a public hostname. The public root and the apex
  redirect are managed in Cloudflare and must be verified separately from
  every Workers Builds deployment.

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

## Marketplace boundary

Do not describe the project as a live SaaS merely because the repository and Playwright lane are green. Marketplace-readiness additionally requires verified public deployment and the account/persistence capabilities demanded by the target marketplace at decision time.
