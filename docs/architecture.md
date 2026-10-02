# Architecture

One Next.js App Router application, React, TypeScript, Tailwind CSS and upstream shadcn/ui components. No Python worker, autonomous agent, vector store or custom queue lease service.

## Authoritative workflow

`lib/workflow.ts` holds pure scoring and transition rules. Maximum points are positive integers totalling 100; score uses integer half-point arithmetic. UNCLEAR has no numeric value. Official scores exist only after valid application-level confirmation. Credited categories require current-document source references. Model agreement is not semantic proof.

`app/api/workspace/route.ts` parses a strict action contract and checks session ownership and origin on every request. Client code cannot submit an official score, review timestamp or frozen snapshot. Responses remove identities until every active application is reviewed and an explicit reveal is requested. Comparative ranking is absent from responses before the whole-batch gate. Individual scores appear after that application is confirmed.

Published rubrics freeze. Intake closes explicitly. Only reasoned duplicate, withdrawal or wrong-vacancy dispositions are accepted before closure. Changes clear application confirmation and provisional selections. Finalisation rechecks every gate, selection count, reasons, ties and essential exceptions. Frozen snapshots include effective assessments, source context and reviewed versions. Exports read snapshots and neutralise spreadsheet formulas.

## Stage 2 synthetic persistence

Local mode stores server JSON with atomic rename and a per-workspace process lock. Supabase mode uses invitation-created Auth accounts, mandatory AAL2, active workspace membership and trusted database roles. Server-only service credentials never enter browser code. A service credential bypasses RLS, so every operation explicitly checks membership before database access.

A transitional `synthetic_workspaces` aggregate stores the small synthetic workflow. Optimistic version matching is checked both in TypeScript and a locking Postgres RPC. The RPC checks active membership and administrator-only operations, freezes entire finalised batches and appends an audit event within the same transaction. Direct authenticated reads/writes to the aggregate and RPC are denied. This prevents hidden names or ranking leaking through the Data API.

Normalized relations from specification section 8 are created for Stage 3. They are currently deny-by-default to clients and **are not populated by the synthetic workflow**. They must replace the aggregate before real document processing. Do not claim production document persistence from existence of those tables.

The private `cv-originals` bucket has a 5 MiB limit and MIME bounds, with no browser policies yet. Pgmq creates one private durable queue. There is no upload endpoint, parser execution, consumer, cron or document preview URL. Their absence is deliberate until Stage 3 isolation is demonstrated.

## AI boundary

`lib/config.ts` centralises provider, tested model ID, prompt/schema versions, two-pass intent, timeout and output bounds. AI is disabled; there is no default model alias. `lib/assessment.ts` validates exact criterion sets, categories, 25-word rationale limits and current evidence IDs. Invalid or disagreeing passes become UNCLEAR. It does not validate semantic truth or invoke a provider.

Stage 4 implements direct Anthropic provider objects using `generateText` and `Output.object`, after account/capability/region verification. No gateway, tools, browsing, fallback provider or shared applicant context. Synthetic suggestions in Stage 1 are labelled preset practice data; they are not simulated live success.

## Hosting

`vercel.json` requests London (`lhr1`). Next.js route-level `preferredRegion` is deprecated in the installed version, so region belongs in deployment configuration. Customer must verify actual execution geography and failover policy. A deployment setting is not a UK-exclusive processing guarantee.

Production scripts use per-request nonce CSP and private no-store headers. Text rendering stays escaped. Inline style allowance exists for component styling; script allowance uses nonces rather than unsafe-inline. Do not add analytics or session replay to applicant surfaces.
