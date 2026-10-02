import { createClient } from "@supabase/supabase-js";
import { pagedRows } from "../lib/recovery-export";
import { writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  workspaceId = process.env.WORKSPACE_ID,
  path = process.argv[2];
if (
  !url ||
  !key ||
  !workspaceId ||
  !path ||
  process.env.REAL_CV_DATA_ENABLED === "true"
)
  throw new Error(
    "Provide synthetic workspace configuration and protected output path.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: before, error: beforeError } = await db
  .from("synthetic_workspaces")
  .select("version")
  .eq("workspace_id", workspaceId)
  .single();
if (beforeError || !before) throw new Error("Lifecycle state unavailable.");
const ledger = await pagedRows(db, "deletion_ledger", {
  workspace_id: workspaceId,
});
const policies = await pagedRows(db, "retention_policies", { workspace_id: workspaceId });
const holds = await pagedRows(db, "retention_holds", { workspace_id: workspaceId });
const { data: state, error: stateError } = await db
  .from("synthetic_workspaces")
  .select("version")
  .eq("workspace_id", workspaceId)
  .single();
if (stateError || !state || state.version !== before.version)
  throw new Error("Lifecycle changed during export; retry the controlled export.");
await writeFile(
  path,
  JSON.stringify({
    workspaceId,
    at: new Date().toISOString(),
    ledger,
    count: ledger.length,
    policies,
    holds,
    policyCount: policies.length,
    holdCount: holds.length,
    lifecycleRevision: before.version,
  }),
  { mode: 0o600 },
);
console.log(
  "Current deletion ledger and retention lifecycle exported; retain separately from old backups.",
);
