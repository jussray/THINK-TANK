# Phase 1 — AI Cofounder implementation contract

Status: AUTHORED plan; not a claim of implemented functionality.

## Source and preservation
- Preserve the current deterministic V0, portable Idea Record, import/export, and continuity checks.
- Treat `archive/nextjs-foundation-2026-06/` as reference code, not proven production code.
- Cloudflare remains the canonical hosting target. No Vercel migration.
- No new pull requests, merges, deletions, or deployment without separate approval and green verification.

## Delivery slices
1. Add an opt-in provider-backed interview adapter behind an explicit capability flag. Keep deterministic V0 as fallback. Provider credentials must remain server-side.
2. Implement authenticated, owner-scoped persistence with database authorization and explicit export/recovery.
3. Add per-idea structured memory, founder-approved cross-idea sharing only, and revision-safe interview sessions.
4. Generate sourced, labeled modules (founder-stated vs inferred vs externally verified), never invented market numbers.
5. Produce explainable scorecards that do not claim market validation.
6. Integrate the Idea Workspace, regression tests, and Cloudflare deployment proof.

## Acceptance gates
- Existing V0 unit, browser, offline, export/import, and runtime-manifest tests stay green.
- Starting a new interview cannot silently reset or overwrite an existing idea.
- A user cannot read or mutate another user's private idea, transcript, or memory.
- Untrusted idea text cannot instruct agents to access secrets, change code, or deploy.
- Every provider call has spend limits, timeout, retry policy, and explicit failure behavior.
- No public sharing without affirmative founder selection and preview.
- Each change records branch, exact SHA, artifact fingerprint, tests, and observed deployment outcome.

## Next implementation
First inspect the active interview state machine, storage adapters, and existing tests. Add regression coverage for idea reset/overwrite before changing behavior. Do not transplant archived code blindly.
