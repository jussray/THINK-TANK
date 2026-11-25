# THINK-TANK

Think Tank interviews a founder's idea, challenges the answers, scores a fixed rubric, synthesizes a durable Idea Record, and preserves versions for later pivots.

## Current verified product boundary

V0 proves one deterministic, local-first end-to-end loop:

1. Enter an idea.
2. Answer four interviewer questions.
3. Persist answers into one Idea Record.
4. Run deterministic Critic, Scorecard, Synthesizer, and Matchmaker passes over that shared record.
5. Save a version receipt.
6. Reload and recover the record from browser storage, including an in-progress interview.
7. Export the Idea Record as a versioned JSON artifact.
8. Import a valid Think Tank export into another browser session, including resuming an in-progress interview.
9. Continue the same Idea Record through later pivots without replacing its identity.

The deterministic role logic is intentionally **not** presented as production AI. The scorecard is a structured heuristic based on founder-provided answers, not external market validation or proof of demand.

Provider-backed agents, server-side persistence, authentication, billing, Team, and API access remain outside the verified V0 slice until separately implemented and proved.

## Capability truth

The interview page (`index.html`) checks its browser actions against one project-owned capability policy. The other pages (`workspace.html`, `landing.html`) do not load that policy, so it is not a platform-wide gate.

Currently enabled and proved:

- read and edit the local Idea Record;
- run the deterministic analysis;
- export a portable Idea Record;
- import a valid portable Idea Record.

Currently disabled and **not** claimed as implemented:

- external research execution;
- provider-backed agent execution;
- team-member invitation;
- billing management;
- terminal decision approval.

Human authority and runtime capability are separate concepts. A future approval or provider connection must not make a capability true until the corresponding product path is implemented and proved.

## Why portability matters

An Idea Record is project-owned state, not a provider artifact. The `think-tank-export-v1` JSON envelope gives the founder a manual recovery and transfer path even if a future hosting, auth, database, or AI provider changes.

Import is fail-closed: unknown formats and structurally invalid Idea Records are refused rather than silently becoming canonical state.

## Run locally

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:4173`.

## Runtime identity manifest

Every inspected static build produces `_site/version.json` as `ThinkTankRuntimeManifestV1`. It records non-secret runtime identity including:

- the exact source commit SHA;
- runtime environment label;
- deterministic engine and rubric versions;
- Idea Record schema version;
- local capability profile and snapshot;
- `package.json` fingerprint and dependency-lock presence/fingerprint;
- the exact packaged file list;
- a non-secret manifest fingerprint.

- a `sha256` of every packaged file's contents.

`npm run check:runtime-manifest` independently recomputes those values — including re-hashing the packaged bytes of each served file — and fails if the packaged artifact does not match the expected source subject.

This content binding is what makes the manifest an attestation of the *served application* rather than of its own metadata. `tests/scripts/gate-mutation.test.js` proves the check fails on a tampered artifact; a gate that has never been shown to fail is not evidence.

Direct dev dependency versions are pinned, but this repository does **not** currently commit a `package-lock.json`. The manifest exposes that fact instead of hiding it. Transitive fresh-install reproducibility therefore remains unproved until a trustworthy lockfile is generated and verified.

## Verified offline continuity artifact

Build the inspected static artifact:

```bash
npm run build:static
npm run check:runtime-manifest
```

The current V0 artifact can also be opened directly from `_site/index.html` with no local server. CI proves this path in Chromium with the network disabled: the founder can complete the deterministic interview, persist and recover the Idea Record across reload, and export portable JSON.

This is a **Chromium-tested deterministic continuity guarantee**, not a claim that every browser treats `file://` storage identically. It also does not make provider-backed AI, server sync, auth, billing, or public deployment available offline.

## Verify with Playwright

```bash
npx playwright install chromium
npm run test:e2e
npm run build:static
npm run check:runtime-manifest
npm run test:e2e:file
npm run test:e2e:artifact
```

