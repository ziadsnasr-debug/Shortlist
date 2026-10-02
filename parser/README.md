# Stage 3 parser boundary — not implemented

Implement a dependency-only pinned Vercel Sandbox snapshot with TypeScript unpdf/PDF.js and Mammoth raw text extraction. Set denied networking explicitly before transferring document bytes through the controller API. No signed-URL download, secrets, applicant documents or API keys in the snapshot. Stop in finally.

Enforce actual input signatures, 5 MiB input, 10 PDF pages, 50 MiB actual decompressed DOCX bytes, 500 archive entries, 100,000 text characters, 30-second parser deadline and tested memory/resource bounds. Preserve PDF page/text locations and DOCX paragraph/table provenance; never invent DOCX page numbers. Scans, mixed unreadable pages, encrypted/corrupt files and incomplete extraction must remain visible as Needs readable copy. No truncation and no failure-to-zero conversion.

Prove network and DNS denial, absence of planted controller secrets and resource exhaustion containment before real files. Existence of this directory is not sandbox or parsing implementation.
