import "server-only";
import { databaseClient } from "./supabase";
import type { Owner } from "./store";
import { WorkflowError } from "./workflow";
import { pagedRows } from "./recovery-export";
export function administrator(access: Owner) {
  if (access.local)
    throw new WorkflowError("Administration requires Supabase staging.", 503);
  if (access.role !== "administrator")
    throw new WorkflowError("Administrator access required.", 403);
}
export async function administration(access: Owner) {
  administrator(access);
  const db = databaseClient();
  const [members, { data: workspace, error: we }, documents, deletions] =
    await Promise.all([
      pagedRows(
        db,
        "workspace_members",
        { workspace_id: access.workspaceId },
        "user_id",
        "user_id,role,active",
      ),
      db
        .from("workspaces")
        .select("settings")
        .eq("id", access.workspaceId)
        .single(),
      pagedRows(
        db,
        "documents",
        { workspace_id: access.workspaceId, deletion_state: "retained" },
        "id",
        "id,application_key,status,attempts,safe_error_code,deletion_state",
      ),
      pagedRows(
        db,
        "deletion_ledger",
        { workspace_id: access.workspaceId, completed_at: null },
        "id",
        "id,entity_id,completed_at",
      ),
    ]);
  if (we) throw new Error("ADMIN_UNAVAILABLE");
  return { members, settings: workspace.settings, documents, deletions };
}
