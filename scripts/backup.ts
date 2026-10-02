import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const { data: documents, error: de } = await db
  .from("documents")
  .select("*")
  .eq("workspace_id", workspace)
  .eq("deletion_state", "retained");
const { data: ledger, error: le } = await db
  .from("deletion_ledger")
  .select("*")
  .eq("workspace_id", workspace);
if (se || de || le) throw new Error("Backup query failed.");
const { data: audit, error: ae } = await db
  .from("audit_events")
  .select("*")
  .eq("workspace_id", workspace);
if (ae) throw new Error("Audit backup incomplete.");
const runs = [],
  sources = [],
  reviews = [],
  objects = [];
for (const document of documents ?? []) {
  const { data: file, error } = await db.storage
    .from("cv-originals")
    .download(document.private_object_key);
  if (error || !file)
    throw new Error("Original object unavailable; backup incomplete.");
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(resolve(destination, document.id + ".bin"), bytes, {
    mode: 0o600,
  });
  objects.push({
    documentId: document.id,
    sha256: hash(bytes),
    bytes: bytes.length,
  });
  const [
    { data: r, error: re },
    { data: s, error: be },
    { data: review, error: ve },
  ] = await Promise.all([
    db.from("assessment_runs").select("*").eq("document_id", document.id),
    db.from("source_blocks").select("*").eq("document_id", document.id),
    db
      .from("application_reviews")
      .select("*")
      .eq("application_id", document.application_id),
  ]);
  if (re || be || ve) throw new Error("Source backup incomplete.");
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
  }),
  { mode: 0o600 },
);
console.log(
  `Synthetic database/object backup verified: ${objects.length} objects. Keep deletion ledger current separately before restore.`,
);
