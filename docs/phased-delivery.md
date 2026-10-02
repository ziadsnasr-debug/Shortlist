# Sequential delivery plan

Canonical V1.2 and Appendix A remain authoritative. Every phase must implement its scope, run its relevant tests, fix failures and record review evidence before the next phase starts. Commit, push and merge each major phase after passing checks. Synthetic data only; real-data activation and independent customer acceptance are separate gates.

## Phase 1 — Reconcile environments and prove synthetic acceptance

Reconcile hosted setup against current evidence. Preserve local synthetic bypass and hosted MFA. Test the complete upload, parser, AI classification, human review, hidden ranking, finalisation and export workflow in the relevant environment. An unauthenticated smoke probe does not substitute for authenticated hosted acceptance. If that acceptance is blocked, record the missing prerequisite and hold the next phase.

## Phase 2 — Administration visibility and intake progress

Keep operations inside Administration, as required by the specification. Show safe errors, processing attempts and accurate timestamps. Reservation age is not queue age; deletion ready_after is earliest safe completion, not an SLA. Distinguish file transfer from queued processing and assessment. Verify interrupted/failed uploads remain visible, pause/access boundaries, duplicate finalisation and retry fencing.

## Phase 3 — Disabled retention preview and transaction-enforced holds

Implement auditable controls and dry-run preview with automation disabled. Customer must define artifact periods, clock-start event, existing-record treatment, hold authority/scope/release, exports, backups and audit retention before activation. Enforce holds in locked deletion transactions, preserve policy/holds in recovery, and restore paused with automation disabled. Avoid overwriting policy through the existing three-field workspace settings form. Test concurrent deletion/hold, access restrictions and backup/restore.

## Phase 4 — Vacancy templates and complete evaluation gates

Copy templates into unpublished rubrics with fresh IDs and existing validation; never propagate edits into published/finalised batches. Freeze fixture coverage, independent labels, configuration and approved thresholds in an immutable evaluation manifest. Missing labels, coverage, role evidence, repeated/adversarial runs or timings produce not-assessed, never passed. Configuration changes invalidate applicability of old results. Jev remains experimental.

## Release acceptance

Independent recruiter review, privacy/data-route approvals, operational ownership and another operator deployment/restore remain required. Tests validate software behaviour; they do not establish recruitment accuracy, fairness or real-CV permission.
