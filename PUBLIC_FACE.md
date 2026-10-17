# Think Tank — public product definition

Think Tank is a local-first idea interview system that helps founders turn a rough idea into a durable Idea Record by asking hard questions, challenging assumptions, scoring a fixed first-pass rubric, and preserving pivots over time.

## What it does

- Interviews the founder about buyer, alternatives, switching triggers, and defensibility.
- Captures answers in one shared Idea Record.
- Produces a fixed scorecard for market specificity, differentiation, and timing.
- Surfaces the weakest assumption and a strategic pattern to test next.
- Keeps local versions so changes in the idea stay visible.
- Exports and restores a versioned portable Idea Record.

## Truth boundary

Think Tank's V0 scorecard is a structured heuristic based on the founder's answers. It is not external market validation, customer research, investment advice, or proof of demand.

A coherent interview record can improve an idea, but it does not convert assumptions into evidence. External validation remains a separate next gate.

## Public CTA

The canonical entry surface is `index.html`.

Canonical source repository:

https://github.com/jussray/THINK-TANK

The intended public deployment URL is `https://thinktank.jussco.company`, configured in-repo via `CNAME` and packaged into the inspected artifact.

Whether that URL is **live** remains **UNVERIFIED** here. It becomes verified only when the `publish-pages` deploy job's live check passes against it — that job re-fetches every served file and re-hashes it against `artifactFileHashes`, so a passing run attests to the served application, not merely to a reachable page. Until such a run exists, treat the URL as intended, not as evidence of a deployment.

## Marketplace boundary

Do not describe the project as a live SaaS merely because the repository and Playwright lane are green. Marketplace-readiness additionally requires verified public deployment and the account/persistence capabilities demanded by the target marketplace at decision time.
