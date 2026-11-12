# Railway IaC adoption, review-only

Authoritative Railway project: Think Tank, production environment. This repository currently owns the only Railway service in that environment, so this is a full-project file with no named partial. It is NOT yet proven to be an exact provider import.

1. Use a production-environment-scoped `RAILWAY_TOKEN` secret in GitHub. Never paste or commit it.
2. In an authenticated Railway CLI checkout run `railway link --project 45b0d932-d46f-495c-9a32-c4c76bfa92f1 --environment 34e49116-9464-4e85-bdf7-fa417c20f6b7`.
3. Run `railway config partials list --json`; STOP if named partials already own the environment.
4. Run `railway config pull` in a SEPARATE clean checkout. Compare the imported file, all build/start commands, and `preserve()` secret values to this candidate. Do not overwrite without review.
5. Run `railway config plan --detailed-exit-code` on the reviewed branch. Exit 0 = no drift, exit 2 = pending change and BLOCKED. Never auto-apply.
6. Require current main SHA, exact head, merge-base, CI, and **one independent human GitHub approval** before release. Existing Governance ruleset currently has required_approving_review_count=0: correct that separate governance gate first.
7. Railway production is currently behind `main`; do not conflate a planned configuration with a verified deploy. Preserve Cloudflare Workers' separate release mechanism.

This repo's new workflow ONLY generates a plan comment for owner-created same-repository PRs. It has no apply job.

Reference: https://docs.railway.com/infrastructure-as-code
