-- Phase 3: retention remains a disabled proposal. Holds are durable, audited
-- lifecycle controls, separate from replace-all workspace settings.
create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  version integer not null check (version > 0),
  proposed_days integer null check (proposed_days between 1 and 3650),
  start_event text not null check (start_event = 'batch_finalised_at'),
  automation_enabled boolean not null default false check (automation_enabled = false),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);
create table public.retention_holds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  scope text not null check (scope in ('workspace','application')),
  application_id uuid null references public.applications(id),
  application_key text null check (application_key is null or length(application_key) between 1 and 80),
  reason_code text not null check (reason_code in ('legal','investigation','subject_request','operational')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  released_by uuid null references auth.users(id),
  released_at timestamptz null,
  check ((scope = 'workspace' and application_id is null and application_key is null) or (scope = 'application' and application_key is not null)),
  check ((released_at is null and released_by is null) or (released_at is not null and released_by is not null))
);
create unique index retention_active_workspace_hold on public.retention_holds(workspace_id)
  where scope='workspace' and released_at is null;
create unique index retention_active_application_hold on public.retention_holds(workspace_id, application_key)
  where scope='application' and released_at is null;
create index retention_holds_workspace_active on public.retention_holds(workspace_id, created_at desc)
  where released_at is null;
alter table public.retention_policies enable row level security;
alter table public.retention_holds enable row level security;
revoke all on public.retention_policies, public.retention_holds from public, anon, authenticated;
grant all on public.retention_policies, public.retention_holds to service_role;
-- A fresh recovery target intentionally has different Auth users. Historical
-- actors remain in the source audit export; restored lifecycle records do not
-- falsely attribute old decisions to the bootstrap administrator.
alter table public.retention_policies alter column created_by drop not null;
alter table public.retention_holds alter column created_by drop not null;
-- A release remains released when its historical actor cannot exist in the
-- fresh Auth target. Preserve that actor only in recovery audit metadata.
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid='public.retention_holds'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%released_at%released_by%';
  if c is not null then execute format('alter table public.retention_holds drop constraint %I',c); end if;
end $$;

create function public.draft_retention_policy(p_workspace uuid, p_actor uuid, p_days integer, p_start_event text)
returns public.retention_policies language plpgsql set search_path='' as $$
declare s public.synthetic_workspaces; next_version integer; output public.retention_policies;
begin
  select * into s from public.synthetic_workspaces where workspace_id=p_workspace for update;
  if s.workspace_id is null then raise exception 'workspace unavailable'; end if;
  perform public.check_member(p_workspace,p_actor,true);
  if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'retention days'; end if;
  if p_start_event <> 'batch_finalised_at' then raise exception 'retention start'; end if;
  select coalesce(max(version),0)+1 into next_version from public.retention_policies where workspace_id=p_workspace;
  insert into public.retention_policies(workspace_id,version,proposed_days,start_event,automation_enabled,created_by)
  values(p_workspace,next_version,p_days,p_start_event,false,p_actor) returning * into output;
  s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
  update public.synthetic_workspaces set payload=s.payload, version=s.version+1, updated_at=now() where workspace_id=p_workspace;
  insert into public.audit_events(workspace_id,actor,operation,entity_id,safe_metadata)
  values(p_workspace,p_actor,'draft_retention_policy',p_workspace::text,jsonb_build_object('version',next_version,'proposedDays',p_days,'startEvent',p_start_event));
  return output;
end $$;

create function public.place_retention_hold(p_workspace uuid, p_actor uuid, p_scope text, p_application text, p_reason_code text)
returns public.retention_holds language plpgsql set search_path='' as $$
declare s public.synthetic_workspaces; entity uuid; output public.retention_holds;
begin
  select * into s from public.synthetic_workspaces where workspace_id=p_workspace for update;
  if s.workspace_id is null then raise exception 'workspace unavailable'; end if;
  perform public.check_member(p_workspace,p_actor,true);
  if p_scope not in ('workspace','application') then raise exception 'hold scope'; end if;
  if p_reason_code not in ('legal','investigation','subject_request','operational') then raise exception 'hold reason'; end if;
  if p_scope='application' then
    if p_application is null or length(p_application)>80 then raise exception 'application unavailable'; end if;
    entity:=public.record_id(p_workspace,p_application);
    if exists(select 1 from public.deletion_ledger where workspace_id=p_workspace and entity_id=entity) then raise exception 'content already deleted'; end if;
    if not exists(select 1 from public.applications a join public.batches b on b.id=a.batch_id join public.vacancies v on v.id=b.vacancy_id where a.id=entity and v.workspace_id=p_workspace) then raise exception 'application unavailable'; end if;
  elsif p_application is not null then raise exception 'workspace hold cannot identify application'; end if;
  insert into public.retention_holds(workspace_id,scope,application_id,application_key,reason_code,created_by)
  values(p_workspace,p_scope,entity,p_application,p_reason_code,p_actor)
  on conflict do nothing returning * into output;
  if output.id is null then
    select * into output from public.retention_holds where workspace_id=p_workspace and scope=p_scope
      and ((p_scope='workspace' and application_id is null) or application_key=p_application) and released_at is null;
    return output;
  end if;
  s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
  update public.synthetic_workspaces set payload=s.payload, version=s.version+1, updated_at=now() where workspace_id=p_workspace;
  insert into public.audit_events(workspace_id,actor,operation,entity_id,safe_metadata)
  values(p_workspace,p_actor,'place_retention_hold',coalesce(entity::text,p_workspace::text),jsonb_build_object('scope',p_scope,'reasonCode',p_reason_code));
  return output;