The proof chain covers:

- exact checked-out source identity;
- storage and domain boundaries;
- deterministic golden tests and capability-policy tests;
- the full founder interview;
- interrupted-interview recovery;
- stable Idea Record identity across pivots;
- deterministic Critic, Scorecard, Synthesizer, and Matchmaker output;
- browser persistence across reload;
- portable JSON export, restore, and in-progress resume;
- refusal of malformed or unknown imported state;
- refusal of corrupt stored state as canonical product state;
- truthful capability policy in the browser;
- inspected artifact secret/path checks;
- runtime-manifest identity verification;
- offline `file://` execution from the packaged `_site` artifact in Chromium;
- served packaged-runtime Playwright;
- mobile layout without horizontal overflow.

## Public deployment boundary

**Canonical public entrance:** https://thinktank.jussco.company/ is served by the dedicated `think-tank-public-front-door` Cloudflare Worker. https://www.thinktank.jussco.company/ redirects permanently to the canonical hostname, preserving paths and queries.

The entire built `_site` artifact is intentional public product surface: `landing.html`, `index.html`, `signin.html`, `create-account.html`, `workspace.html`, `/assets/*`, `/app/*`, and `/version.json`. In particular, `workspace.html` is public and stores its local-first Idea Record in the browser. The sign-in and create-account pages are previews, **not** working server authentication. The public front-door Worker forwards to the `think-tank` Worker via an internal Cloudflare service binding, without redirecting visitors off the public hostname.

**Protected origin:** https://thinktank-app.jussco.company/ reaches the separate `think-tank` Worker. A read-only audit on 2026-11-24 first observed a shared `Login` policy with `non_identity` → `linked_app_token` (issued for `sekret-backend`), not the One-time PIN rule seen on 2026-11-13. That shared policy is referenced by six Workers, so it must not be edited globally.

**Applied on 2026-11-24:** An application-specific `Allow` policy named `Think Tank origin - owner mailboxes` was created using three existing authorized owner identities, then the application was updated to reference **only** that policy. A fresh Cloudflare API read confirmed that the protected Worker destination was unchanged and that Think Tank **no longer references the shared `Login` policy**. The six-app reusable `Login` policy itself remained unchanged. These are observed configuration results, **not** authorized/unauthorized user-session or production-browser proof.


**Intentional public bypass:** Cloudflare's Access application `think-tank-public-front-door - Public Only` currently uses `Bypass` → `Everyone`. Cloudflare documents that a public Worker may require exactly this Worker-level bypass when account-wide Worker Access is enabled. Security Insights flagged it as `access_policy_insecure` (Critical) on 2026-11-11, even though the founder-approved product boundary requires anonymous entry. **Do not replace the public bypass with an owner-only rule, remove it, or archive the finding as repaired without checking account-wide Access settings and independently verifying public/private flows.** The Security Insights finding remains active; a renewed classification attempt on 2026-11-24 returned HTTP 401 (missing Security Insights write permission). No finding was archived, dismissed, or marked repaired.

**Single deployment owner:** `wrangler.jsonc` binds only `thinktank-app.jussco.company/*`, never either public hostname. The public Worker, route/binding mapping, and WWW redirect are managed in Cloudflare separately from Workers Builds. Cloudflare is the sole publication path; the GitHub Pages workflow was removed. `.github/workflows/deploy-worker.yml` is manual-only and must not compete with Workers Builds. `.github/workflows/verify-live.yml` provides the separate exact-source, live-artifact proof (it requires an authorized Access session for the protected origin).

**Historical live proof, not current verification:** On 2026-10-28, the public hostname served 29/29 hashed files matching the inspected source artifact, a browser journey through `workspace.html` completed without an Access wall, and the protected origin challenged for Access. These receipts do not establish live reachability or private-owner authorization on 2026-11-13; both require a fresh independent check.

