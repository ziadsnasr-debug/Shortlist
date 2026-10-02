import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { hash } from "../lib/pipeline/contracts";
import {
  recordId,
  reapplyDeletions,
  reconcileRestoreAttribution,
} from "../lib/recovery";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  admin = process.env.BOOTSTRAP_ADMIN_USER_ID;
if (
  !url ||
  !key ||
  !admin ||
  process.env.REAL_CV_DATA_ENABLED === "true" ||
  process.env.RESTORE_SYNTHETIC_CONFIRM !== "EMPTY TARGET"
)
  throw new Error(
    "Require isolated empty synthetic target and RESTORE_SYNTHETIC_CONFIRM=EMPTY TARGET.",
  );
const directory = resolve(process.argv[2] ?? ""),
  ledgerPath = process.argv[3];
if (!ledgerPath)
  throw new Error(
    "Provide current deletion ledger separately; old backup ledger alone is insufficient.",
  );
const backup = JSON.parse(
    await readFile(resolve(directory, "backup.json"), "utf8"),
  ),
  latest = JSON.parse(await readFile(ledgerPath, "utf8"));
if (
  backup.version !== 1 ||
  backup.synthetic !== true ||
  latest.workspaceId !== backup.workspaceId ||
  !Number.isFinite(Date.parse(latest.at)) ||
  !Number.isFinite(Date.parse(backup.at)) ||
  latest.count !== latest.ledger?.length ||
  Date.parse(latest.at) < Date.parse(backup.at)
)
  throw new Error("Backup/ledger mismatch.");
z.uuid().parse(backup.workspaceId);
z.uuid().parse(admin);
for (const table of [
  "documents",
  "runs",
  "sources",
  "reviews",
  "objects",
  "ledger",
  "audit",
]) {
  if (
    !Array.isArray(backup[table]) ||
    backup.counts?.[table] !== backup[table].length
  )
    throw new Error("Incomplete backup manifest; make a new verified export.");
}
if (
  latest.ledger.some(
    (row: { workspace_id: string }) => row.workspace_id !== backup.workspaceId,
  )
)
  throw new Error("Deletion ledger ownership mismatch.");
const db = createClient(url, key, { auth: { persistSession: false } }),
  workspace = backup.workspaceId;
const { data: existing, error: ee } = await db
  .from("workspaces")
  .select("id")
  .eq("id", workspace)
  .maybeSingle();
if (ee || existing)
  throw new Error(
    "Target already contains this workspace; refusing overwrite.",
  );
