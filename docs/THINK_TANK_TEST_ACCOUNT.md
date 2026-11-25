# Think Tank dedicated QA test account — proposed, not created

## Reference and identity

The TruthWeaver precedent used `test-user-tw@jussco.company`, but a later migration **revoked a hardcoded merchant-role grant** to that email. Copy the dedicated QA identity pattern, not the privileged-role shortcut.

**Proposed only, not created:** `test-user-tt@jussco.company`. This address is a candidate, not a verified mailbox or an existing account. Do not claim signup, an OTP, email confirmation, or a login occurred until separately witnessed. No passwords, verification codes, API keys, test-user refresh tokens, or real customer data belong in source control, GitHub issues, PR comments, or CI logs.

## Two separate authentication boundaries

1. **Cloudflare Access (private origin).** `https://thinktank-app.jussco.company/` is founder-only. A new QA user must **not** be added to the existing three-owner production Allow policy. A verified QA mailbox may be used as an *unauthorized identity* to demonstrate Access denial. Use one of the existing authorized founder identities for the positive owner sign-in witness. Neither test should bypass Cloudflare Access.
2. **Supabase Auth (future public customer account).** The public `https://thinktank.jussco.company/` is intentionally open; its customer account API is a separate proposed integration. The 2026-11-25 live `/api/auth/me` check returned HTTP 404, so a functioning public customer test account **cannot be claimed as deployed**. When the approved customer-auth release has its own isolated testing environment, use an ordinary verified QA user with **no founder privilege**, no merchant privilege, no production administrator role, and no payment entitlements.

## Account provisioning and proof gates

1. The founder confirms control of a routable, verified mailbox for the proposed QA alias or supplies another dedicated QA address. **A name in a migration is not evidence of a real inbox.** Do not reconfigure mail routing to an unconfirmed destination.
2. An authorized operator creates the QA identity using the authentication provider's supported signup or admin interface in an isolated, approved test environment. Email verification must succeed; no direct `auth.users` SQL write, test-only superuser role, or hardcoded production role grant is permitted.
3. Use synthetic data only. Test successful QA customer signup/login in the test environment, session expiration/logout, recovery, and tenant A versus B isolation with a second isolated test identity, if applicable. The customer account must never gain access to the private founder origin.
4. Independently witness an allowed **existing owner** Cloudflare Access login at the protected origin and an unauthorized QA identity being denied. Record the status, timestamp, application ID and exact test scope without printing identities, passwords, cookies, or tokens.
5. Execute the existing manual GitHub `Think Tank Access Boundary (read-only)` workflow with `verify_owner_login=true` after a real owner login is recorded. The optional receipt reads Access audit logs using read-scoped GitHub secrets and fails closed without recent evidence. It is not proof of a fully functioning post-login application.
6. Confirm no direct test-account role grants are present in database migrations; verify account permissions are scoped to the test project or ordinary customer role.

## End state and rollback

**Current state: only a QA identity plan and guard tests; no real account created or verified mailbox confirmed.** Do not automatically delete an identity, test data, or email aliases. At the end of testing, record whether the operator explicitly approved revoking sessions, removing temporary Access grants (if any), and deleting the QA identity. Rollback and deletion require separate approval. Keep the public Cloudflare Worker bypass and the founder-only private policy unchanged throughout.
