# Shortlist

UK employer CV review POC for roughly 15–20 CVs per week. AI classifies evidence; deterministic code computes points; a recruiter reviews every active application and chooses zero to three candidates.

**Synthetic only. Real uploads and inference are disabled.** Stage 1 workflow is implemented. Stage 2 persistence/ownership foundation is implemented and verified against local Supabase. Stages 3–6 remain gated.

## Run locally

Use Node.js 22 or newer and npm. No provider credentials required for local synthetic mode.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Publish the example criteria, add six fictional CVs, close intake, review each CV, resolve the disagreement and source flag, select candidates, explain any boundary tie and finalise. `Save criteria draft` saves edits before publication. Individual checks are required for essentials, disputed results and changes. No batch approval exists.

The local demonstration persists synthetic workspace state on the server under ignored `work/synthetic-state/`, keyed by an opaque HTTP-only cookie. It supports one local Node process. It is not a distributed storage solution and is refused on Vercel. No CVs or keys are kept in browser local storage.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

For local Supabase integration, Docker and the Supabase CLI are required:

```sh
supabase start
npm run test:integration
```

The integration harness reads local CLI credentials into process memory only, creates disposable synthetic users, tests MFA and ownership, starts a temporary production server and cleans up its own fixtures. It refuses a remote Supabase URL. It never prints keys, passwords or auth responses. Normal CLI status may display local keys: do not paste it into reports or logs.

## Canonical inputs

`docs/inputs/Technical_Specification.docx` is **Version 1.2, 2 October 2026**, with mandatory Appendix A. Both matching `(1)` and `(2)` downloads have identical extracted text. The local unsuffixed download was Version 1.0 and was not used. `docs/inputs/Interface_Prototype.html` is the supplied four-step companion. Inputs are reference material, not running application code. [Provenance](docs/specification.md) records hashes and source boundaries.

## Ownership and handover

Use separate local, synthetic staging and future production projects. Accounts and billing ultimately belong to the customer. No account, domain, project UUID or model identifier is hardcoded. Generic bucket and queue names describe application resources, not vendor accounts.

- [Architecture and persistence boundaries](docs/architecture.md)
- [Environment variables](docs/environment.md)
- [Fresh deployment and handover](docs/deployment.md)
- [Six-stage plan and remaining work](docs/status.md)
- [Mandatory security controls and real-data gate](docs/security.md)
- [Customer decisions](docs/customer-decisions.md)

Source is provided for review. Code ownership and support terms remain to be agreed; this repository declares `UNLICENSED`, not an unsolicited open-source grant. Dependency license inventory is recorded separately before customer acceptance.
