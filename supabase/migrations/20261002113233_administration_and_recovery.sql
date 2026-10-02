create table public.request_limits(key text primary key,window_at timestamptz not null default now(),used integer not null default 0);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public,anon,authenticated;
grant all on public.request_limits to service_role;
create function public.consume_request_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path='' as $$
declare n integer;begin
 if p_limit<1 or p_limit>1000 or p_seconds<1 or p_seconds>3600 then raise exception 'bounds';end if;
 insert into public.request_limits(key,used) values(p_key,1) on conflict(key) do update set used=case when request_limits.window_at<now()-make_interval(secs=>p_seconds) then 1 else request_limits.used+1 end,window_at=case when request_limits.window_at<now()-make_interval(secs=>p_seconds) then now() else request_limits.window_at end returning used into n;
 return n<=p_limit;
end $$;
create function public.manage_member(p_workspace uuid,p_actor uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.workspaces where id=p_workspace for update;
 perform public.check_member(p_workspace,p_actor,true);
 if p_role not in ('administrator','reviewer') then raise exception 'role';end if;
 if (p_role<>'administrator' or not p_active) and exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=p_user and active and role='administrator') and (select count(*) from public.workspace_members where workspace_id=p_workspace and active and role='administrator')<=1 then raise exception 'last administrator';end if;
 insert into public.workspace_members(workspace_id,user_id,role,active) values(p_workspace,p_user,p_role,p_active) on conflict(workspace_id,user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'manage_member',p_user::text);
end $$;
create function public.manage_settings(p_workspace uuid,p_actor uuid,p_settings jsonb) returns void language plpgsql set search_path='' as $$
begin
 perform public.check_member(p_workspace,p_actor,true);
 if jsonb_typeof(p_settings->'paused')<>'boolean' or not p_settings ? 'retentionDays' or length(p_settings->>'incidentOwner')>100 then raise exception 'settings';end if;
 if p_settings->>'retentionDays' is not null and ((p_settings->>'retentionDays')::integer<1 or (p_settings->>'retentionDays')::integer>3650) then raise exception 'retention';end if;
 update public.workspaces set settings=p_settings where id=p_workspace;
 insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'manage_settings',p_workspace::text);
end $$;
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('consume_request_limit','manage_member','manage_settings') loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end $$;
