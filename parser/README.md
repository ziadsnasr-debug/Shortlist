# Restricted parser

Run `npm run parser:build` to produce a bundled dependency-only artifact/hash under ignored work/parser. Run `npm run parser:snapshot` only with the intended Vercel project authenticated. Snapshot build has no CVs, sets denied network/no failover/London, checks DNS/network denial and absence of controller-secret names/canary, then records snapshot ID/hash. Runtime starts a fresh nonpersistent sandbox from that exact snapshot, checks hash before transferring bytes and stops it in finally.

PDF: at most 10 pages; page/item/position source IDs. DOCX: validate structure, reject encrypted/embedded active payloads, at most 500 entries and 50 MiB actual decompressed bytes; Mammoth raw extraction includes tables. Raw-text extraction has no external-file access path. Use 5 MiB input, 100,000 characters, 5,000 blocks, 2 MB returned JSON, 30-second deadline and 256 MiB Node heap. MicroVM memory allocation is a separate ceiling, not the heap setting.

Local tests parse generated fictional PDFs/DOCX, malformed ZIPs/scans and expansion fixtures. Mock controller tests cover denied options, output validation/hash and cleanup. They do not establish cloud isolation/resource behavior. Run actual managed probes and representative fixture files before marking SEC03 complete. Do not parse real uploaded documents in an ordinary Next.js function or developer process.
