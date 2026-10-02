# Phase 2 status - operations visibility and intake progress

Implemented on the Phase 2 branch:

- Administration remains the only surface for operational diagnostics.
- Retained documents are fetched through the existing exact-count paginator,
  scoped to the active workspace.
- Document status is presented as an honest stage: awaiting upload, queued,
  explicit processing, ready, needs readable copy, or attention.
- Attempt counts and reservation age are visible. Reservation age is labelled
  as reservation age and is not presented as queue age or a service-level
  target.
- Deletion administration includes ready_after, labelled as the earliest safe
  completion time and explicitly not an SLA.
- Intake shows upload, queue, processing and review readiness steps and
  exposes refresh/network failures with a retryable refresh control.
- Deleted documents are excluded from retained operational lists.

Validation:

- tests/operation-status.test.ts: stage mapping, retry/attention handling,
  safe error wording, age formatting and summary counts.
- npm run typecheck
- npm run lint
- npm test: 120 unit tests passed.
- Root agent still owns the full build, browser and persistent integration
  validation after the parallel UI merge.

The phase does not add a timestamp migration, retention automation,
notifications, a dashboard or charts. A document with queued status and
prior attempts remains queued because attempts do not prove that a worker is
currently running; explicit processing status is required for that label.

Root exit gates passed: final production build, 120 unit tests, all 17 browser tests (including self-contained upload failure/progress tests), typecheck/lint, local MFA/access/queue/deletion/backup/restore integration and actual persistent local PDF/DOCX → managed parser/OpenAI → human review → finalisation/export/reload. Astra final static review: NO FINDINGS. Browser test teardown waits for pending route handlers; no ignored fixture files are required on CI. Hosted Phase 2 runtime verification follows deployment; Phase 1 hosted acceptance remains separately recorded.
