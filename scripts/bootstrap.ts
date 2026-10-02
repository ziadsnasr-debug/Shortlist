// Server-side setup only. No key or password is printed or written.
import { createClient } from "@supabase/supabase-js";
import { seed } from "../fixtures/synthetic/seed";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  admin = process.env.BOOTSTRAP_ADMIN_USER_ID;
if (!url || !key || !admin)
  throw new Error(
    "Set Supabase URL, service key and an existing invited admin user ID in your process environment.",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
const { data: user, error: userError } =
  await client.auth.admin.getUserById(admin);
if (userError || !user.user)
  throw new Error("Administrator user does not exist.");
const { data: workspace, error } = await client
  .from("workspaces")
  .insert({ name: "Shortlist synthetic pilot" })
  .select("id")
  .single();
if (error) throw new Error("Workspace setup failed.");
const { error: memberError } = await client
  .from("workspace_members")
  .insert({
    workspace_id: workspace.id,
    user_id: admin,
    role: "administrator",
  });
if (memberError) throw new Error("Membership setup failed.");
const { error: stateError } = await client
  .from("synthetic_workspaces")
  .insert({ workspace_id: workspace.id, payload: seed(), version: 0 });
if (stateError) throw new Error("Synthetic state setup failed.");
console.log(`Workspace created. Set WORKSPACE_ID=${workspace.id}`);
