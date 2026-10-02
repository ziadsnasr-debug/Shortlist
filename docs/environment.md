# Environment inventory

`.env.example` has names and safe mode defaults only. Actual secrets remain in local process environments or provider secret stores; never commit them.

| Variable | Use | Browser exposure |
|---|---|---|
| PERSISTENCE_MODE | `local-synthetic` or `supabase-synthetic` | Mode label only |
| APP_ENV | Environment label: local/staging/production; no real-data approval implied | No |
| REAL_CV_DATA_ENABLED | Must remain false; true refuses startup operations | No |
| APP_URL | Exact canonical app origin for mutation checks; required for hosted use | Origin only |
| WORKSPACE_ID | Server-selected workspace UUID from bootstrap | No role authority granted by UUID |
| NEXT_PUBLIC_SUPABASE_URL | Selected environment's Supabase endpoint | Public configuration |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public project key; still requires authenticated membership | Public configuration |
| SUPABASE_SERVICE_ROLE_KEY | Privileged server operations, never sent to browser | Never |
| ANTHROPIC_API_KEY | Stage 4 direct provider calls; unused today | Never |
| AI_MODEL_ID | Exact tested model identifier; no assumed Opus alias | No |
| VERCEL_OIDC_TOKEN | Stage 3 sandbox controller; unused today | Never |
| PARSER_SNAPSHOT_ID | Pinned dependency-only sandbox image; unused today | No |
| CRON_SECRET | Stage 3 queue endpoint protection; unused today | Never |
| BOOTSTRAP_ADMIN_USER_ID | Setup process only, existing invited administrator | No |

Use separate Supabase projects and provider secrets for staging and production. Vercel previews remain synthetic with staging-only secrets; do not share production applicant databases with preview branches. Service credentials can bypass RLS and must be treated as privileged credentials.

The current parser snapshot and inference modules do not consume credentials, and no external provider cost has been incurred by this build. Changing keys alone does not certify a provider's capabilities, retention or geography.
