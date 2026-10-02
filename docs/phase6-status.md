# Phase 6 — Recovery deadlines and release evidence

A slow consumer could exhaust its own deadline at precisely the deletion worker's latest start time. Recovery needs an actual start window after processing, with one outer deadline and shared budget constants. Queue failure must not suppress otherwise available deletion recovery. No token-expiry, hold or idempotence boundary is relaxed.

The old checked-in generated release manifest named a historical commit and local Node runtime. `npm run manifest` now produces ignored `outputs/release-manifest.json` against the current Git revision and reports tracked modifications. It identifies generator runtime and required Node 22 separately; it does not claim hosted-runtime verification or test/acceptance success. Produce the artifact after checking out the immutable release revision, then retain deployment and test evidence separately.

Validation and delivery evidence will be recorded after the phase checks.

Phase 5 was merged as PR #23 (`c3403d0`) after both CI jobs passed; production deployment `dpl_6cxViKC7WbVVr8LKW5yxppMFoU5f` from that clean source is Ready. Post-deployment explicit fictional-public smoke passed. Current hosted migration ledger matches all eighteen migrations; database timezone is UTC. This is synthetic hosting evidence, not regional exclusivity or customer acceptance.

Final local validation: 160 unit tests and 62 browser cases; typecheck, lint and production build passed. Deadline regression runs the actual consumer then actual deletion recovery with five seconds of cleanup and a fifteen-second ledger lookup, and verifies object removal before ledger completion. Expired removal does not finish the ledger; queue errors preserve safe failure after recovery. A slow-authentication regression verifies the administrator worker and audit use the deadline captured at request entry. Astra current static review: NO FINDINGS.

Local Supabase access/MFA/queue/deletion/backup integration passed. The separate recovery harness passed exact 1,005-row export and fresh-admin restore; its obsolete console-message assertion was replaced with checks of the actual lifecycle manifest. Actual fictional PDF/DOCX managed-parser/OpenAI workflow passed after rebuilding/restarting the local app. No real CV used.
