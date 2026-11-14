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

**Protected origin:** https://thinktank-app.jussco.company/ reaches the separate `think-tank` Worker. Its Cloudflare Access application remains separate from the public front door. A 2026-11-13 read-only Access configuration inspection found that this origin's `Login` policy currently includes a One-time PIN identity provider without an owner-email restriction. That is **not** verified founder-only access; restrict the origin using an app-specific authorized-identity policy and verify both allowed and denied access before claiming the origin is owner-only. The reusable `Login` policy also serves other Workers and must not be edited globally without a dependency audit.

**Intentional public bypass:** Cloudflare's Access application `think-tank-public-front-door - Public Only` currently uses `Bypass` → `Everyone`. Cloudflare documents that a public Worker may require exactly this Worker-level bypass when account-wide Worker Access is enabled. Security Insights flagged it as `access_policy_insecure` (Critical) on 2026-11-11, even though the founder-approved product boundary requires anonymous entry. **Do not replace the public bypass with an owner-only rule, remove it, or archive the finding as repaired without checking account-wide Access settings and independently verifying public/private flows.** The Security Insights finding remained active after a 2026-11-13 attempt to classify it as accepted risk returned HTTP 401 (insufficient write permission).

**Single deployment owner:** `wrangler.jsonc` binds only `thinktank-app.jussco.company/*`, never either public hostname. The public Worker, route/binding mapping, and WWW redirect are managed in Cloudflare separately from Workers Builds. Cloudflare is the sole publication path; the GitHub Pages workflow was removed. `.github/workflows/deploy-worker.yml` is manual-only and must not compete with Workers Builds. `.github/workflows/verify-live.yml` provides the separate exact-source, live-artifact proof (it requires an authorized Access session for the protected origin).

**Historical live proof, not current verification:** On 2026-10-28, the public hostname served 29/29 hashed files matching the inspected source artifact, a browser journey through `workspace.html` completed without an Access wall, and the protected origin challenged for Access. These receipts do not establish live reachability or private-owner authorization on 2026-11-13; both require a fresh independent check.

## Acquire readiness

Current source is closer to a transferable software asset, but it must **not** be described as Acquire-ready yet.

Acquire's current pre-revenue SaaS guidance expects a publicly deployed, functional product with user signup/login, working core features, clear positioning, and transferable assets. Think Tank still lacks verified public deployment and account-backed durable persistence/authentication.

See [`docs/BUYER_TRANSFER.md`](docs/BUYER_TRANSFER.md) for the transfer boundary and remaining gates.

## Project sovereignty

Read [`docs/PROJECT_SOVEREIGNTY.md`](docs/PROJECT_SOVEREIGNTY.md). External providers are adapters, not product identity. Critical state must keep a project-owned recovery/export path.
