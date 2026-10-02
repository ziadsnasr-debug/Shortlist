# Shortlist

UK employer CV evidence-review POC, built from Version 1.2 (2 October 2026) and companion prototype in docs/inputs. Next.js, React, TypeScript, Tailwind/shadcn, Supabase and a managed TypeScript parser. Synthetic data only; real-data activation is refused.

Criteria → Add CVs → Review → Shortlist. Configurable published 100-point rubric; AI classifies evidence only; deterministic half-point scoring; every active CV human-reviewed; ranking/names hidden until reviews complete; zero-to-three selection; tie/essential reasons; no reopening finalised decisions. Authorized content deletion is separate from adjudication.

## Local workflow

Node 22+; `npm ci`, `npm run dev -- --port 3218`; open http://127.0.0.1:3218. No cloud keys needed for six fictional sample CVs. Local server-only JSON is a synthetic demonstration, not production ownership.

## Checks and tooling

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`. With isolated local Supabase running, `npm run test:integration` creates/cleans disposable fictional users and tests ownership, queue/deletion and actual object/database restore. Never point that harness at cloud data.

`npm run parser:build` creates dependency-only bundle/hash. `npm run parser:snapshot` requires the intended authenticated Vercel project and executes isolation probes. `npm run provider:spike` requires an approved direct API key/exact model and fictional data. Neither cloud capability has been verified here.

`npm run evaluation` generates 45 fixtures/20 pairs and label template under ignored outputs/evaluation. `npm run evaluation -- <independent-labelled-results.json>` computes metrics, not full release approval.

`npm run backup`, `npm run ledger:export` and `npm run restore` support protected synthetic-only recovery; read deployment guide before use.

## Handover

See docs/status.md for stage exits; docs/deployment.md for fresh accounts/environment/migrations/snapshot/cron/recovery; docs/environment.md for variable inventory; docs/architecture.md; docs/security.md (mandatory SEC01–SEC12); docs/validation.md; docs/customer-decisions.md; docs/reviewer-guide.md. Lockfile and license inventory accompany source. No provider account identifiers or secrets are embedded.

Local tests do not establish hosted isolation, model accuracy, human usefulness or customer acceptance. These external gates remain required before real CVs.
