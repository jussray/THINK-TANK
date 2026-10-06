# Import provenance — Next.js foundation (June 2026)

**Status: IMPORTED, UNVERIFIED.** This tree is a faithful recovery of the Think Tank
Next.js + Supabase + tRPC + Clerk foundation that was built in a Claude session on
2026-06-08 (delivered then as `think-tank-foundation.zip` → `think-tank-v2.zip` →
`think-tank-v3-pivot.zip`) and never pushed to GitHub.

## What this is

- 43 source files reconstructed from the session transcript's file-creation and
  patch operations, replayed in order (Sprint 1 schema/agents → Sprint 2 tRPC/app
  shell/onboarding/interview loop → Pivot Mode), plus this file and a `.gitignore`.
- Scope as designed: 7 Supabase migrations with RLS, `MODULE_REGISTRY` plug-in
  surface, Interview / Synthesis / Critic-Scorer / Pivot agents, post-session
  pipeline, tRPC routers, streaming interview route, workspace + Pivot Mode UI.

## What is NOT claimed

- It has **never been installed, built, type-checked against real dependencies,
  run, or tested**. No `package-lock.json` exists. Dependency versions in
  `package.json` are the June 2026 guesses.
- It is **not** the V0 product this repository proves on `main`. Per `AGENTS.md`,
  provider-backed agents, Supabase persistence, auth, billing, Team and API access
  remain outside the verified V0 slice. This directory does not change that.
- No deployment, no runtime, no production claim.

## Recovery evidence

- Source session: claude.ai chat `95002c88-9aee-42d3-838c-ca1d6bbb1cf6`
  (turns 7, 11, 15 contain the file operations; turn 19 says "all 43 files").
- Local check before import: `tsc --noEmit --skipLibCheck` → 0 syntax errors
  (TS1xxx); all remaining errors are missing-module / missing-React-types noise
  from the absent `node_modules`.
- Secret scan: none (only placeholder values in `.env.example`).

## Next gate (founder decision)

Decide whether this tree is (a) the forward architecture to resume, or (b) a
preserved reference. Either way the first technical step is `npm install` +
lockfile + `tsc --noEmit` on a real toolchain, then a Playwright real-path proof
before any capability it describes is called implemented.