**2026-11-24 live anonymous browser witness:** Cloudflare Browser Rendering ran Playwright against the production public hostname at a 390 × 844 mobile viewport. The homepage, interview (`/index.html`), workspace (`/workspace.html`), sign-in (`/signin.html`), and `/version.json` returned HTTP 200 without a Cloudflare Access wall or horizontal viewport overflow. The protected origin presented a Cloudflare Access sign-in page instead of the app. The public runtime manifest reported SHA `9ee418840401e1ecb96c618386815bd3b49883c2`, matching the inspected GitHub `main` SHA at the time; it declared 33 hashed files. This is a genuine anonymous browser and manifest identity witness, **not** authorized-owner sign-in proof, unauthorized authenticated identity proof, or independent 33-file byte-for-byte verification.

**2026-11-25 production asset attestation:** Cloudflare Browser Rendering fetched all 33 files listed by the public `version.json`, bound to GitHub `main` SHA `9ee418840401e1ecb96c618386815bd3b49883c2`. Twenty-four network responses matched their declared SHA-256 hashes as returned. Six HTML responses contained exactly one injected Cloudflare Web Analytics beacon each; removing only that identified insertion restored their declared hashes. Three CSS response bodies showed reversible character-encoding conversion in the browser-testing response; reversing it restored their declared hashes. No unexplained file-content differences remained. **This is 33/33 source-content parity after explicitly attributed transformations, not 33/33 raw HTTP byte parity.** Cloudflare zone Auto Minify (CSS/HTML/JS) was observed off. No Cloudflare production setting was changed.

The branch's `scripts/edge-asset-attestation.mjs` makes the live Node verifier accept **only** a narrow, validated Cloudflare Web Analytics HTML insertion, recording the number of normalized files. It does not normalize CSS, unknown scripts, altered page content, or forged manifests. Unexpected differences fail closed. This source change has its own tests and must pass exact-head CI before any merge. The Cloudflare Security Insights finding classification remains blocked by permission, separately from source-byte proof.

## Cloudflare Access drift verification (read-only)

`scripts/access-boundary-contract.mjs` defines the observed public-front-door, private-origin, owner-selector, and service-binding configuration requirements. `npm run test:unit` runs its local regression tests. The separate `scripts/verify-access-boundary.mjs` reads Cloudflare's API and refuses to certify an unexpected policy; it **never writes** to Cloudflare, prints no owner email addresses, and cannot demonstrate successful user login.

`.github/workflows/access-boundary-audit.yml` runs the source contract, full unit suite, runtime artifact checks, and storage/domain constraints automatically on pushes and PRs. Its independent production-account API inspection runs **only** on `workflow_dispatch` and requires the GitHub Secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_ACCESS_READ_TOKEN`. Grant that token Access Applications & Policies **read**, plus Workers Scripts **read**, not edit or deploy. Missing secrets must fail the manual audit, not silently pass.

Read-only local invocation (after providing secrets via an approved secure environment, never a committed file):

```bash
node scripts/verify-access-boundary.mjs
```

The configuration audit is not a replacement for signed-out public-browser, authorized owner, unauthorized visitor, source-SHA, or runtime-asset verification.

## Acquire readiness

Current source is closer to a transferable software asset, but it must **not** be described as Acquire-ready yet.

Acquire's current pre-revenue SaaS guidance expects a publicly deployed, functional product with user signup/login, working core features, clear positioning, and transferable assets. Think Tank still lacks verified public deployment and account-backed durable persistence/authentication.

See [`docs/BUYER_TRANSFER.md`](docs/BUYER_TRANSFER.md) for the transfer boundary and remaining gates.

## Project sovereignty

Read [`docs/PROJECT_SOVEREIGNTY.md`](docs/PROJECT_SOVEREIGNTY.md). External providers are adapters, not product identity. Critical state must keep a project-owned recovery/export path.
