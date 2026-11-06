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

`landing.html` is a presentation surface only. It introduces the product and routes into `index.html`; it runs no deterministic role, stores nothing, and is covered by `tests/landing.spec.js`, which fails if it claims accounts, billing, team seats or API access. Which surface the public root serves was settled by founder ruling on 2026-10-25: the public root serves `landing.html`, and every artifact path is public product surface (see Live hostname roles, 2026-10-28).

Canonical source repository:

https://github.com/jussray/THINK-TANK

## Live hostname roles (2026-10-28)

- Public entrance: `https://thinktank.jussco.company/`. The dedicated
  Cloudflare Worker `think-tank-public-front-door` serves the complete
  `_site` artifact — `landing.html` at the root, plus `signin.html`,
  `create-account.html`, `index.html`, `workspace.html`, `/assets/*`,
  `/app/*`, and `/version.json` — by forwarding each request to the
  `think-tank` Worker through an internal Cloudflare service binding.
  The artifact is served, never copied, so the public entrance cannot
  drift from the deployed release. The front door applies the
  production Content-Security-Policy (`script-src 'self'`) and security
  headers at the edge.
- Edge protection on the public hostname: Cloudflare Managed WAF rules
  enabled, Bot Fight Mode on, and a rate-limit rule (100 requests per
  10 seconds per visitor IP, then a 10-second block). Protection guards
  the edge; it never walls a public journey (founder standing rule,
  2026-10-25: block hackers, not users).
- WWW alias: `https://www.thinktank.jussco.company/`, permanent 301 to
  the canonical public hostname, preserving path and query string.
- Origin hostname: `https://thinktank-app.jussco.company/`, served by
  the `think-tank` Worker under its Cloudflare Access policy (the
  policy is bound to the Worker itself). It is an origin, not a public
  surface: no public link or redirect sends users there. The 2026-10-22
  legacy rule that 302-redirected non-root public paths to this
  hostname was retired on 2026-10-28.
- `wrangler.jsonc` declares the app route exclusively; the app Worker
  is never attached to a public hostname. Public Worker routes,
  bindings, and redirect rules are managed in Cloudflare and must be
  verified separately from every Workers Builds deployment.

Verified live on 2026-10-28: every hashed file served by the public
hostname matches the release manifest of `main` commit
`02e2d68d79744dee24925fdebf6aaca71ad96069` (29/29 files, byte-for-byte);
a real-browser walk passed the full journey on the public hostname
(landing, day/night toggle, sign-in and create-account entries into the
interview, four-question interview to a rendered scorecard, and the
workspace showing the locally saved Idea Record) with no Access wall
and no redirect off the public hostname; a controlled burst tripped
the rate limit (HTTP 429) and normal browsing recovered immediately
after; the app hostname still answers with the Access login. This is
not an account signup or backend authentication capability: those
features remain outside V0, and the sign-in and create-account pages
remain entry surfaces that send and store nothing.

Cloudflare is the **only** publication path. The GitHub Pages workflow
was removed rather than left as a dormant second owner. A Vercel project
also builds this repository; it is not a deployment surface for this
product and nothing here treats its output as public truth.

The review-only `.github/workflows/deploy-worker.yml` is a manual-only fallback (`workflow_dispatch`). Merging it cannot deploy. Before it can invoke Wrangler, the operator must confirm the competing Workers Builds integration is disabled, choose the exact current `main` SHA, and pass the project gates. Never run both deployers against the same Worker. `verify-live.yml` remains the separate required proof after either deployment path.

## Marketplace boundary

Do not describe the project as a live SaaS merely because the repository and Playwright lane are green. Marketplace-readiness additionally requires verified public deployment and the account/persistence capabilities demanded by the target marketplace at decision time.
