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
const ledger = await pagedRows(db, "deletion_ledger", {
  workspace_id: workspaceId,
});
await writeFile(
  path,
  JSON.stringify({
    workspaceId,
    at: new Date().toISOString(),
    ledger,
    count: ledger.length,
  }),
  { mode: 0o600 },
);
console.log(
  "Current deletion ledger exported; retain separately from old backups.",
);
