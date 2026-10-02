import "server-only";
import { databaseClient } from "./supabase";
import { pagedRows } from "./recovery-export";
import { recordId } from "./recovery";
import type { Owner } from "./store";
import { administrator } from "./administration";
import { WorkflowError } from "./workflow";

type HoldRow = {
  id: string;
  scope: "workspace" | "application";
  application_id: string | null;
  application_key: string | null;
  reason_code: string;
  created_at: string;
  released_at: string | null;
};
type PolicyRow = {
  version: number;
  proposed_days: number | null;
  start_event: "batch_finalised_at";
  automation_enabled: false;
  created_at: string;
};
function hold(row: HoldRow, applicationKeys: Map<string, string>) {
  return {
    id: row.id,
    scope: row.scope,
    applicationId: row.application_key ?? (row.application_id ? (applicationKeys.get(row.application_id) ?? null) : null),
    reasonCode: row.reason_code,
    active: row.released_at === null,
    createdAt: row.created_at,
    releasedAt: row.released_at,
  };
}
export async function retention(access: Owner) {
  administrator(access);
  const db = databaseClient();
  const [{ data: state, error: se }, policies, holds] =
    await Promise.all([
      db.from("synthetic_workspaces").select("payload").eq("workspace_id", access.workspaceId).single(),
      pagedRows<PolicyRow>(db, "retention_policies", { workspace_id: access.workspaceId }, "version", "version,proposed_days,start_event,automation_enabled,created_at"),
      pagedRows<HoldRow>(db, "retention_holds", { workspace_id: access.workspaceId }, "id", "id,scope,application_id,application_key,reason_code,created_at,released_at"),
    ]);
  if (se) throw new Error("RETENTION_UNAVAILABLE");
  const policy = policies.sort((a, b) => b.version - a.version)[0] ?? null;
  const applicationKeys = new Map<string, string>();
  for (const vacancy of (state!.payload as { vacancies: { batches: { applications: { id: string }[] }[] }[] }).vacancies)
    for (const batch of vacancy.batches)
      for (const application of batch.applications)
        applicationKeys.set(recordId(access.workspaceId, application.id), application.id);
  const activeWorkspaceHold = holds.some((item) => item.scope === "workspace" && item.released_at === null);
  const activeApplicationHolds = new Set(holds.filter((item) => item.scope === "application" && item.released_at === null).map((item) => item.application_key));
  const days = policy?.proposed_days ?? null;
  const candidates = days === null ? [] : ((state!.payload as { vacancies: { batches: { id: string; snapshot?: { at: string; applications: { id: string }[] } }[] }[] }).vacancies).flatMap((v) => v.batches.flatMap((batch) => {
    if (!batch.snapshot) return [];
    const eligibleAt = new Date(Date.parse(batch.snapshot.at) + days * 86400000).toISOString();
    return batch.snapshot.applications.map((application) => {
      const held = activeWorkspaceHold || activeApplicationHolds.has(application.id);
      return { applicationId: application.id, batchId: batch.id, eligibleAt, holdState: held ? "held" : "not_held" };
    });
  }));
  // No automatic deletion query exists. A draft produces only an explicitly
  // labelled hypothetical preview; it cannot represent approved retention.
  return {
    policy: policy
      ? {
          version: policy.version,
          proposedDays: policy.proposed_days,
          startEvent: policy.start_event,
          automationEnabled: false,
          createdAt: policy.created_at,
        }
      : null,
    preview: {
      status: policy?.proposed_days ? "hypothetical" : "not_configured",
      hypotheticalDays: policy?.proposed_days ?? null,
      startEvent: "batch_finalised_at",
      eligibleCount: candidates.length,
      heldCount: candidates.filter((candidate) => candidate.holdState === "held").length,
      candidates,
    },
    holds: holds.map((row) => hold(row, applicationKeys)),
  };
}
export async function draftRetentionPolicy(
  access: Owner,
  proposedDays: number | null,
  startEvent: "batch_finalised_at",
) {
  administrator(access);
  const { error } = await databaseClient().rpc("draft_retention_policy", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_days: proposedDays,
    p_start_event: startEvent,
  });
  if (error) throw new WorkflowError("Retention proposal unavailable.", 422);
}
export async function placeRetentionHold(
  access: Owner,
  scope: "workspace" | "application",
  applicationId: string | undefined,
  reasonCode: "legal" | "investigation" | "subject_request" | "operational",
) {
  administrator(access);
  const { error } = await databaseClient().rpc("place_retention_hold", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_scope: scope,
    p_application: applicationId ?? null,
    p_reason_code: reasonCode,
  });
  if (error) throw new WorkflowError("Retention hold unavailable.", 422);
}
export async function releaseRetentionHold(access: Owner, holdId: string) {
  administrator(access);
  const { error } = await databaseClient().rpc("release_retention_hold", {
    p_workspace: access.workspaceId,
    p_actor: access.actor,
    p_hold: holdId,
  });
  if (error) throw new WorkflowError("Retention hold unavailable.", 422);
}
