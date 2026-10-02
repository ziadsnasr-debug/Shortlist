-- A retry starts a new processing state and retires any unacknowledged old
-- queue delivery. This prevents duplicate paid work after an ACK failure.
create or replace function public.retry_document(
  p_workspace uuid, p_actor uuid, p_document uuid, p_config text default null
) returns boolean language plpgsql set search_path = '' as $$
declare
  d public.documents;
  s public.synthetic_workspaces;
  current_batch public.batches;
  v jsonb; b jsonb; a jsonb;
  vi integer; bi integer; ai integer;
  old_message bigint;
  k text;
begin
  perform public.check_member(p_workspace, p_actor, true);
  select * into s from public.synthetic_workspaces
    where workspace_id = p_workspace for update;
  if s.workspace_id is null then return false; end if;
  if exists (
    select 1 from public.workspaces w
    where w.id = p_workspace and (w.settings->>'paused')::boolean is true
  ) then return false; end if;
  select * into d from public.documents
    where id = p_document and workspace_id = p_workspace for update;
  if d.id is null or d.status not in ('attention', 'readable_copy')
    or d.deletion_state <> 'retained' then return false; end if;
  select value, (ordinality-1)::integer into v, vi
    from jsonb_array_elements(s.payload->'vacancies') with ordinality
    where value->>'id' = d.vacancy_key;
  select value, (ordinality-1)::integer into b, bi
    from jsonb_array_elements(v->'batches') with ordinality
    where value->>'id' = d.batch_key;
  select value, (ordinality-1)::integer into a, ai
    from jsonb_array_elements(b->'applications') with ordinality
    where value->>'id' = d.application_key;
  if b is null or a is null or b ? 'snapshot'
    or (b->>'closed')::boolean
    or a->>'state' not in ('attention', 'readable_copy')
    or (a->>'rubricVersion')::integer <> (b->>'rubricVersion')::integer
  then return false; end if;
  select b0.* into current_batch from public.batches b0
    join public.applications a0 on a0.batch_id = b0.id
    where a0.id = d.application_id;
  if current_batch.id is null or current_batch.state <> 'intake' then return false; end if;
  p_config := coalesce(p_config, d.processing_config, 'legacy-unconfigured');
  if length(p_config) > 1000 or d.hash is null then return false; end if;
  k := encode(extensions.digest(convert_to(jsonb_build_array(
    d.hash, d.application_key, current_batch.rubric_version, p_config
  )::text, 'utf8'), 'sha256'), 'hex');

  for old_message in select q.msg_id from pgmq.q_shortlist_documents q
    where q.message->>'document_id' = d.id::text
  loop
    perform pgmq.archive('shortlist_documents', old_message);
  end loop;
  a := jsonb_set(a, '{state}', to_jsonb('processing'::text));
  s.payload := jsonb_set(s.payload,
    array['vacancies', vi::text, 'batches', bi::text, 'applications', ai::text], a);
  s.payload := jsonb_set(s.payload, '{version}', to_jsonb(s.version + 1));
  update public.synthetic_workspaces
    set payload = s.payload, version = s.version + 1
    where workspace_id = p_workspace;
  update public.documents
    set status = 'queued', attempts = 0, safe_error_code = null,
        processing_key = k, processing_config = p_config
    where id = d.id;
  perform pgmq.send('shortlist_documents', jsonb_build_object('document_id', d.id));
  return true;
end $$;
