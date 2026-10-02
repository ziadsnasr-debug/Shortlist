import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pagedRows, type RecoveryDocument } from "../lib/recovery-export";
import { hash } from "../lib/pipeline/contracts";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  workspace = process.env.WORKSPACE_ID;
if (!url || !key || !workspace || process.env.REAL_CV_DATA_ENABLED === "true")
  throw new Error("Isolated synthetic backup configuration required.");
const destination = resolve(process.argv[2] ?? "work/recovery/backup");
await mkdir(destination, { recursive: true, mode: 0o700 });
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: state, error: se } = await db
  .from("synthetic_workspaces")
  .select("*")
  .eq("workspace_id", workspace)
  .single();
const documents = await pagedRows<RecoveryDocument>(db, "documents", {
  workspace_id: workspace,
  deletion_state: "retained",
});
const ledger = await pagedRows(db, "deletion_ledger", {
  workspace_id: workspace,
});
if (se) throw new Error("Backup query failed.");
const audit = await pagedRows(db, "audit_events", { workspace_id: workspace });
const runs = [],
  sources = [],
  reviews = [],
  objects = [];
for (const document of documents ?? []) {
  // Reservations without completed upload have no original yet. Preserve the row.
  if (document.status === "reserved" && !document.hash) {
    const present = await db.storage
      .from("cv-originals")
      .exists(document.private_object_key);
    if (present.error) {
      const detail = present.error as unknown as {
        status?: number;
        originalError?: { status?: number };
      };
      const status = detail.status ?? detail.originalError?.status;
      // Storage HEAD expresses an absent object as false plus a 400/404 error.
      // Authentication, transport and all other errors still abort the backup.
      if (!(present.data === false && (status === 400 || status === 404)))
        throw new Error("Reserved object status unavailable.");
    }
    if (!present.data) continue;
  }
  const { data: file, error } = await db.storage
    .from("cv-originals")
    .download(document.private_object_key);
  if (error || !file)
    throw new Error("Original object unavailable; backup incomplete.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (document.hash && hash(bytes) !== document.hash)
    throw new Error("Original/document hash mismatch; backup incomplete.");
  await writeFile(resolve(destination, document.id + ".bin"), bytes, {
    mode: 0o600,
  });
  objects.push({
    documentId: document.id,
    sha256: hash(bytes),
    bytes: bytes.length,
  });
  const [r, s, review] = await Promise.all([
    pagedRows(db, "assessment_runs", { document_id: document.id }),
    pagedRows(db, "source_blocks", { document_id: document.id }),
    pagedRows(
      db,
      "application_reviews",
      { application_id: document.application_id },
      "application_id",
    ),
  ]);
  runs.push(...r);
  sources.push(...s);
  reviews.push(...review);
}
const { data: check, error: ce } = await db
  .from("synthetic_workspaces")
  .select("version")
  .eq("workspace_id", workspace)
  .single();
if (ce || check.version !== state.version)
  throw new Error(
    "Workspace changed during backup; retry the controlled backup.",
  );
await writeFile(
  resolve(destination, "backup.json"),
  JSON.stringify({
    version: 1,
    synthetic: true,
    workspaceId: workspace,
    at: new Date().toISOString(),
    state,
    documents,
    runs,
    sources,
    reviews,
    objects,
    ledger,
    counts: {
      documents: documents.length,
      runs: runs.length,
      sources: sources.length,
      reviews: reviews.length,
      objects: objects.length,
      ledger: ledger.length,
      audit: audit.length,
    },
    audit,
  }),
  { mode: 0o600 },
);
await writeFile(
  resolve(destination, "latest-deletions.json"),
  JSON.stringify({
    workspaceId: workspace,
    at: new Date().toISOString(),
    ledger,
    count: ledger.length,
  }),
  { mode: 0o600 },
);
console.log(
  `Synthetic database/object backup verified: ${objects.length} objects. Keep deletion ledger current separately before restore.`,
);
