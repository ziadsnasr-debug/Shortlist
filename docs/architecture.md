# Architecture

One Next.js/React/TypeScript application with Tailwind/shadcn, Supabase Auth/Postgres/private Storage/pgmq, an ephemeral managed parser and one direct provider. No autonomous agents, Python worker, gateway or custom queue lease system.

## Authority

`lib/workflow.ts` validates 100-point integer rubrics and exact half-point scoring. UNCLEAR blocks confirmation; evidence IDs belong to the current document. Every active application needs meaningful human review. Scores, comparative ranking and names remain absent from server responses until the whole-batch review gate; name reveal is explicit. Publication freezes criteria; finalisation freezes adjudication. API clients cannot submit official scores, review timestamps or snapshots.

The small synthetic workflow remains a server-only versioned JSON aggregate. Postgres projects vacancies, batches and applications into normalized relations in the same transaction. Documents, sources, private assessment runs and reviews use separate normalized records. A locking CAS operation checks membership/role, protects frozen batches and appends safe audit records. Browser Data API access to applicant relations/RPCs is denied. This aggregate/projection approach is transitional, not a proven production scaling design.

## Documents and processing

A server-authorized reservation creates an application and unique private path. Expiring signed uploads use no upsert. Finalisation reads actual private bytes and checks signature, length and batch duplicate hash before a private queue receives an identifier. No CV text enters messages. Uploaded original filenames remain private; ordinary intake uses an anonymous record.

The controller starts a pinned snapshot with `persistent:false`, London, no failover, denied network and empty environment. Bytes cross the control API into a fixed temporary path. Fixed commands enforce a 30-second parser timeout and 256 MiB Node heap; the microVM allocation is separately bounded. Cleanup always stops the VM. No implicit persistence may snapshot a CV. Actual fictional PDF/DOCX, denied network/DNS, absent secret canary, command timeout and JavaScript heap exhaustion checks passed; these probes are not a general isolation certification.

PDF.js preserves page/item locations; Mammoth raw text preserves DOCX paragraphs/tables without page inventions. DOCX validation counts actual streamed expanded bytes and entry bounds before extraction. Failed or mixed unreadable pages remain visible. Source blocks retain original and minimized text separately. The public source view uses minimized text; an explicitly requested 60-second attachment download lets an authorized reviewer inspect the original outside the app origin. Masking is incomplete and flagged for human checking.

Pgmq supplies visibility; maximum two messages per invocation, 360-second visibility and 240-second function ceiling. An internal deadline avoids beginning another full job near the ceiling. Completion locks workspace then document, rejects deleted/disposed/stale/closed states, stores result/source/run and patches aggregate atomically. Acknowledgment follows commit. Duplicate processing returns an existing run. Processing keys pin provider/model/prompt/parser configuration; changed configuration requires explicit retry and preserves prior runs. Three attempts lead to visible attention; an administrator can retry. Reservation/attempt/draft counters cap monthly work; rate limits are transactionally shared.

## AI

Direct `createOpenAI` provider objects call the Responses API through `generateText`/`Output.object` with an exact configured model ID, no tools, no gateway, no custom endpoint and no provider fallback. Each fresh request sees one minimized CV and approved definitions, not applicant identity/weights/scores/other CVs/the other pass. Strict JSON schema output is requested, provider response storage is disabled (`store: false`) and reasoning effort is low. Telemetry is disabled and raw exceptions are not logged. Invalid or disagreeing results become UNCLEAR. Two matching calls and valid references do not prove semantic support; human audit and held-out evaluation remain necessary.

AI is disabled by default. Claude subscription authentication is advisory access, not an application API credential. The live synthetic two-pass spike passed with gpt-6-luna. Responses request store:false; this does not guarantee zero provider retention or UK-only processing. Semantic accuracy remains unmeasured.

## Deletion and recovery

Normal operations cannot reopen or change finalised decisions. Authorized privacy deletion is a separate purge, not adjudication: source/model/review content and original objects are removed, the displayed snapshot is redacted, and a hash receipt records its prior content. Customer must approve this retention/immutability interpretation before real use. Failed object removal remains in the deletion ledger for cron recovery. Database triggers prevent known deleted content from being reinserted.

Backup tooling exports synthetic aggregate, normalized documents/sources/runs/reviews, safe audits, objects and hashes without Auth secrets. Restore refuses overwrite, requires a separately current deletion ledger, verifies ownership/hashes, reapplies deletions and leaves intake paused. Historical reviewer attribution requires customer reconciliation; an independent fresh-account exercise remains outstanding.
