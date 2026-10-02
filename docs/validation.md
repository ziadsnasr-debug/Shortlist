# Validation — 2 October 2026

Actual local evidence, with synthetic fixtures only:

- **34 unit tests pass**: fixed half-point scoring, 100-point rubric validation, UNCLEAR handling, current evidence, stale runs, human checks, all-review ranking gate, boundary tie, empty shortlist, essentials, dispositions, edits clearing confirmation, frozen next-batch history, model-output rejection and CSV formula protection.
- **4 production-browser tests pass**: complete six-CV workflow through finalisation/export/reload; stale save and origin denial; 390px mobile and 640px viewport equivalent to 200% layout; automated Criteria accessibility and keyboard Escape dialog handling.
- **Local Supabase integration passes**: both migrations applied, MFA AAL1 denial/AAL2 access, active membership and outsider/removal denial, role escalation denial, direct aggregate reads/RPC writes denied, private bucket and forged upload denial, second-reviewer resume, stale and concurrent saves, database frozen-batch guard and transactional audit append.
- TypeScript check, ESLint and optimized Next.js build pass. Production nonce CSP runs without page errors in the complete workflow test. CSV response is private/no-store.
- npm audit reports zero known dependency vulnerabilities at this check. Gitleaks source-only scan reports no leaks. A separate broad scan identified only generated Next.js framework signing/encryption material inside ignored `.next/`; those artifacts are excluded from commits and the source handover. CI workflow is prepared but has not run remotely.
- Codex in-app browser was used to inspect publication and synthetic intake. Automated Chromium exercises repetition and production behavior.

Test corrections: the initial automated browser run lacked its Chromium executable; installed the official Playwright browser. Browser/API parity then exposed a secure-cookie mismatch in the loopback synthetic production server; local-only mode now uses its loopback cookie while hosted Supabase keeps secure cookies for HTTPS. A test also read the old intake screen before the Review transition completed; it now waits for the review heading. No failing assertions were removed to claim a pass.

Limits: 640px viewport is a layout equivalence check, not a full assistive-technology or browser-zoom certification. Accessibility scan covers Criteria only, not all surfaces. Local Supabase does not verify customer accounts, deployed geography, host failover, production invitation delivery or distributed restore. No actual parser, AI inference, model semantic audit, paired adversarial CV suite, deletion/restore exercise or timed recruiter pilot has run. A real recruiter has not independently completed Stage 1 without help. No production-ready or fairness claim is made.
