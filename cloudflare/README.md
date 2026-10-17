# Think Tank: Cloudflare D1 + Council / Court

**State:** D1 migration applied and schema read back. Live Worker and public app have not been deployed.

## Architecture and authority
- Cloudflare Worker + D1 own the standalone Think Tank records. FCR, Se'kret Bip, and AYURE databases remain unchanged.
- Cloudflare Access is the identity boundary for the founder pilot. Verified Access team is jussray.cloudflareaccess.com and the registered Think Tank Access app audience is 82c660bb0d081053c839f3b359aba04e1f1ca7c82c15cd2bffb3b894d13b85a2.
- The Worker requires cryptographically verified Access JWT subject, audience, issuer, and JWKS signature, then scopes all idea/execution reads and mutations to that subject.
- Council/Court contracts are pinned from ULTRATHINK-COUNCIL upstream merge 643c0bb9ab5e1152a49814d6351c2ac1b68b81b2. Council composes findings; Court evaluates their evidence, not authority.
- ChatGPT/OpenAI serves as an explicit model participant via the Responses API and a separate server-only API key, never as direct access to private ChatGPT conversations.
- Council Bus is independent (Linear ENG-7). Handoffs stay PREPARED_NOT_SENT; no live callbacks or execution authority.

## D1 migration receipt
- New database: think-tank, UUID 24672c6e-2d4c-4ffb-8e87-bb391d1d5830, jurisdiction us.
- Migration: migrations/0001_initial.sql, GitHub blob 40851163147d77ed2aa9511d4efbcca8f6b80d31, commit 49bb2e64c0768059beae51ad4b90b25234c16c1b.
- Cloudflare D1 applied all 19 statements successfully. Independent sqlite_master readback confirmed nine application tables, five triggers, and five named indexes.
- There are no actual founder interview records in the migration. SQLite does not have Postgres RLS; do not grant direct public SQL access.

## Durable execution path
Founder JWT -> owner-scoped idea -> idempotent D1 execution insert -> database-triggered answer, snapshot, revision, run and event -> leased cron worker -> schema validated model output -> Council/Court review -> database-triggered completion and question -> UI event readback.
Limits: 100 ideas per owner, 100 interview turns per idea, 10 executions per day per owner, 3 tries per run, 220 model output tokens per call. The model API can incur usage charges and remains unconfigured until separately authorized.

## Validation
Run from repo root: python3 cloudflare/tests/test_schema.py -v.
Run from cloudflare/: npm install && npm test && npm run check:build && npm run test:e2e.
CI: .github/workflows/cloudflare-council.yml.

## Release gate (CLOSED)
- Wrangler declares an isolated think-tank-council-preview Worker but has not deployed it. The existing think-tank Worker and thinktank.jussco.company route are untouched.
- Attach Cloudflare Access to the exact preview hostname/path and read back the expected policy. An existing Access app is not proof that the preview route is protected.
- Configure a scoped OPENAI_API_KEY Cloudflare secret and an intentionally selected OPENAI_MODEL only after its price and budget are accepted. No key is committed.
- Verify real signed token, wrong-owner denial, idempotency, competing leases, expiry, model refusals, reconnect, persisted Court decision and no Bus delivery.
- Verify deploy SHA, routing, browser behavior and D1 readback before switching production.

**Rollback:** Drop the code branch without touching main. The isolated D1 database currently contains only the applied schema/system metadata. Do not casually delete a database or use another project's credentials.
