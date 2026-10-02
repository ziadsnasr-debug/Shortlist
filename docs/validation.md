# Validation — 2 October 2026

All actual test data is fictional.

- 61 unit tests: workflow/scoring/state, unreadable/manual handling, exact source/model contracts, actual generated PDF/DOCX/table extraction, scans/malformed archives/page/expanded-byte limits, minimization swaps, sandbox cleanup/hash/denied options with mock transport, bounded two-pass mocked AI, evaluation denominator/timing guards and deletion reapplication.
- Six production-browser tests: full six-CV finalisation/tie/export/reload; stale/origin denial; 390/640px layouts; keyboard dialog; hostile criteria text inert/no remote request/embed; unauthenticated/forged cron denial. Axe scans Criteria, Intake, Review and Shortlist during the full workflow.
- Local Supabase: nine migrations applied; MFA AAL1 denial/AAL2 access; membership/removed/outsider/direct-write/role/forged-storage denial; second-reviewer resume; last-admin/rate/invitation/settings checks; normalized projection; versioned reservation; private signed upload/outsider download denial; pgmq; atomic completion/redelivery/single run/missing-key denial/exhausted-worker recovery; deletion during processing and restored-content denial.
- Actual local backup/restoration: two private PDF objects and database content backed up; newer deletion ledger exported; empty workspace target restored; retained object rehashed and row count checked; deleted object/content excluded; target remains paused. These are local synthetic exercises, not hosted disaster recovery or independent customer acceptance.

Final typecheck, lint, production build, parser bundle build and dependency audit passed (zero known advisories). Source secret scan is recorded in the handover package. Remote CI/cloud deployment has not run.

Fixes caught by tests: reservation SQL variable ambiguity, missing private pgmq server grants and transient notification contrast, missing completion-key rejection and worker exhaustion after interruption. Required checks remained enabled. Scores were further hidden server-side until all reviews; tests now assert absence before the gate.

Limits: narrow viewport is a layout equivalence check, not actual browser zoom/assistive-technology certification. No actual managed parser snapshot/cloud network-resource probe, real model calls, model semantic/injection evaluation, hosted invitations/geography or timed recruiter pilot. Forty-five fixtures and twenty pairs are prepared, with independent labels pending. Mocked outputs are not model accuracy results. No real-data readiness, fairness or general security certification.
