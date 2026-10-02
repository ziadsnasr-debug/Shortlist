-- A signed upload can recreate a removed original for two hours after issue.
-- Keep a purge pending until the last reservation's token has expired, then
-- sweep Storage again before marking the ledger complete. The ten minute
-- margin covers the interval between reservation and URL issuance.
alter table public.deletion_ledger
  add column ready_after timestamptz not null default now();

update public.deletion_ledger l
set ready_after = greatest(now(), coalesce((
  select max(d.reserved_at) + interval '130 minutes'
  from public.documents d
  where d.workspace_id = l.workspace_id and d.application_id = l.entity_id
), now())),
completed_at = null
where exists (
  select 1 from public.documents d
  where d.workspace_id = l.workspace_id and d.application_id = l.entity_id
);

create function public.set_deletion_ready_after()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.ready_after := greatest(now(), coalesce((
    select max(d.reserved_at) + interval '130 minutes'
    from public.documents d
    where d.workspace_id = new.workspace_id and d.application_id = new.entity_id
  ), now()));
  return new;
end $$;

create trigger deletion_ready_after_guard
before insert on public.deletion_ledger
for each row execute function public.set_deletion_ready_after();

create or replace function public.finish_deletion(p_workspace uuid, p_entity uuid)
returns void language plpgsql set search_path = '' as $$
declare deletion public.deletion_ledger;
begin
  select * into deletion from public.deletion_ledger
  where workspace_id = p_workspace and entity_id = p_entity for update;
  if deletion.id is null then raise exception 'missing deletion'; end if;
  if now() < deletion.ready_after then raise exception 'upload authorization still active'; end if;
  update public.documents set deletion_state = 'deleted'
  where application_id = p_entity and workspace_id = p_workspace;
  update public.deletion_ledger set completed_at = now()
  where id = deletion.id;
end $$;

-- Restore operates while the target is paused. Rebuild only missing pgmq
-- messages for currently valid, unfinished documents; never reset attempts
-- or change the processing configuration. A later redelivery makes an
-- exhausted third attempt visible as Needs attention without inference.
create function public.requeue_restored_documents(p_workspace uuid)
returns integer language plpgsql set search_path = '' as $$
declare d public.documents; requeued integer := 0;
begin
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace and (w.settings->>'paused')::boolean is true
  ) then raise exception 'restore target must remain paused'; end if;
  for d in
    select d0.* from public.documents d0
    join public.applications a on a.id = d0.application_id
    join public.batches b on b.id = a.batch_id
    where d0.workspace_id = p_workspace
      and d0.status = 'queued'
      and d0.deletion_state = 'retained'
      and d0.hash ~ '^[a-f0-9]{64}$'
      and d0.processing_key is not null
      and d0.processing_config is not null
      and a.state <> 'disposed'
      and b.state = 'intake'
      and not exists (
        select 1 from public.deletion_ledger l
        where l.workspace_id = p_workspace and l.entity_id = d0.application_id
      )
    order by d0.reserved_at for update of d0
  loop
    if not exists (
      select 1 from pgmq.q_shortlist_documents q
      where q.message->>'document_id' = d.id::text
    ) then
      perform pgmq.send('shortlist_documents', jsonb_build_object('document_id', d.id));
      requeued := requeued + 1;
    end if;
  end loop;
  return requeued;
end $$;

-- Invalid limits and a paused workspace must never consume paid work.
create or replace function public.reserve_processing_budget(p_workspace uuid, p_limit integer)
returns boolean language plpgsql set search_path = '' as $$
declare n integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'budget'; end if;
  if exists (
    select 1 from public.workspaces w
    where w.id = p_workspace and (w.settings->>'paused')::boolean is true
  ) then raise exception 'processing paused'; end if;
  insert into public.processing_allowances(workspace_id, period, used)
  values(p_workspace, date_trunc('month', now())::date, 1)
  on conflict(workspace_id, period) do update
  set used = processing_allowances.used + 1 returning used into n;
  if n > p_limit then raise exception 'budget exhausted'; end if;
  return true;
end $$;

revoke all on function public.set_deletion_ready_after(),
  public.requeue_restored_documents(uuid),
  public.reserve_processing_budget(uuid, integer)
from public, anon, authenticated;
grant execute on function public.requeue_restored_documents(uuid),
  public.reserve_processing_budget(uuid, integer) to service_role;
