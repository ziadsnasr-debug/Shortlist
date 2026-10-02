import "server-only";
import { databaseClient } from "./supabase";
import type { Owner } from "./store";
import { WorkflowError } from "./workflow";
export function administrator(access: Owner) {
  if (access.local)
    throw new WorkflowError("Administration requires Supabase staging.", 503);
  if (access.role !== "administrator")
    throw new WorkflowError("Administrator access required.", 403);
}
export async function administration(access: Owner) {
  administrator(access);
  const db = databaseClient();
  const [
    { data: members, error: me },
    { data: workspace, error: we },
    { data: documents, error: de },
    { data: deletions, error: le },
  ] = await Promise.all([
    db
      .from("workspace_members")
      .select("user_id,role,active")
      .eq("workspace_id", access.workspaceId),
    db
      .from("workspaces")
      .select("settings")
      .eq("id", access.workspaceId)
      .single(),
    db
      .from("documents")
      .select(
        "id,application_key,status,attempts,safe_error_code,deletion_state",
      )
      .eq("workspace_id", access.workspaceId),
    db
      .from("deletion_ledger")
      .select("id,entity_id,completed_at")
      .eq("workspace_id", access.workspaceId),
  ]);
  if (me || we || de || le) throw new Error("ADMIN_UNAVAILABLE");
  return { members, settings: workspace.settings, documents, deletions };
}
