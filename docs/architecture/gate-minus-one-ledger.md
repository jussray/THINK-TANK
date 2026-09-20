# THINK-TANK −1a carry-forward ledger

This patch only introduces the V0 storage/read seam and proof boundaries. The following decisions are intentionally deferred so −1a remains reversible and reviewable:

- Gate −1b: deterministic-engine extraction, purity enforcement, golden fixture/version rules.
- Gate −1c: runtime contract validation library and frozen V1 data contracts.
- Gate −1d: sovereignty verification for `file://` versus locally served offline operation, followed by modular artifact policy.
- Gate −1e: capability policy and runtime manifest.
- Gate 2: authenticated canonicality and conflict-review state machine; no automatic merge or last-write-wins.
- Gate 3: transactional provider-budget reservation and terminal AgentResult semantics.
- Gate 5: DecisionReceipt contract, terminal decision semantics, approval delegation lifecycle.

Current −1a invariant: application code may persist the current V0 Idea Record only through the IdeaStore/IdeaReadModel seam. Direct `localStorage` access is path-allowlisted to the local store implementation and its focused test.
