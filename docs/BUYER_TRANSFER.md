# Buyer transfer contract

This document defines what a future buyer can verify and transfer without turning repository prose into unsupported product claims.

## Canonical transferable assets

- `index.html` — current V0 application.
- `tests/interview.spec.js` — browser proof of the core founder path and portable-record path.
- `.github/workflows/playwright.yml` — continuous browser verification.
- `.github/workflows/publish-pages.yml` — founder-gated public publication path.
- `AGENTS.md` — repository operating contract.
- `docs/PROJECT_SOVEREIGNTY.md` — provider-independence and recovery contract.
- `PUBLIC_FACE.md` — public positioning and truth boundary.
- `l99-case-ledger/` — existing evidence/receipt material.

## Current product-owned state

The browser stores the active Idea Record under:

`think-tank.idea-record.v0`

Portable exports use:

`think-tank-export-v1`

The export is the current manual migration/recovery path. It contains the Idea Record and version history, not credentials or provider secrets.

## Dependencies

Current V0 core:

- static HTML/CSS/JavaScript;
- browser `localStorage`;
- browser Web Crypto `crypto.randomUUID`;
- Node/npm only for local serving and test tooling;
- Playwright only for browser verification.

No production database, authentication provider, payment provider, model provider, or analytics provider is required for the verified local V0 loop.

## Provider-loss audit

If every named external provider disappeared:

- **Core interview survives:** yes, as static browser code.
- **Local Idea Record survives:** yes, on the current browser profile.
- **Portable recovery survives:** yes, through exported JSON.
- **CI proof stops:** yes, if GitHub Actions disappears.
- **Public hosting stops:** depends on the chosen hosting provider.
- **Account login/server sync:** not implemented, therefore not claimable.

## Transfer procedure

Before any sale closes:

1. Freeze an exact repository SHA.
2. Re-run exact-head Playwright.
3. Verify the public runtime resolves to that exact source state.
4. Inventory domain/hosting/provider accounts separately.
5. Export any buyer-relevant non-secret operational evidence.
6. Rotate or transfer credentials through provider-native mechanisms, never through repository files.
7. Verify the buyer can run the product from a clean environment.
8. Verify the buyer can publish a clean public runtime from transferred authority.
9. Only then mark the software/runtime transfer complete.

## Remaining Acquire-specific gates

As of the repository's current state, the following are not yet proved:

- public deployed runtime;
- user signup/login;
- server-backed durable multi-device persistence;
- a dedicated transferable auth/data provider boundary;
- live user/customer metrics;
- revenue.

Those remain separate receipts. One green source or Playwright result must not stand in for another.
