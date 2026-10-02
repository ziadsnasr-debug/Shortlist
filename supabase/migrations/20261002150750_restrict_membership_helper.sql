-- Hosted Supabase can grant anon explicit EXECUTE by default; revoking PUBLIC
-- alone does not remove that grant. Only authenticated RLS callers need this.
revoke execute on function public.is_workspace_member(uuid) from anon;
