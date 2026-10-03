# Environment inventory

Use `.env.example`; never commit actual values. Separate customer-owned staging/production projects and provider secrets. Previews remain synthetic.

| Variable                                                 | Purpose                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PERSISTENCE_MODE                                         | local-synthetic or supabase-synthetic; hosted local mode refused                                                                           |
| APP_ENV                                                  | local/staging/production label, not data approval                                                                                          |
| REAL_CV_DATA_ENABLED                                     | false; true refuses workflow and consumer activation                                                                                       |
| APP_URL                                                  | Exact origin and invitation redirect; required hosted                                                                                      |
| WORKSPACE_ID                                             | Workspace selected on server after verified membership                                                                                     |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Public connection configuration; grants/RLS still restrict data                                                                            |
| SUPABASE_SERVICE_ROLE_KEY                                | Privileged server/setup only; never browser                                                                                                |
| AI_ENABLED / OPENAI_API_KEY / AI_MODEL_ID                | Direct OpenAI synthetic inference, disabled by default; exact tested ID required                                                           |
| MONTHLY_PROCESSING_ALLOWANCE                             | Default 240; validated integer 1–1000 units. Reservation, each attempt and each criteria draft consumes one. Not a supplier currency quote |
| PARSER_SNAPSHOT_ID / PARSER_BUNDLE_SHA256                | Exact dependency-only snapshot and verified bundle hash                                                                                    |
| VERCEL_OIDC_TOKEN                                        | Sandbox controller authentication on Vercel; never parser env                                                                              |
| VERCEL_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID        | Optional explicit local Sandbox controller authentication                                                                                  |
| CRON_SECRET                                              | Timing-safe protected queue/deletion recovery endpoint                                                                                     |
| BOOTSTRAP_ADMIN_USER_ID                                  | Existing invited admin UUID for setup/restore                                                                                              |
| RESTORE_SYNTHETIC_CONFIRM                                | EMPTY TARGET for explicit isolated synthetic restore                                                                                       |

At most two 4,000-output-token calls per attempt, three automatic attempts, bounded input and monthly counters prevent unbounded processing. Manual retries consume the same allowance on each attempt. Set vendor spend limits/alerts and customer-approved budgets too. Counter configuration changes must be reviewed; this is not a guarantee of a particular bill.

A Claude or ChatGPT subscription used for advice does not supply an OpenAI API key. Provider keys are consumed only by the configured direct route; no substitution with CLI assessment or OAuth credentials.

Run static configuration preflight explicitly with private values loaded: `node --env-file=.env.local --import tsx scripts/preflight.ts --check`. The administrator-only `/api/readiness` returns names/statuses with private no-store headers. Passing is configuration evidence, not live dependency verification, production approval or real-data activation.

Preflight also checks active temporary fictional public access: synthetic persistence, explicit real-data refusal, expiry and actor format. An expired valid pilot returns to normal authentication. It does not verify the actor's current membership; live requests enforce membership.

For public HTTP checks, set `SHORTLIST_HOSTED_URL` to the exact approved HTTPS origin and run `npm run test:hosted-smoke`. Normal mode expects a login page and protected readiness. Only during an approved active fictional public pilot add `HOSTED_EXPECT_TEMPORARY_PUBLIC=true`; this explicitly expects the app redirect and denies readiness, administration and retention. A mode mismatch fails. These checks perform no writes or inference and do not establish model quality or MFA coverage.

`LOCAL_AUTH_BYPASS` defaults false; temporary synthetic loopback convenience only. `LOCAL_AUTH_USER_ID` selects an existing local member through private configuration, not a browser parameter. Hosted/staging/production/remote origins refuse it; membership revocation and role enforcement remain active. Authentication test servers explicitly disable it.

Temporary hosted fictional access is separate from the local bypass: `TEMP_PUBLIC_ACCESS=false` by default. An explicitly enabled shared pilot requires a future ISO `TEMP_PUBLIC_ACCESS_UNTIL`, a dedicated active member `TEMP_PUBLIC_ACTOR_ID`, hosted synthetic persistence and `REAL_CV_DATA_ENABLED=false`. Administration, invitations, readiness and retention routes deny this mode. Expiry restores account/MFA access; set false and redeploy to end it early. Never share real applicant data through this mode.

Node is pinned to `22.x` for Vercel and CI, with `.nvmrc` for local version selection. Minor/security patches remain provider-managed; changing the major requires rerunning acceptance. See [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Hosted acceptance can additionally exercise an image-only fictional PDF and checked manual transcription with `HOSTED_INCLUDE_MANUAL_FAILURE=true npm run test:hosted -- <private-hosted-env>`, alongside the explicit fictional confirmation and public-mode setting above. The original parser/OpenAI/review/export checks remain mandatory; the optional case verifies unreadable intake gating and manual evidence provenance. The export uses harmless formula-shaped text to check inert CSV output.