end $$;

create function public.release_retention_hold(p_workspace uuid, p_actor uuid, p_hold uuid)
returns public.retention_holds language plpgsql set search_path='' as $$
declare s public.synthetic_workspaces; output public.retention_holds;
begin
  select * into s from public.synthetic_workspaces where workspace_id=p_workspace for update;
  if s.workspace_id is null then raise exception 'workspace unavailable'; end if;
  perform public.check_member(p_workspace,p_actor,true);
  update public.retention_holds set released_at=now(), released_by=p_actor
  where id=p_hold and workspace_id=p_workspace and released_at is null returning * into output;
  if output.id is null then raise exception 'active hold unavailable'; end if;
  s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
  update public.synthetic_workspaces set payload=s.payload, version=s.version+1, updated_at=now() where workspace_id=p_workspace;
  insert into public.audit_events(workspace_id,actor,operation,entity_id,safe_metadata)
  values(p_workspace,p_actor,'release_retention_hold',coalesce(output.application_id::text,p_workspace::text),jsonb_build_object('scope',output.scope));
  return output;
end $$;

-- Keep the state-row lock first: a hold and deletion serialize so either the
-- hold wins without changing content, or deletion wins and a later hold fails.
create or replace function public.delete_application_content(p_workspace uuid,p_actor uuid,p_application text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.synthetic_workspaces;v jsonb;b jsonb;a jsonb;vi integer;bi integer;ai integer;entity uuid;keys jsonb;
begin
 select * into s from public.synthetic_workspaces where workspace_id=p_workspace for update;
 perform public.check_member(p_workspace,p_actor,true);
 entity:=public.record_id(p_workspace,p_application);
 if exists(select 1 from public.retention_holds where workspace_id=p_workspace and released_at is null and (scope='workspace' or application_key=p_application)) then raise exception 'retention hold active'; end if;
 select coalesce(jsonb_agg(private_object_key),'[]'::jsonb) into keys from public.documents where application_id=entity and workspace_id=p_workspace;
 if exists(select 1 from public.deletion_ledger where workspace_id=p_workspace and entity_id=entity) then return keys;end if;
 for v,vi in select value,(ordinality-1)::integer from jsonb_array_elements(s.payload->'vacancies') with ordinality loop
  for b,bi in select value,(ordinality-1)::integer from jsonb_array_elements(v->'batches') with ordinality loop
   select value,(ordinality-1)::integer into a,ai from jsonb_array_elements(b->'applications') with ordinality where value->>'id'=p_application;
   if a is not null then
    insert into public.deletion_ledger(workspace_id,entity_id) values(p_workspace,entity);
    a:=jsonb_build_object('id',p_application,'name','','file','Content deleted','state','disposed','disposition','deleted','dispositionReason','Authorised content deletion','documentVersion',a->'documentVersion','runId',a->'runId','rubricVersion',a->'rubricVersion','assessments','{}'::jsonb,'blocks','[]'::jsonb,'sourceChecked',false,'confirmed',false);
    b:=jsonb_set(b,array['applications',ai::text],a); b:=jsonb_set(b,'{selected}',coalesce((select jsonb_agg(x) from jsonb_array_elements(b->'selected') x where x#>>'{}'<>p_application),'[]'::jsonb));
    b:=jsonb_set(b,'{reason}','"Content removed by authorised deletion"');b:=jsonb_set(b,'{tieReason}','""');b:=jsonb_set(b,'{exceptions}','{}');
    if b ? 'snapshot' then b:=jsonb_set(b,'{snapshot,purgeReceipt}',to_jsonb(encode(extensions.digest(convert_to((b->'snapshot')::text,'utf8'),'sha256'),'hex'))); b:=jsonb_set(b,'{snapshot,applications}',coalesce((select jsonb_agg(x) from jsonb_array_elements(b->'snapshot'->'applications') x where x->>'id'<>p_application),'[]'::jsonb)); b:=jsonb_set(b,'{snapshot,selected}',b->'selected');b:=jsonb_set(b,'{snapshot,reason}',b->'reason');b:=jsonb_set(b,'{snapshot,tieReason}','""');b:=jsonb_set(b,'{snapshot,exceptions}','{}'); end if;
    s.payload:=jsonb_set(s.payload,array['vacancies',vi::text,'batches',bi::text],b); s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
    update public.synthetic_workspaces set payload=s.payload,version=s.version+1 where workspace_id=p_workspace;
    delete from public.application_reviews where application_id=entity; delete from public.assessment_runs where application_id=entity; delete from public.source_blocks where document_id in (select id from public.documents where application_id=entity);
    update public.documents set deletion_state='pending',status='deleted',original_filename='',hash=null,safe_error_code=null where application_id=entity; update public.applications set identity_record='{}',state='disposed',disposition_reason='Authorised content deletion' where id=entity;
    insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'delete_application_content',entity::text); return keys;
   end if;
  end loop;
 end loop; raise exception 'application unavailable';
end $$;

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('draft_retention_policy','place_retention_hold','release_retention_hold','delete_application_content') loop execute format('revoke all on function %s from public,anon,authenticated',f); execute format('grant execute on function %s to service_role',f); end loop;
end $$;
