-- Stage 2 foundation. Synthetic aggregate persistence is transitional;
-- document pipeline relations are reserved for Stage 3, not a live upload API.
create table public.workspaces (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.workspace_members (
 workspace_id uuid not null references public.workspaces(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('administrator','reviewer')), active boolean not null default true,
 primary key(workspace_id,user_id)
);
create function public.is_workspace_member(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=auth.uid() and m.active) and coalesce(auth.jwt()->>'aal','')='aal2';
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using(public.is_workspace_member(id));
create policy membership_read on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
create table public.synthetic_workspaces (
 workspace_id uuid primary key references public.workspaces(id), version bigint not null default 0,
 payload jsonb not null check(jsonb_typeof(payload)='object'), updated_at timestamptz not null default now()
);
alter table public.synthetic_workspaces enable row level security;
-- No authenticated Data API access to aggregate applicant content, including names.
-- Reads and validated writes go through the authenticated Next.js server.
create table public.audit_events (
 id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id),
 actor uuid references auth.users(id), operation text not null, entity_id text not null,
 created_at timestamptz not null default now(), safe_metadata jsonb not null default '{}'
);
alter table public.audit_events enable row level security;
create function public.save_synthetic_workspace(p_workspace uuid,p_actor uuid,p_expected bigint,p_payload jsonb,p_operation text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_payload jsonb; v jsonb; b jsonb; replacement jsonb;
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=p_actor and active) then raise exception 'membership denied'; end if;
 if p_operation in ('create','rubric','publish','next','dispose') and not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=p_actor and active and role='administrator') then raise exception 'role denied'; end if;
 select payload into old_payload from public.synthetic_workspaces where workspace_id=p_workspace and version=p_expected for update;
 if not found then return false; end if;
 if (p_payload->>'version')::bigint <> p_expected+1 then raise exception 'invalid version'; end if;
 -- Freeze the entire finalised batch. A new batch is permitted, reopening is not.
 for v in select value from jsonb_array_elements(old_payload->'vacancies') loop
  for b in select value from jsonb_array_elements(v->'batches') loop
   if b ? 'snapshot' then
    select nb into replacement from jsonb_array_elements(p_payload->'vacancies') nv, lateral jsonb_array_elements(nv->'batches') nb where nv->>'id'=v->>'id' and nb->>'id'=b->>'id';
    if replacement is null or replacement<>b then raise exception 'finalised batch is immutable'; end if;
   end if;
  end loop;
 end loop;
 update public.synthetic_workspaces set payload=p_payload,version=p_expected+1,updated_at=now() where workspace_id=p_workspace;
 insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,p_operation,p_workspace::text);
 return true;
end;
$$;
revoke all on function public.save_synthetic_workspace(uuid,uuid,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_synthetic_workspace(uuid,uuid,bigint,jsonb,text) to service_role;
revoke all on public.workspaces,public.workspace_members,public.synthetic_workspaces,public.audit_events from anon,authenticated;
grant select on public.workspaces,public.workspace_members to authenticated;
grant all on public.workspaces,public.workspace_members,public.synthetic_workspaces to service_role;
grant select,insert on public.audit_events to service_role;
grant usage,select on sequence public.audit_events_id_seq to service_role;
