// Recovery is a privileged CLI operation, never imported into browser code.
import { createHash } from "node:crypto";
import type { Workspace } from "./workflow";
export function recordId(workspace: string, key: string) {
  const h = createHash("md5")
    .update(workspace + ":" + key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// Frozen snapshots retain historical attribution. Current records must not use
// Auth UUIDs belonging only to the source installation.
export function reconcileRestoreAttribution(state: Workspace) {
  const result = structuredClone(state);
  for (const vacancy of result.vacancies)
    for (const batch of vacancy.batches)
      for (const application of batch.applications)
        delete application.reviewedBy;
  return result;
}
export function reapplyDeletions(
  state: Workspace,
  workspace: string,
  entities: Set<string>,
) {
  const result = structuredClone(state);
  for (const vacancy of result.vacancies)
    for (const batch of vacancy.batches) {
      const removed = new Set<string>();
      batch.applications = batch.applications.map((a) => {
        if (!entities.has(recordId(workspace, a.id))) return a;
        removed.add(a.id);
        return {
          ...a,
          name: "",
          file: "Content deleted",
          state: "disposed",
          disposition: "deleted",
          dispositionReason: "Authorised content deletion",
          blocks: [],
          assessments: {},
          confirmed: false,
          sourceFlag: undefined,
          sourceChecked: false,
          reviewedBy: undefined,
          reviewedAt: undefined,
        };
      });
      if (removed.size) {
        batch.selected = batch.selected.filter((id) => !removed.has(id));
        batch.reason = "Content removed by authorised deletion";
        batch.tieReason = "";
        batch.exceptions = {};
        if (batch.snapshot) {
          batch.snapshot.applications = batch.snapshot.applications.filter(
            (a) => !removed.has(a.id),
          );
          batch.snapshot.selected = batch.selected;
          batch.snapshot.reason = batch.reason;
          batch.snapshot.tieReason = "";
          batch.snapshot.exceptions = {};
        }
      }
    }
  return result;
}
