# Think Tank public-front-door protection split

Live implementation on 2026-10-22:

- The exact route thinktank.jussco.company/ serves the presentation-only front-door/worker.mjs.
- The original *thinktank.jussco.company/* route continues serving the Access-protected think-tank Worker.
- The original Worker, private routes, and Access policies were not changed.
- Source: landing.html Git blob 8aa03b3b615109b9938b3351b06e34ca5c2548e9. Marketing images are pinned to public GitHub revision ba97d5b9871fc6dbfb163305f0f0113339b22259.
- The deployed worker source is committed here for reproducibility. Any changes to landing.html need a deliberate update to front-door/worker.mjs and new visual/anonymous browser proof.

Tests: node --test tests/front-door.test.mjs
Manual deployment, only after review: npx wrangler deploy --config wrangler.front-door.jsonc

2026-10-22 proof:
- / returned the correct Think Tank landing title to a fresh browser.
- /index.html was challenged by Cloudflare Access.
- /?ref=test was also challenged by Cloudflare Access. This is an open query-string routing limitation and must not be 'fixed' by broadly bypassing Access.

Review attack flows: GET and HEAD to / are public; all private or mutation paths must still challenge; unknown paths must never be handled by the public-only Worker; maintain strict no-secret, no-storage, no-auth-bypass rule.

Rollback: if needed, the operator should remove only the newly added exact public route. Preserve the existing protected catch-all and Worker Access application.
