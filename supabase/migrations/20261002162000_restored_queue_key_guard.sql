-- Only recreate queue messages when the restored processing key still
-- matches the current hash, application, rubric and pinned configuration.
create or replace function public.requeue_restored_documents(p_workspace uuid)
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
      and d0.processing_key = encode(extensions.digest(convert_to(
        jsonb_build_array(d0.hash, d0.application_key, b.rubric_version, d0.processing_config)::text,
        'utf8'), 'sha256'), 'hex')
      and a.state = 'processing'
      and b.state = 'intake'
      and exists (
        select 1 from public.synthetic_workspaces s,
          lateral jsonb_array_elements(s.payload->'vacancies') v,
          lateral jsonb_array_elements(v.value->'batches') batch,
          lateral jsonb_array_elements(batch.value->'applications') app
        where s.workspace_id = p_workspace
          and v.value->>'id' = d0.vacancy_key
          and batch.value->>'id' = d0.batch_key
          and app.value->>'id' = d0.application_key
          and app.value->>'state' = 'processing'
          and (app.value->>'rubricVersion')::integer = b.rubric_version
          and (batch.value->>'rubricVersion')::integer = b.rubric_version
      )
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