const entities = new Set<string>(
  latest.ledger.map((l: { entity_id: string }) => l.entity_id),
);
const payload = reconcileRestoreAttribution(
  reapplyDeletions(backup.state.payload, workspace, entities),
);
const applications = new Set<string>(
  payload.vacancies.flatMap(
    (v: { batches: { applications: { id: string }[] }[] }) =>
      v.batches.flatMap((b) =>
        b.applications.map((a) => recordId(workspace, a.id)),
      ),
  ),
);
for (const d of backup.documents) {
  z.uuid().parse(d.id);
  if (
    d.workspace_id !== workspace ||
    d.private_object_key !== workspace + "/" + d.id ||
    !applications.has(d.application_id)
  )
    throw new Error("Backup document ownership mismatch.");
}
// Verify every retained object before writing any target data.
const files = new Map<string, Buffer>();
for (const item of backup.objects) {
  if (!backup.documents.some((d: { id: string }) => d.id === item.documentId))
    throw new Error("Foreign backup object.");
  const bytes = await readFile(
    resolve(directory, z.uuid().parse(item.documentId) + ".bin"),
  );
  if (hash(bytes) !== item.sha256 || bytes.length !== item.bytes)
    throw new Error("Object integrity mismatch.");
  if (files.has(item.documentId)) throw new Error("Duplicate backup object.");
  files.set(item.documentId, bytes);
}
for (const document of backup.documents) {
  if (
    !(document.status === "reserved" && !document.hash) &&
    !files.has(document.id)
  )
    throw new Error("Backup original missing.");
  if (
    document.hash &&
    files.has(document.id) &&
    hash(files.get(document.id)!) !== document.hash
  )
    throw new Error("Document hash mismatch.");
}
let r = await db.from("workspaces").insert({
  id: workspace,
  name: "Restored synthetic Shortlist",
  settings: { paused: true, retentionDays: null, incidentOwner: "" },
});
if (r.error) throw new Error("Restore setup failed.");
try {
  if (latest.ledger.length) {
    r = await db.from("deletion_ledger").insert(
      latest.ledger.map(
        (l: {
          entity_id: string;
          requested_at: string;
          completed_at: string | null;
        }) => ({
          workspace_id: workspace,
          entity_id: l.entity_id,
          requested_at: l.requested_at,
          completed_at: l.completed_at,
        }),
      ),
    );
    if (r.error) throw new Error("Deletion ledger restore failed.");
  }
  r = await db
    .from("workspace_members")
    .insert({ workspace_id: workspace, user_id: admin, role: "administrator" });
  if (r.error) throw new Error("Restore membership failed.");
  r = await db
    .from("synthetic_workspaces")
    .insert({ workspace_id: workspace, version: payload.version, payload });
  if (r.error) throw new Error("State restore failed.");
  const documents = backup.documents.filter(
    (d: { application_id: string }) => !entities.has(d.application_id),
  );
  for (const d of documents) {
    if (d.status === "reserved" && !d.hash && !files.has(d.id)) continue;
    if (!files.has(d.id)) throw new Error("Backup object missing.");
    const { error } = await db.storage
      .from("cv-originals")
      .upload(d.private_object_key, files.get(d.id)!, {
        contentType:
          d.type === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
    if (error) throw new Error("Object restore failed.");
  }
  if (documents.length) {
    r = await db.from("documents").insert(documents);
    if (r.error) throw new Error("Document restore failed.");
  }
  const retained = new Set(documents.map((d: { id: string }) => d.id));
  for (const [table, rows] of [
    [
      "source_blocks",
      backup.sources.filter((r: { document_id: string }) =>
        retained.has(r.document_id),
      ),
    ],
    [
      "assessment_runs",
      backup.runs.filter((r: { document_id: string }) =>
        retained.has(r.document_id),
      ),
    ],
    [
      "application_reviews",
      backup.reviews
        .filter(
          (r: { application_id: string }) => !entities.has(r.application_id),
        )
        .map((r: Record<string, unknown>) => ({ ...r, reviewed_by: null })),
    ],
  ] as const) {
    if (rows.length) {
      const { error } = await db.from(table).upsert(rows);
      if (error) throw new Error("Relational restore failed.");
    }
  }
  if (backup.audit?.length) {
    const { error } = await db.from("audit_events").insert(
      backup.audit.map((a: Record<string, unknown>) => ({
        workspace_id: workspace,
        actor: null,
        operation: a.operation,
        entity_id: a.entity_id,
        created_at: a.created_at,
        safe_metadata: { restoredAuditId: a.id, restoredActorId: a.actor },
      })),
    );
    if (error) throw new Error("Audit restore failed.");
  }
  for (const d of documents) {
    if (d.status === "reserved" && !d.hash && !files.has(d.id)) continue;
    const { data: file, error } = await db.storage
      .from("cv-originals")
      .download(d.private_object_key);
    if (
      error ||
      !file ||
      hash(Buffer.from(await file.arrayBuffer())) !== hash(files.get(d.id)!)
    )
      throw new Error("Restored object verification failed.");
  }
  const { error: queueError } = await db.rpc("requeue_restored_documents", {
    p_workspace: workspace,
  });
  if (queueError)
    throw new Error(
      "Restored queue recovery failed; workspace remains paused.",
    );
  console.log(
    `Synthetic restore complete and paused: ${files.size} objects rehashed; ${entities.size} deletion records reapplied. Configure workspace, review ownership/recruiter records and explicitly resume.`,
  );
} catch {
  throw new Error(
    "Restore incomplete; target remains paused. Inspect privileged recovery runbook without exposing content.",
  );
}
