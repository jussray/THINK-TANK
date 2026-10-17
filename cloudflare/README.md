# Think Tank: Cloudflare D1 + Council / Court

**State:** Independent D1 schema applied and read back. An Access-protected Cloudflare Workers preview has been deployed. Public production remains unchanged; authenticated founder-to-model execution has NOT been verified.

## Architecture and authority
- Cloudflare Worker + D1 own the standalone Think Tank records. FCR, Se'kret Bip, and AYURE databases remain unchanged.
- Cloudflare Access is the identity boundary for the founder pilot. Verified Access team is jussray.cloudflareaccess.com. The isolated preview's registered Access audience is 23a4f44b94fef56ec7562da17b5d77d1e4d5f9467f0624349ce84e69bfdc40cd; the original think-tank Worker has a DIFFERENT audience and must not be reused.
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
- The isolated `think-tank-council-preview` Worker is deployed at `https://think-tank-council-preview.mcgill-raylene.workers.dev`; Cloudflare readback showed source fingerprint `86d42196b2789ea4fae459a6ef85099d4e0af00e` and its matching D1 binding. Deployment is separate from the newer branch head. The existing `think-tank` Worker and `thinktank.jussco.company` route are untouched.
- A specific Access application `Think Tank Council Preview` protects the preview hostname and Worker identity; unauthenticated probes of `/health` and `/api/me` returned `login_required`. However the attached reusable one-time-PIN policy is shared by five other apps and allows any authenticated email. Restrict the pilot through a preview-only policy before enabling model spend or inviting users. Do NOT edit the shared reusable policy.
- Configure a scoped OPENAI_API_KEY Cloudflare secret and an intentionally selected OPENAI_MODEL only after its price and budget are accepted. No key is committed.
- Verify real signed token, wrong-owner denial, idempotency, competing leases, expiry, model refusals, reconnect, persisted Court decision and no Bus delivery.
- Verify deploy SHA, routing, browser behavior and D1 readback before switching production.

**Rollback:** Drop the code branch without touching main. The isolated D1 database currently contains only the applied schema/system metadata. Do not casually delete a database or use another project's credentials.

## Deployment observation (2026-10-17 UTC)
- Preview Worker name: `think-tank-council-preview` (isolated).
- Preview Access app ID: `77aee3c1-9ccb-41d0-b7f5-00ffa928b4a4`.
- Preview Access audience: `23a4f44b94fef56ec7562da17b5d77d1e4d5f9467f0624349ce84e69bfdc40cd`.
- `/health` and `/api/me` anonymous read-only probes returned `login_required`; do not imply successful authenticated login.
- No `OPENAI_API_KEY` or `OPENAI_MODEL` is attached to the preview; therefore no real model executions can run.
- Repo audience and initial status-readback drift corrected on branch after deployed `86d42196` version; redeploy and verify exact SHA before declaring current source live.
