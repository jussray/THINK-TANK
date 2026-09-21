# THINK-TANK Gate −1 carry-forward ledger

This ledger tracks the incremental continuity work around deterministic V0. Each gate stays independently reviewable and reversible; later gates must not be backfilled into an earlier patch merely because the architecture is already known.

## Closed

- **Gate −1a — storage seam:** `IdeaStore` / `IdeaReadModel`, `LocalIdeaStore`, `MemoryIdeaStore`, path-allowlisted `localStorage`, focused persistence tests.
- **Gate −1b — deterministic engine seam:** extracted deterministic engine, engine/rubric versions, golden parity, domain-purity enforcement, inspected static artifact, source and packaged Playwright proof.
- **Gate −1c — runtime contracts:** live `IdeaRecordV1` / `IdeaVersionV1` persistence validation, additive legacy normalization, corrupt-state refusal, portable import/export validation, and inert future receipt validators. `DecisionReceipt` remains deferred to Gate 5.
- **Gate −1d — sovereignty artifact:** the inspected `_site` artifact is proven in Chromium with network offline through `file://`, including deterministic interview completion, reload persistence, and portable JSON export. Normal source and served-artifact browser suites remain separate receipts.
- **Gate −1e — capability policy and runtime identity:** the local founder capability policy now gates real browser actions, future SaaS/provider capabilities fail closed, and the static artifact builder is the single producer of `ThinkTankRuntimeManifestV1`. The manifest binds the exact source SHA, runtime environment, engine/rubric/Idea Record schema, capability profile, dependency declaration/lock state, artifact file list, and a non-secret fingerprint. CI independently recomputes and verifies that manifest against the exact checked-out proof subject.

## Audit repairs carried with Gate −1e

- In-progress interviews resume after reload and after importing an in-progress portable record.
- Founder answers are restored into the resumed transcript.
- A pivot preserves the Idea Record identity and appends a new version instead of copying old versions beneath a new record ID.
- The unused `MemoryIdeaStore` remains available for seam tests but is no longer loaded or shipped by the browser artifact.
- Public copy says **pressure-testing**, not external validation; the deterministic heuristic truth boundary remains explicit.
- Pull-request CI now checks out and verifies the explicit PR head SHA instead of relying on GitHub's synthetic merge ref.
- Superseded proof runs use workflow concurrency with `cancel-in-progress: true` so stale branch evidence does not keep consuming runner time.
- The public Pages workflow verifies current `main`, then packages the immutable approved SHA rather than re-checking out moving `main`, and requires the deployed `/version.json` to report that same SHA.
- Local Node/test/build outputs are ignored to reduce accidental artifact or report commits.

## Still deferred / unproved

- **Gate 1:** verified public/dynamic runtime identity. The publication workflow exists, but no successful public deployment receipt exists yet.
- **Dependency lock:** direct dev dependency versions are pinned, but no committed `package-lock.json` exists. The runtime manifest reports lock presence explicitly; transitive fresh-install reproducibility remains unproved until a trustworthy lockfile is generated and verified.
- **Gate 2:** authenticated canonicality and conflict-review state machine; no automatic merge or last-write-wins.
- **Gate 3:** provider capability execution, transactional budget reservation, and final AgentResult execution semantics.
- **Gate 5:** DecisionReceipt contract, one-terminal-decision-per-IdeaVersion semantics, and approval delegation lifecycle.

## Current invariants

Application code may persist the current V0 Idea Record only through the `IdeaStore` / `IdeaReadModel` seam. Direct `localStorage` access is exact-path allowlisted to the local store implementation, its focused store test, and the dedicated test-only corruption fixture.

Persisted or imported Idea Records are not canonical merely because JSON parsing succeeds. They must normalize into and validate against the current project-owned runtime contract before use.

A human authority root and an executable capability are not the same thing. Local V0 enables only the actions currently implemented and proved. Research, provider-agent execution, team invitation, billing management, and terminal decision approval remain disabled until their own gates are built and verified.

A runtime proof is not valid merely because CI is green. The workflow must bind checkout to the explicit subject SHA, and the packaged artifact's runtime manifest must identify that same SHA.

Offline continuity is an artifact property, not a public deployment claim. The currently verified scope is the inspected `_site` artifact under Chromium `file://` with network disabled. Other browser/OS file-origin semantics remain unproved unless separately tested.
