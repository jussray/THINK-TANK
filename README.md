# THINK-TANK

Think Tank interviews a founder's idea, challenges the answers, scores a fixed rubric, synthesizes a durable Idea Record, and preserves versions for later pivots.

## Current verified product boundary

V0 proves one deterministic, local-first end-to-end loop:

1. Enter an idea.
2. Answer four interviewer questions.
3. Persist answers into one Idea Record.
4. Run deterministic Critic, Scorecard, Synthesizer, and Matchmaker passes over that shared record.
5. Save a version receipt.
6. Reload and recover the record from browser storage.
7. Export the Idea Record as a versioned JSON artifact.
8. Import a valid Think Tank export into another browser session.

The deterministic role logic is intentionally **not** presented as production AI. The scorecard is a structured heuristic based on founder-provided answers, not external market validation or proof of demand.

Provider-backed agents, server-side persistence, authentication, billing, Team, and API access remain outside the verified V0 slice until separately implemented and proved.

## Why portability matters

An Idea Record is project-owned state, not a provider artifact. The `think-tank-export-v1` JSON envelope gives the founder a manual recovery and transfer path even if a future hosting, auth, database, or AI provider changes.

Import is fail-closed: unknown formats and structurally invalid Idea Records are refused rather than silently becoming canonical state.

## Run locally

```bash
npm install
npm run serve
```

Open `http://127.0.0.1:4173`.

## Verified offline continuity artifact

Build the inspected static artifact:

```bash
npm run build:static
```

The current V0 artifact can also be opened directly from `_site/index.html` with no local server. CI proves this path in Chromium with the network disabled: the founder can complete the deterministic interview, persist and recover the Idea Record across reload, and export portable JSON.

This is a **Chromium-tested deterministic continuity guarantee**, not a claim that every browser treats `file://` storage identically. It also does not make provider-backed AI, server sync, auth, billing, or public deployment available offline.

## Verify with Playwright

```bash
npx playwright install chromium
npm run test:e2e
npm run build:static
npm run test:e2e:file
npm run test:e2e:artifact
```

The browser suites prove:

- the full founder interview;
- deterministic Critic, Scorecard, Synthesizer, and Matchmaker output;
- browser persistence across reload;
- portable JSON export and restore;
- refusal of malformed or unknown imported state;
- refusal of corrupt stored state as canonical product state;
- the truth-boundary copy;
- offline `file://` execution from the packaged `_site` artifact in Chromium;
- mobile layout without horizontal overflow.

## Public deployment gate

`.github/workflows/publish-pages.yml` is a **manual** publication path. It requires:

- the exact current `main` SHA;
- an auditable founder publication approval reference;
- successful exact-head Playwright proof;
- GitHub Pages provider configuration.

The workflow is intentionally not triggered by normal pushes. Source readiness and offline artifact readiness are not public-runtime truth.

## Acquire readiness

Current source is closer to a transferable software asset, but it must **not** be described as Acquire-ready yet.

Acquire's current pre-revenue SaaS guidance expects a publicly deployed, functional product with user signup/login, working core features, clear positioning, and transferable assets. Think Tank still lacks verified public deployment and account-backed durable persistence/authentication.

See [`docs/BUYER_TRANSFER.md`](docs/BUYER_TRANSFER.md) for the transfer boundary and remaining gates.

## Project sovereignty

Read [`docs/PROJECT_SOVEREIGNTY.md`](docs/PROJECT_SOVEREIGNTY.md). External providers are adapters, not product identity. Critical state must keep a project-owned recovery/export path.
