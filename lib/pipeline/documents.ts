import "server-only";
import { randomUUID } from "node:crypto";
import { databaseClient } from "../supabase";
import { readState, type Owner } from "../store";
import { requireRule, WorkflowError } from "../workflow";
import { documentType, hash } from "./contracts";
export function requireHosted(access: Owner) {
  if (access.local)
    throw new WorkflowError(
      "File processing requires isolated Supabase staging. Use sample CVs locally.",
      503,
    );
}
export async function ownedDocument(access: Owner, id: string) {
  requireHosted(access);
  const { data, error } = await databaseClient()
    .from("documents")
    .select("*")
    .eq("workspace_id", access.workspaceId)
    .eq("id", id)
    .single();
  if (error || !data || data.deletion_state !== "retained")
    throw new WorkflowError("Document unavailable.", 404);
  return data;
}
export async function reserve(
  access: Owner,
  input: {
    version: number;
    vacancyId: string;
    batchId: string;
    filename: string;
    size: number;
    type: "pdf" | "docx";
    synthetic: true;
  },
) {
  requireHosted(access);
  const db = databaseClient(),
    documentId = randomUUID(),
    applicationId = "CV-" + randomUUID();
  const { data, error } = await db.rpc("reserve_document", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_expected: input.version,
    p_vacancy: input.vacancyId,
    p_batch: input.batchId,
    p_document: documentId,
    p_application: applicationId,
    p_filename: input.filename,
    p_size: input.size,
    p_type: input.type,
  });
  if (error || !data)
    throw new WorkflowError(
      "Intake changed, paused or full. Reload before uploading.",
      409,
    );
  const path = `${access.workspaceId}/${documentId}`;
  const { data: upload, error: uploadError } = await db.storage
    .from("cv-originals")
    .createSignedUploadUrl(path, { upsert: false });
  if (uploadError || !upload)
    throw new WorkflowError(
      "Upload reservation remains visible. Request a readable copy or record disposition.",
      503,
    );
  return {
    documentId,
    applicationId,
    uploadUrl: upload.signedUrl,
    version: input.version + 1,
  };
}
export async function finaliseUpload(access: Owner, id: string) {
  const d = await ownedDocument(access, id),
    db = databaseClient();
  const { data, error } = await db.storage
    .from("cv-originals")
    .download(d.private_object_key);
  if (error || !data)
    throw new WorkflowError(
      "Upload incomplete. Retry upload before finishing.",
      422,
    );
  const bytes = Buffer.from(await data.arrayBuffer());
  requireRule(
    bytes.length === d.size,
    "Actual file size does not match reservation.",
  );
  requireRule(
    documentType(bytes) === d.type,
    "File signature does not match type.",
  );
  const allowance = Number(process.env.MONTHLY_PROCESSING_ALLOWANCE ?? 240);
  requireRule(
    Number.isInteger(allowance) && allowance > 0 && allowance <= 1000,
    "Processing allowance configuration invalid.",
  );
  const config = `evidence-v1:${process.env.AI_ENABLED === "true" ? process.env.AI_MODEL_ID : "manual"}:${process.env.PARSER_BUNDLE_SHA256 ?? "unconfigured"}`;
  const { data: queued, error: qerror } = await db.rpc("enqueue_document", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_document: id,
    p_hash: hash(bytes),
    p_config: config,
    p_allowance: allowance,
  });
  if (qerror)
    throw new WorkflowError(
      "Duplicate file, paused intake or processing allowance exhausted. Item remains visible.",
      422,
    );
  return { queued: !!queued };
}
export async function documentsFor(access: Owner) {
  requireHosted(access);
  const state = await readState(access);
  const { data, error } = await databaseClient()
    .from("documents")
    .select(
      "id,application_key,status,safe_error_code,attempts,reserved_at,deletion_state",
    )
    .eq("workspace_id", access.workspaceId);
  if (error) throw new Error("DOCUMENT_LIST");
  return { documents: data, stateVersion: state.version };
}
