import "server-only";
import { databaseClient } from "../supabase";
import { administrator } from "../administration";
import type { Owner } from "../store";
import { WorkflowError } from "../workflow";
export async function deleteApplication(access: Owner, id: string) {
  administrator(access);
  const db = databaseClient();
  const { data: keys, error } = await db.rpc("delete_application_content", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_application: id,
  });
  if (error) throw new WorkflowError("Content deletion unavailable.", 422);
  if (keys.length) {
    const { error: storage } = await db.storage
      .from("cv-originals")
      .remove(keys);
    if (storage)
      throw new WorkflowError(
        "Database content removed. File deletion pending; administrator must retry.",
        503,
      );
  }
  const { data: entity, error: ie } = await db.rpc("record_id", {
    p_workspace: access.workspaceId,
    p_key: id,
  });
  if (ie) throw new Error("DELETION_ID");
  const { error: done } = await db.rpc("finish_deletion", {
    p_workspace: access.workspaceId,
    p_entity: entity,
  });
  if (done) throw new Error("DELETION_PENDING");
  return { deleted: true };
}
export async function recoverDeletions() {
  const db = databaseClient();
  const { data, error } = await db
    .from("deletion_ledger")
    .select("workspace_id,entity_id")
    .is("completed_at", null)
    .limit(20);
  if (error) throw new Error("DELETION_RECOVERY");
  let completed = 0;
  for (const record of data ?? []) {
    const { data: docs, error: d } = await db
      .from("documents")
      .select("private_object_key")
      .eq("application_id", record.entity_id)
      .eq("workspace_id", record.workspace_id);
    if (d) continue;
    const { error: removed } = docs?.length
      ? await db.storage
          .from("cv-originals")
          .remove(docs.map((x) => x.private_object_key))
      : { error: null };
    if (removed) continue;
    const { error: done } = await db.rpc("finish_deletion", {
      p_workspace: record.workspace_id,
      p_entity: record.entity_id,
    });
    if (!done) completed++;
  }
  return completed;
}
