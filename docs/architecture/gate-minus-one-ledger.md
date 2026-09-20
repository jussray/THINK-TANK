# THINK-TANK Gate −1 carry-forward ledger

This ledger tracks the incremental continuity work around deterministic V0. Each gate stays independently reviewable and reversible; later gates must not be backfilled into an earlier patch merely because the architecture is already known.

## Closed

- **Gate −1a — storage seam:** `IdeaStore` / `IdeaReadModel`, `LocalIdeaStore`, `MemoryIdeaStore`, path-allowlisted `localStorage`, focused persistence tests.
- **Gate −1b — deterministic engine seam:** extracted deterministic engine, engine/rubric versions, golden parity, domain-purity enforcement, inspected static artifact, source and packaged Playwright proof.
- **Gate −1c — runtime contracts:** live `IdeaRecordV1` / `IdeaVersionV1` persistence validation, additive legacy normalization, corrupt-state refusal, portable import/export validation, and inert future receipt validators. `DecisionReceipt` remains deferred to Gate 5.
- **Gate −1d — sovereignty artifact:** the inspected `_site` artifact is proven in Chromium with network offline through `file://`, including deterministic interview completion, reload persistence, and portable JSON export. Normal source and served-artifact browser suites remain separate receipts.

## Still deferred

- Gate −1e: capability policy and runtime manifest.
- Gate 1: verified dynamic/public runtime identity.
- Gate 2: authenticated canonicality and conflict-review state machine; no automatic merge or last-write-wins.
- Gate 3: provider capability execution, transactional budget reservation, and final AgentResult execution semantics.
- Gate 5: DecisionReceipt contract, one-terminal-decision-per-IdeaVersion semantics, and approval delegation lifecycle.

## Current invariants

Application code may persist the current V0 Idea Record only through the `IdeaStore` / `IdeaReadModel` seam. Direct `localStorage` access is exact-path allowlisted to the local store implementation, its focused store test, and the dedicated test-only corruption fixture.

Persisted or imported Idea Records are not canonical merely because JSON parsing succeeds. They must normalize into and validate against the current project-owned runtime contract before use.

Offline continuity is an artifact property, not a public deployment claim. The currently verified scope is the inspected `_site` artifact under Chromium `file://` with network disabled. Other browser/OS file-origin semantics remain unproved unless separately tested.
