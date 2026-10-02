# Build phases — 2 October 2026

Canonical V1.2 and Appendix A apply. User changes: OpenAI replaces Anthropic; backend stays local; originals remain in the user’s folder, with local private upload copies and approved temporary Vercel parsing copies. OpenAI receives minimised text. Real data remains disabled.

1. Workflow and ownership: four steps, deterministic scores, mandatory human review, private persistence, MFA and access tests.
2. Recovery and configuration: Hobby-compatible daily recovery; bounded audited administrator processing; processing keys pin provider/model/prompt/parser configuration and explicit retries preserve previous runs. Test before commit/push/merge.
3. Managed parser and OpenAI: dependency-only isolated snapshot, live fictional PDF/DOCX and network/DNS/secret/resource probes; direct two-pass Responses API spike. No silent provider fallback. Test before commit/push/merge.
4. Local persistent workflow: fictional browser uploads, actual queue/parser/AI, every application reviewed, shortlist/finalisation/export/reload and mobile/accessibility checks. Test and fix, then commit/push/merge.
5. Handover: reproduce local setup, document fresh independent cloud deployment, package source and record validation limits. Commit/push/merge after checks.

Recommendations implemented: keep the dedicated local backend; use the dedicated Vercel parser; preserve human decisions and hidden ranking; bound recovery and inference; pin processing configuration; keep keys private. No paid Supabase project or plan upgrade is authorized. The Vercel app cannot reach the loopback backend, so the hosted preview has no connected backend and cannot run the persistent workflow. No database tunnel is introduced.

Claude authenticated read-only advice informed scheduler and provider decisions. Existing pgmq visibility, deterministic keys, atomic completion and strict structured output were verified. The direct OpenAI route has no tools, no retries or provider fallback and requests store:false. Provider retention/geography, independent evidence labels and customer acceptance remain gates, not inferred from a successful API call.
