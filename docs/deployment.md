# Fresh synthetic deployment and customer handover

This recipe deploys a fresh **synthetic** instance. Real applicant data remains blocked until docs/security.md gates pass. No developer-owned identifiers need editing in source.

1. Customer creates and owns Git repository, Vercel team/project, Supabase organisation/project, AI provider account, billing and domain. Invite developer temporarily; never share owner passwords.
2. Create an isolated Supabase project in the verified London region. Disable public signup, enable TOTP MFA, configure the approved authentication email sender and exact site/redirect URLs. Do not add wildcard redirects. Record support/log/backup geography too.
3. Apply migrations from a clean database. Install Supabase CLI, then use `supabase link --project-ref <customer-project-ref>` and `supabase db push`. Authenticate securely; do not place access tokens in committed scripts. Check migration ledger and deployment output.
4. Using the Supabase administrator interface, invite the first customer administrator and complete account/password setup. This is manual provisioning at present; the in-app invitation management screen remains Stage 2 work.
5. Set the URL, public key, server service key and `BOOTSTRAP_ADMIN_USER_ID` in your process environment. Run `npm ci` then `npm run bootstrap`. This prints only the new non-secret workspace UUID. Do not rerun blindly: bootstrap creates a new workspace and is not an idempotent recovery command. If a setup step fails, inspect and repair its partial records before retrying.
6. Set returned `WORKSPACE_ID`, `PERSISTENCE_MODE=supabase-synthetic`, `APP_ENV=staging`, `REAL_CV_DATA_ENABLED=false`, and the exact hosted `APP_URL` in Vercel. Set Supabase secrets in the correct environment only. Import repository, use the default Next.js build and verify `vercel.json` requests `lhr1`. Preview domains need their own origin setting.
7. Sign in through `/login`, enrol/verify authenticator, and complete a synthetic batch. Provision a second invited reviewer and create its active `workspace_members` row with reviewer role using the privileged administrator interface. Never use editable auth metadata as a role source.
8. Demonstrate second-reviewer resume, member revocation, outsider denial, denied direct Data API writes, immutable final snapshots and export headers against the hosted release. Local tests do not establish hosted region or ownership settings.
9. Record release manifest and tag only after review. Stage 3 adds sandbox snapshot build, denied-network proof and queue cron wiring. Do not schedule an endpoint that does not yet exist.

## Rollback

Keep prior source release and migration ledger. Use reviewed forward migrations for data changes; do not reset a populated production database. Roll back frontend only when schema remains compatible. Pause future intake/inference during incidents rather than deleting evidence. Operational pause UI is not implemented yet.

## Acceptance and restore (Stage 6)

Another person must deploy from a clean checkout into their own accounts, review/export/delete a synthetic batch and restore a disposable backup. Back up database **and storage objects**; Supabase database backups alone do not include stored CV objects. Compare row counts and object hashes, then reapply deletion ledger entries before access resumes. These exercises have not been performed.

Agree source ownership, dependency licences, support period, retention and incident responsibilities. Hand over recovery access securely. Rotate relevant secrets and remove developer access after acceptance. A source ZIP or Git repository does not transfer cloud resources or billing.

Official implementation references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Queues](https://supabase.com/docs/guides/queues/quickstart), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [shadcn/ui](https://ui.shadcn.com/docs/installation/next). Revalidate vendor settings at deployment.
