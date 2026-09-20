# THINK-TANK Gate −1 carry-forward ledger

This ledger tracks the incremental continuity work around deterministic V0. Each gate stays independently reviewable and reversible; later gates must not be backfilled into an earlier patch merely because the architecture is already known.

## Closed

- **Gate −1a — storage seam:** `IdeaStore` / `IdeaReadModel`, `LocalIdeaStore`, `MemoryIdeaStore`, path-allowlisted `localStorage`, focused persistence tests.
- **Gate −1b — deterministic engine seam:** extracted deterministic engine, engine/rubric versions, golden parity, domain-purity enforcement, inspected static artifact, source and packaged Playwright proof.

## Gate −1c — runtime contracts

Current implementation scope:

- `IdeaRecordV1` and `IdeaVersionV1` are live persistence contracts.
- Existing V0 records without schema markers are normalized additively on read; founder content is not invented or silently overwritten.
- Local and memory persistence refuse malformed writes.
- Corrupt persisted JSON is surfaced as refused state rather than rendered as canonical product state.
- Portable import/export uses the same runtime contract boundary as persistence.
- `AgentResultV1`, `EvidenceReceiptV1`, `ScoreReceiptV1`, and `ValidationTaskV1` exist only as inert data validators. Their presence does not claim provider AI, research, evidence scoring, or operational task execution.
- `DecisionReceipt` remains intentionally deferred to Gate 5, when terminal decision semantics and delegated approval authority are implemented.
- No external validation library is added yet; the current validator is project-owned and dependency-free.

## Still deferred

- Gate −1d: sovereignty verification for `file://` versus locally served offline operation, followed by the explicit modular artifact policy.
- Gate −1e: capability policy and runtime manifest.
- Gate 2: authenticated canonicality and conflict-review state machine; no automatic merge or last-write-wins.
- Gate 3: provider capability execution, transactional budget reservation, and final AgentResult execution semantics.
- Gate 5: DecisionReceipt contract, one-terminal-decision-per-IdeaVersion semantics, and approval delegation lifecycle.

## Current invariants

Application code may persist the current V0 Idea Record only through the `IdeaStore` / `IdeaReadModel` seam. Direct `localStorage` access is exact-path allowlisted to the local store implementation, its focused store test, and the dedicated test-only corruption fixture.

Persisted or imported Idea Records are not canonical merely because JSON parsing succeeds. They must normalize into and validate against the current project-owned runtime contract before use.
