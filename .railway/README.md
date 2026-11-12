# Railway IaC adoption, review-only

Authoritative Railway project: Think Tank, production environment. This repository currently owns the only Railway service in that environment, so this is a full-project file with no named partial. It is NOT yet proven to be an exact provider import.

1. The plan-only GitHub workflow uses the existing `RAILWAY_API_KEY` GitHub secret as the Railway CLI's `RAILWAY_API_TOKEN` (account/workspace API-key authentication). Never paste or commit it. Do not pass an account API key into `RAILWAY_TOKEN`, which selects project-token authentication.
2. In an authenticated Railway CLI checkout run `railway link --project 45b0d932-d46f-495c-9a32-c4c76bfa92f1 --environment 34e49116-9464-4e85-bdf7-fa417c20f6b7`.
3. Run `railway config partials list --json`; STOP if named partials already own the environment.
4. Run `railway config pull` in a SEPARATE clean checkout. Compare the imported file, all build/start commands, and `preserve()` secret values to this candidate. Do not overwrite without review.
5. Run `railway config plan --out railway-plan.json` on the reviewed branch. Verify the exact environment ID, inspect all changes, and BLOCK any destructive or non-zero plan until the imported provider configuration matches. Never auto-apply.
6. Require current main SHA, exact head, merge-base, CI, and **one independent human GitHub approval** before release. Existing Governance ruleset currently has required_approving_review_count=0: correct that separate governance gate first.
7. Railway production is currently behind `main`; do not conflate a planned configuration with a verified deploy. Preserve Cloudflare Workers' separate release mechanism.

This repo's workflow runs a read-only CLI plan for owner-created same-repository PRs and uploads `railway-plan-review-only` evidence only when a plan succeeds. It rejects destructive/non-zero changes. It does not post a plan comment, and has no apply, merge, or deployment step. The repository's formal approval protections must be repaired separately; the founder's Auto merge click is the final merge authorization, not a substitute for an independent approving review.

Reference: https://docs.railway.com/infrastructure-as-code
