# Backend completion plan — 2 October 2026

V1.2 and mandatory Appendix A remain authoritative. The implemented local synthetic app is workable; deployment, privacy and independent pilot acceptance are separate exit gates. No paid hosted backend is authorized.

| Canonical stage         | Current backend scope                                                                                                                                      | Next exit gate                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 Workflow              | Four steps, 100-point rubric, deterministic scores, human review, hidden ranking, 0–3 shortlist, immutable final adjudication                              | Independent recruiter completes a batch unaided                                           |
| 2 Persistence/ownership | Local Supabase, private objects, MFA/membership/RLS, transactional saves and invitations; isolated Free Supabase and Vercel production configuration exist | Authenticated hosted workflow, approved sender, delivered invitation and revocation tests |
| 3 Documents/queue       | PDF/DOCX isolated parser, private queue, visible handling states, bounded attempts, configuration pinning, deletion and restore recovery                   | Hosted fault injection and independent isolation review                                   |
| 4 Evidence AI           | One direct OpenAI route, two bounded calls, strict references, ambiguity handling, editable draft criteria                                                 | Customer-approved data route and independently audited support correctness                |
| 5 Pilot                 | Fixtures, paired attacks, timing/metrics tools, browser/accessibility/access tests                                                                         | Independent labels, actual held-out/repeat/paired results and three timed 20-CV reviews   |
| 6 Acceptance            | Reproducible migrations/setup, private backup/export/restore, handover                                                                                     | Another operator deploys/restores, customer signs off, developer access removed           |

## Hardening phase now implemented

- Deletion remains pending through the two-hour signed-upload lifetime plus ten-minute margin. Recovery removes late copies before marking completion; it never claims deletion while a valid upload token can recreate the object.
- Ordered exact-count pagination covers recovery and operational lists. Count changes, duplicates, truncated pages and incomplete manifests fail closed.
- Empty-target restore verifies original hashes, newer deletion ledger, ownership and manifest counts; clears source-installation current reviewer references; preserves immutable historical attribution; queues retained unfinished jobs while target remains paused.
- Paused workspaces block criteria-draft allowance and inference as well as intake/processing. Processing budgets have one validated 1–1000-unit configuration.
- Transient database lookup failures leave queue messages for redelivery. Stale manual-source completions cannot overwrite human work. Explicit retries reset processing state and archive obsolete messages.
- Private administrator readiness reports configuration checks only. It does not reveal keys or approve production/real data. Local persistent mode is supported without pretending a cloud app can reach loopback.

Retry generations fence attempts and completion even when logical configuration keys are unchanged; assessment runs retain generation-specific history. A shared remaining-time signal reaches database, parser and model calls; cleanup has a separate five-second signal. Verification is recorded in validation.md. Every major phase follows tests, Astra review, commit, push, CI, merge.

## Deployment work requiring a customer decision

The deployed Vercel app cannot connect to a developer’s local loopback database. An isolated reachable hosted backend now exists for synthetic acceptance; the public surface and complete authenticated upload-to-export workflow have passed fictional acceptance. No tunnel, unrelated database migration or paid project is introduced. Staging and production need separate accounts/projects/secrets, regional/retention verification, approved authentication sender and a named incident owner.

Before real CV activation, implement and exercise the customer-approved retention/hold lifecycle across originals, text, outputs, exports and backups. The current retention field records policy; it is not an automatic purge scheduler. A lawful hold workflow, independently tested restore and hosted monitoring/alerts remain deployment work. An automatic purge must not be invented before the customer defines holds, scope and retention.

## Feature priorities after acceptance inputs

1. Approved retention/hold administration and an auditable scheduled lifecycle, including export/backup responsibilities.
2. Private operational dashboard with queue age, errors and deletion due times; alerts to an approved destination after explicit notification authorization.
3. Saved vacancy templates and clearer bulk-upload progress, preserving versioned published rubrics and every-application review.
4. Reviewer-labelled evaluation runner with frozen thresholds, support audit and model/prompt/parser change gates.
5. Optional Jev classification experiment only if independent evidence demonstrates acceptable support and ambiguity handling. Keep one approved production route; no confidence-as-score or silent fallback.

No automatic hiring decisions, protected-trait inference, automated rejection, ranking before review, or unsolicited candidate messages are proposed.
