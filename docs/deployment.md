# Fresh synthetic deployment and handover

Another customer can deploy the source without developer account identifiers. Real applicant use remains blocked.

1. Own the Git repository, Vercel project, isolated Supabase project and AI account. Existing unrelated production projects must not receive Shortlist migrations. Verify Supabase London, actual Vercel execution/failover and all service data arrangements.
2. Disable public signup; enable TOTP MFA; approve/configure the authentication sender and exact APP_URL/auth/confirm redirect. Invite the first administrator through Supabase; configure process-only keys and BOOTSTRAP_ADMIN_USER_ID.
3. Install dependencies from lockfile, link the intended clean Supabase project and apply migrations. Check migration ledger/advisors. `npm run bootstrap` creates one workspace and prints its non-secret ID. It is not an idempotent repair command.
4. Configure isolated hosted secrets: supabase-synthetic, exact APP_URL, WORKSPACE_ID, APP_ENV=staging and REAL_CV_DATA_ENABLED=false. Verify login/MFA; Administration invites additional reviewers, manages access, pause, approved retention and incident owner.
5. Build parser artifact; create dependency-only snapshot in intended Vercel project with `npm run parser:snapshot`. Record/pin ID and bundle hash; verify real DNS/network/canary/resource probes. Supply PARSER_SNAPSHOT_ID and PARSER_BUNDLE_SHA256 to server only. No secret enters the VM.
6. Set CRON_SECRET, tested function limits and cron plan. vercel.json requests lhr1 and daily 06:00 UTC recovery (Hobby-compatible). Upload-finalisation also triggers after-response processing. Verify 240-second function/360-second visibility against deployed plan; cron is not a permanent worker. Administrators can run bounded, audited Process pending files recovery.
7. Keep AI disabled until `npm run provider:spike` passes with the exact direct model and synthetic data. Set AI_ENABLED and model/key only after account/data route approval. No gateway or overseas fallback. Missing calls remain manual UNCLEAR work.
8. Upload generated fictional PDF/DOCX, inspect failure/manual routes, close intake, review every CV and finalise zero-to-three. Test second-reviewer resume, revoked/outsider access, foreign file IDs, private download/export, concurrent edits, queue faults and immutability.
9. Run npm test, typecheck, lint, build, test:e2e and isolated test:integration; review manifest/dependency notices and secret scan. Evaluation tool generates 45 fixtures/20 pairs and an independent-label template. Customer agrees actual roles/thresholds before tuning.
10. Perform independent customer deployment/operation, timed/semantic model gates and customer acceptance. Agree ownership, support, training and incident responsibilities; rotate appropriate secrets and remove developer access after acceptance.

## Recovery

Synthetic backup: `npm run backup -- <protected-directory>`. It includes aggregate, normalized records, safe audit, private objects/hashes and ledger; Auth secrets are excluded. Stop edits during backup; version changes cause failure. Keep access-restricted/encrypted copies per approved policy.

Export a newer deletion ledger separately: `npm run ledger:export -- <protected-path>`. Restore requires that ledger; an old backup's deletion list is insufficient.

In an isolated empty target with migrations/admin user ready: configure target keys, BOOTSTRAP_ADMIN_USER_ID and RESTORE_SYNTHETIC_CONFIRM=EMPTY TARGET; `npm run restore -- <backup-directory> <current-ledger>`. Overwrites are refused; object/ownership hashes are checked; known deletions are filtered; target remains paused. Reconcile historical reviewer attribution and compare DB counts/object hashes before access resumes. Tools cover synthetic-only recovery, not a general Supabase account migration.

Use reviewed forward migrations and compatible source rollback. Never reset populated production data. Pause intake/inference during incidents; preserve necessary audit records, revoke access, investigate and follow customer-approved advice/notification process. Failed object deletions stay visible and recover via cron. Retention settings record the approved period; this build does not silently schedule blanket retention purges or override legal holds. Administrator must operate the approved retention/export/backup lifecycle.

Official references: [Sandbox SDK](https://vercel.com/docs/sandbox/sdk-reference), [Structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data), [Supabase private storage](https://supabase.com/docs/guides/storage/security/access-control), [Queues](https://supabase.com/docs/guides/queues/pgmq). Revalidate account/region capabilities at deployment.
