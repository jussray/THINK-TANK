# Think Tank public front door / independent protected app

## Observed Cloudflare routing — 2026-10-22

Think Tank's deployment changed while the initial fix was being reviewed. Use **current provider state**, not the former single-Worker assumption:

- `thinktank.jussco.company/` and `thinktank.jussco.company/*` now route to the **presentation-only** `think-tank-public-front-door` Worker.
- `thinktank-app.jussco.company/*` routes to the **Access-protected** `think-tank` app Worker. The app's main `wrangler.jsonc` on current `main` now targets that private hostname, not the public one.
- An active zone Single Redirect rule forwards *non-root* paths at the public hostname to the protected app hostname, preserving the path and query string. This rule executes before Worker routing.
- `www.thinktank.jussco.company` redirects to the primary hostname with query-string preservation.
- The public Worker serves only root GET/HEAD HTML, with no private data, storage bindings, application APIs or execution authority. Other paths fail closed if the redirect ever stops working.

An earlier unused marker route `thinktank.jussco.company/__frontdoor_home*` was created during query-string investigation. The active non-root redirect takes precedence and sends it to protected Access. It is not required by the current architecture; cleanup needs separate route review. No rewrite rule was added.

## Anonymous browser evidence

- `https://thinktank.jussco.company/` and `https://thinktank.jussco.company/?utm_source=probe` display the cinematic Think Tank landing.
- `https://thinktank.jussco.company/index.html` and `/admin` display Cloudflare Access login.
- `https://thinktank-app.jussco.company/` and `/index.html` display Cloudflare Access login.
- Source: `landing.html` blob `8aa03b3b615109b9938b3351b06e34ca5c2548e9`; image assets pinned to revision `ba97d5b9871fc6dbfb163305f0f0113339b22259`.

## Controls and rollback

Tests: `node --test tests/front-door.test.mjs`.
Reviewed manual deploy command: `npx wrangler deploy --config wrangler.front-door.jsonc`.

Do not redeploy older `wrangler.jsonc` revisions that bind the protected `think-tank` Worker to the public hostname. The public Worker must remain unable to handle account, journal, student, or admin routes. Private origin authorization and Cloudflare Access both remain required. A later canonical hostname change must verify Cloudflare DNS, routes, rule order and exact deployed revisions.

Because another actor changed the routes during this work, re-observe current live state immediately before deploying or editing DNS. Do not assume source-controlled configuration alone proves current provider state.
