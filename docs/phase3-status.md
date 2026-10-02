# Phase 3 — Retention preview and deletion holds

Phase 3 adds a versioned retention proposal and auditable workspace or
application holds. It does not add automatic deletion. `automation_enabled`
is database-constrained to `false`; the existing `settings.retentionDays` is
legacy display data and is not a deletion input.

The preview is `not_configured` until an administrator saves an explicit
hypothetical number of days. Its only supported start event is
`batch_finalised_at`, and its dates are labelled hypothetical. It returns
application keys, dates and hold state only; no names, source text or original
files are returned.

Hold placement, release and application-content deletion lock the same
workspace state row. An active workspace or application hold rejects deletion
without mutation. A completed deletion ledger rejects a later application
hold. Releasing a hold never recreates deleted content. Pending signed-upload
token expiry and the final storage sweep remain governed by the deletion
ledger's `ready_after` guard.

Recovery exports policy history and hold history with the current deletion
ledger. The export checks the lifecycle revision before and after collection.
Restore rejects missing, incomplete, stale or foreign lifecycle manifests,
applies current deletions first, restores paused, and writes automation as
disabled. Historical Auth actors are retained as source-actor identifiers in a
safe restore audit event because a fresh target must not attribute their old
actions to its bootstrap administrator.

Customer decisions required before any future activation: retention period and
scope, lawful start event and treatment of existing records, authorised hold
placement/release, exports and backup copies, audit retention, UK data route,
incident owner and scheduled-job ownership. No scheduled purge exists.

Validated locally: 134 unit tests, 59 browser cases, production build/typecheck/lint, actual admin draft/place/release API, and full fictional PDF/DOCX managed-parser/OpenAI review/finalisation/export acceptance. Database integration checks direct table/RPC denial, disabled policy, hold/delete serialization, released holds, newer active holds after backup, absent-backup application key enforcement, incomplete/stale lifecycle manifest rejection, current deletion precedence, object hashing and paused restore. Astra final static review: NO FINDINGS. Hosted runtime evidence is recorded separately after deployment. Holds block future logical deletions; already committed deletions continue pending file cleanup.
