# Environment inventory

Use `.env.example`; never commit actual values. Separate customer-owned staging/production projects and provider secrets. Previews remain synthetic.

| Variable | Purpose |
|---|---|
| PERSISTENCE_MODE | local-synthetic or supabase-synthetic; hosted local mode refused |
| APP_ENV | local/staging/production label, not data approval |
| REAL_CV_DATA_ENABLED | false; true refuses workflow and consumer activation |
| APP_URL | Exact origin and invitation redirect; required hosted |
| WORKSPACE_ID | Workspace selected on server after verified membership |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Public connection configuration; grants/RLS still restrict data |
| SUPABASE_SERVICE_ROLE_KEY | Privileged server/setup only; never browser |
| AI_ENABLED / ANTHROPIC_API_KEY / AI_MODEL_ID | Direct synthetic inference, disabled by default; exact tested ID required |
| MONTHLY_PROCESSING_ALLOWANCE | Default 240 units; reservation, each attempt and each criteria draft consumes one. Not a supplier currency quote |
| PARSER_SNAPSHOT_ID / PARSER_BUNDLE_SHA256 | Exact dependency-only snapshot and verified bundle hash |
| VERCEL_OIDC_TOKEN | Sandbox controller authentication on Vercel; never parser env |
| VERCEL_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID | Optional explicit local Sandbox controller authentication |
| CRON_SECRET | Timing-safe protected queue/deletion recovery endpoint |
| BOOTSTRAP_ADMIN_USER_ID | Existing invited admin UUID for setup/restore |
| RESTORE_SYNTHETIC_CONFIRM | EMPTY TARGET for explicit isolated synthetic restore |

At most two 4,000-output-token calls per attempt, three automatic attempts, bounded input and monthly counters prevent unbounded processing. Manual retries consume the same allowance on each attempt. Set vendor spend limits/alerts and customer-approved budgets too. Counter configuration changes must be reviewed; this is not a guarantee of a particular bill.

A Claude subscription used for advice does not supply an Anthropic API key. Provider keys are consumed only by the configured direct route; no substitution with CLI assessment or OAuth credentials.
