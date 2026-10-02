# Project Agent Guide

<!-- shared-practices:v1 -->
## Shared practices for every project task

Use the global `zed-vault-memory` workflow before meaningful work, including setup. Resolve `context/zed-vault` or the global vault fallback. Read `Codex Memory/00 Index.md`, `config.json`, `Playbooks/00 Engineering Playbooks.md`, `Playbooks/Working Principles.md`, relevant topics, and `Codex Memory/Shortlist.md` when available. A missing project note must not prevent reading shared practices.

At closeout, update changed durable project facts and promote reusable successes/failures to the relevant shared topic with source date, SHA/PR when known, scope, exceptions and verification state. Keep credentials, customer data and raw logs out. Shared-playbook write-back is authorized; curated BI write restrictions remain unchanged. Revalidate mutable provider settings before reuse.
<!-- /shared-practices:v1 -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
