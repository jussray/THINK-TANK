# THINK TANK: APPROVED UI TARGET

**Status:** Founder-approved visual design, **not yet implemented or visually verified**.  
**Approval:** 2026-10-16 (approved image shared in ChatGPT).  
**Authoritative repository:** `jussray/THINK-TANK` on `main`.  
**Canonical entry:** `index.html`.  
**Full-resolution original:** `Think Tank/assets/think-tank-approved-ui-2026-10-16.png` in founder's ChatGPT Library.  
**Git repository image:** `assets/think-tank-approved-ui-2026-10-16.png` (exact original).  
**Original image SHA-256:** `b7aa5bf526180ead1e371e192790a1f323a15f84e70eddafa6d880e146bf40f3`.  
**Original dimensions:** 1536 × 1024 PNG.

## Asset installation gate

**INSTALLED AND CHECKED:** The exact approved original is stored at `assets/think-tank-approved-ui-2026-10-16.png` as Git blob `9ec62735e7a91f271843d0ccadc02c88c953e254`, with the SHA-256 value above. The canonical PNG is a screenshot/composite of the target interface, not a production image to use as a CSS background. Match the *visual and interaction design* using real UI components. Do not quietly regenerate or replace this reference. Keep the visual QA gate open until browser proof and founder signoff.

## Intent

Design a cinematic, premium-feeling, welcoming idea studio that remains clear for novices and powerful in its existing underlying workflows. Key message: **“Where ideas become companies.”** A beautiful front end for the existing THINK TANK, not a replacement product or a superficial static mockup.

## Visual anatomy of the approved image

1. **Hero / Home:** full-bleed atmospheric twilight mountain valley, misty reflective lake, luminous amber-lavender circular portal, lone person facing it. Large editorial serif hero reading `Where ideas become companies.` Left primary CTA `Start Exploring`, smaller nearby value propositions, minimal Think Tank logo and top navigation. Keep hero readable over imagery.
2. **Start workspace:** cinematic dark landscape, minimal vertical app navigation, a centered `What's on your mind?` prompt, large glowing idea-entry field, voice icon where functional, one clear submit action and optional starter chips.
3. **Guided interview:** focused, one-question-at-a-time flow with progress `Question 1 of 4`, editable answer, Back/Next, and preserved draft. The example question shown is `What problem are you trying to solve?`
4. **AI exploration:** four luminous orb-like role representations in a 2 × 2 grid: `The Critic`, `The Scorecard`, `The Synthesizer`, `The Matchmaker`. Each has a short plain-English role explanation. These names do **not** imply production/provider AI is implemented.
5. **Results:** legible `Here's what we found.` surface with Overview, Analysis, Opportunities, Risks, Next Steps. Clear bottom line, rubric-based score display, strengths, risks, and opportunities, with uncertainty and evidentiary limits visible.
6. **Build your idea:** `Turn insight into action.` workspace with saved Idea Record identity, next actions, plan/milestones/research/people/versions tabs where real capability is available. Preserve evidence, recovery, and pivots.
7. **Your idea hub:** `My Ideas` with editorial image-backed idea cards, status and continue/resume affordances, and `New Idea`. Example companies/projects in the mockup are **illustrative**, not actual user records.

**Look and feel:** near-black navy, deep plum, spectral purple and violet glow, hints of warm gold and teal, rich atmospheric imagery, fine glass borders, generous spacing, editorial serif for hero headings and crisp UI sans-serif for controls, subtle lighting and restrained motion. A modern cinematic product, not a crowded generic AI dashboard. The hero is dramatic, but forms, buttons, navigation, and results prioritize usability.

**Responsive interpretation:** preserve the design's visual hierarchy on desktop; on narrow mobile screens reflow panels vertically, use one clear primary action and readable text sizes, preserve accessible touch targets, avoid overflow and clipping. Respect `prefers-reduced-motion`, keyboard focus, contrast and non-hover controls. Don't squeeze the entire 1536×1024 montage onto a phone.

## Functionality / truth boundaries

This image combines a landing hero plus six product-state views; it is **not** evidence that these screens already work. Reuse existing runtime `index.html`, deterministic engine, four-question interview, versioned Idea Record, local persistence/recovery and import/export. Never replace proven code with decorative demos. Keep actual action states: draft, active, saved, failed and recovered. Text-to-speech/microphone, provider-backed AI, research, people matching, auth, billing, multi-user cloud sync and real external validation are **not verified** in V0 and must not be presented as live functionality. Show explicit disabled/coming-later states rather than fake controls or fabricated scores, users, demand, companies, or saving receipts.

## Agent build order

1. Read `AGENTS.md`, `PUBLIC_FACE.md`, `README.md`, this target, and the approved PNG.
2. Inspect `index.html`, current tests and existing browser flow. Preserve app contracts and recovery.
3. Implement the visual changes in small reversible increments: home/start; interview; role exploration/results; build/idea hub. Avoid unrelated refactors or changing scoring.
4. Run focused unit tests and domain/storage boundary checks before Playwright.
5. Use Playwright on the **actual implementation** at desktop 1536×1024 and representative mobile viewport(s), compare with the canonical image and review both interactions and screenshots. Capture artifacts/links; do not invent a similarity percentage.
6. Report what is matched, mismatched, unimplemented or blocked. Continue until the approved visual target is met **and the founder signs off**. No new unrelated PRs or provider work without a separate need and authority.

## Completion gate

**NOT DONE** while any of these remain: major visual differences unaddressed; mobile controls clipped; interview or recovery broken; mock controls misleading; no Playwright screenshots; missing founder approval. Green CI alone does not close the design request. Existing validated runtime behavior takes precedence over decorative additions.

**This file is a design contract, not a statement of deployment, capability, or pixel-fidelity proof.**
