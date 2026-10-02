import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  workspaceId = process.env.WORKSPACE_ID,
  path = process.argv[2];
if (!url || !key || !workspaceId || !path)
  throw new Error(
    "Provide synthetic workspace configuration and protected output path.",
  );
const db = createClient(url, key, { auth: { persistSession: false } }),
  { data: ledger, error } = await db
    .from("deletion_ledger")
    .select("*")
    .eq("workspace_id", workspaceId);
if (error) throw new Error("Deletion ledger export failed.");
await writeFile(
  path,
  JSON.stringify({ workspaceId, at: new Date().toISOString(), ledger }),
  { mode: 0o600 },
);
console.log(
  "Current deletion ledger exported; retain separately from old backups.",
);
