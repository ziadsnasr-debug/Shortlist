import "server-only";
import { databaseClient } from "./supabase";
import type { Owner } from "./store";
import { WorkflowError } from "./workflow";
import { configuration } from "./config";
import {
  currentUtcAllowancePeriod,
  makeProcessingAllowance,
} from "./processing-allowance";
import { pagedRows } from "./recovery-export";
import {
  ageSeconds,
  documentStage,
  operationSummary,
  safeErrorMessage,
  type OperationDocument,
} from "./operation-status";
export function administrator(access: Owner) {
  if (access.temporaryPublic)
    throw new WorkflowError("Account administration is unavailable during temporary public access.", 403);
  if (access.local)
    throw new WorkflowError("Administration requires Supabase staging.", 503);
  if (access.role !== "administrator")
    throw new WorkflowError("Administrator access required.", 403);
}
export async function administration(access: Owner) {
  administrator(access);
  const db = databaseClient();
  const period = currentUtcAllowancePeriod();
  const [members, { data: workspace, error: we }, documents, deletions, allowance] =
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
      pagedRows<OperationDocument>(
        db,
        "documents",
        { workspace_id: access.workspaceId, deletion_state: "retained" },
        "id",
        "id,application_key,status,attempts,safe_error_code,reserved_at,deletion_state",
      ),
      pagedRows(
        db,
        "deletion_ledger",
        { workspace_id: access.workspaceId, completed_at: null },
        "id",
        "id,entity_id,ready_after,completed_at",
      ),
      db
        .from("processing_allowances")
        .select("period,used")
        .eq("workspace_id", access.workspaceId)
        .eq("period", period)
        .maybeSingle(),
    ]);
  if (we) throw new Error("ADMIN_UNAVAILABLE");
  if (allowance.error) throw new Error("ADMIN_UNAVAILABLE");
  const operationDocuments = documents.map((document) => ({
    ...document,
    stage: documentStage(document),
    reservation_age_seconds: ageSeconds(document.reserved_at),
    safe_error_message: safeErrorMessage(document.safe_error_code),
  }));
  return {
    members,
    settings: workspace.settings,
    documents: operationDocuments,
    deletions,
    processing: operationSummary(operationDocuments),
    allowance: makeProcessingAllowance({
      period,
      used: allowance.data ? allowance.data.used : 0,
      limit: configuration().allowance,
    }),
  };
}
