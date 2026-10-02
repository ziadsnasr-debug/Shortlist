# Shortlist

UK employer CV evidence-review POC, built from Version 1.2 (2 October 2026) and companion prototype in docs/inputs. Next.js, React, TypeScript, Tailwind/shadcn, Supabase and a managed TypeScript parser. Synthetic data only; real-data activation is refused.

Criteria → Add CVs → Review → Shortlist. Configurable published 100-point rubric; AI classifies evidence only; deterministic half-point scoring; every active CV human-reviewed; ranking/names hidden until reviews complete; zero-to-three selection; tie/essential reasons; no reopening finalised decisions. Authorized content deletion is separate from adjudication.

## Local workflow

Node 22.x; `npm ci`, `npm run dev -- --port 3218`; open http://127.0.0.1:3218. No cloud keys needed for six fictional sample CVs. Local server-only JSON is a synthetic demonstration, not production ownership.

## Persistent local app

Start isolated local Supabase using `supabase start`, then `npm run local:setup`. This writes ignored owner credentials and `.env.local` with local-only database keys; keep those files private. Put your OpenAI key in `.env.local` under `OPENAI_API_KEY`, select the tested exact model with `AI_MODEL_ID`, and enable `AI_ENABLED=true` only for fictional testing. Enrol the local owner using `npm run local:authenticator`.

Link your own Vercel project, pull its development OIDC into ignored `.env.vercel-auth.local`, build/create the parser snapshot and pin its metadata in `.env.local`. Run `npm run build` then `npm run local:start`. Originals stay in your local folder; uploads are private local Supabase copies, temporarily parsed in Vercel. OpenAI receives minimised text. Review every CV before selecting up to three suggestions.

Both the persistent local app and a dedicated free hosted synthetic instance are available. The hosted fictional pilot has passed complete upload-to-export acceptance; details and temporary public-access limits are in `docs/hosted-setup.md`. Fresh customer deployment uses separate accounts and keys as described in `docs/deployment.md`. Real CVs remain disabled.

## Checks and tooling

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. With isolated local Supabase running, `npm run test:integration` creates/cleans disposable fictional users and tests ownership, queue/deletion and actual object/database restore. Never point that harness at cloud data. `npm run test:recovery` separately verifies 1,005-record pagination, abandoned reservations, fresh-target reviewer reconciliation and queued restore.

`npm run parser:build` creates dependency-only bundle/hash. `npm run parser:snapshot` requires the intended authenticated Vercel project and executes isolation probes. `npm run provider:spike` requires an approved direct API key/exact model and fictional data. Actual parser isolation probes and the live OpenAI two-pass synthetic spike passed; semantic accuracy and customer acceptance remain pending.

`npm run evaluation` generates the unassessed 45-fixture/20-pair fictional pack under ignored outputs/evaluation; writes refuse overwrite. Use `EVALUATION_OUTPUT_DIR` for a fresh run directory. `npm run evaluation -- metrics <independent-labelled-results.json>` computes descriptive metrics. Frozen `seal`/`assess` commands require complete independent records and a separately retained release digest; see `docs/phase4-evaluation.md`. Mock evidence never passes release assessment.

`npm run backup`, `npm run ledger:export` and `npm run restore` support protected synthetic-only recovery; read deployment guide before use.

## Handover

See docs/status.md for stage exits; docs/deployment.md for fresh accounts/environment/migrations/snapshot/cron/recovery; docs/environment.md for variable inventory; docs/architecture.md; docs/security.md (mandatory SEC01–SEC12); docs/validation.md; docs/customer-decisions.md; docs/reviewer-guide.md. Lockfile and license inventory accompany source. No provider account identifiers or secrets are embedded.

Local tests do not establish hosted isolation, model accuracy, human usefulness or customer acceptance. These external gates remain required before real CVs.

Backend priorities and remaining exit gates: docs/backend-plan.md. Static private configuration preflight is available through scripts/preflight.ts (`--check`); keys are never included in its output.

Developer-only Jev comparison: docs/jev-evaluation.md. The active evidence provider remains OpenAI; the experiment never switches deployment configuration.

Temporary local-only login bypass: set `LOCAL_AUTH_BYPASS=true` and `LOCAL_AUTH_USER_ID` to an existing local administrator UUID in ignored `.env.local`. Requires local environment and loopback app/database origins; active membership and roles are still checked. Set bypass false to restore login/MFA. Never use with real CVs or hosted deployments.
