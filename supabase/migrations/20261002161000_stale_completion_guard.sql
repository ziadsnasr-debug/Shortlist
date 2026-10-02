-- A manual source or disposition supersedes queued processing. A changed
-- processing configuration needs explicit authorised retry, without using
-- three visibility windows or spending additional inference allowance.
create or replace function public.complete_document(p_document uuid,p_key text,p_result jsonb,p_outputs jsonb,p_usage jsonb,p_error text)
returns boolean language plpgsql set search_path='' as $$
declare d public.documents;s public.synthetic_workspaces;v jsonb;b jsonb;a jsonb;vi integer;bi integer;ai integer;st text;run uuid;
begin
 -- Lock workspace before document: same lock order as reservation/deletion.
 select s0.* into s from public.synthetic_workspaces s0 where workspace_id=(select workspace_id from public.documents where id=p_document) for update;
 select * into d from public.documents where id=p_document for update;
 if d.id is null or d.deletion_state<>'retained' or d.processing_key is null or d.processing_key is distinct from p_key then return false;end if;
 if d.status in ('complete','readable_copy','attention') then return true;end if;
 if exists(select 1 from public.workspaces where id=d.workspace_id and (settings->>'paused')::boolean) then return false;end if;
 select value,(ordinality-1)::integer into v,vi from jsonb_array_elements(s.payload->'vacancies') with ordinality where value->>'id'=d.vacancy_key;
 select value,(ordinality-1)::integer into b,bi from jsonb_array_elements(v->'batches') with ordinality where value->>'id'=d.batch_key;
 select value,(ordinality-1)::integer into a,ai from jsonb_array_elements(b->'applications') with ordinality where value->>'id'=d.application_key;
 if a is null or a->>'state'<>'processing' or b ? 'snapshot' or (b->>'closed')::boolean or (a->>'rubricVersion')::integer<>(b->>'rubricVersion')::integer then return false;end if;
 if p_error is not null then
  st:=case when p_error='NEEDS_READABLE_COPY' then 'readable_copy' when p_error='PROCESSING_CONFIGURATION_CHANGED' then 'attention' when d.attempts>=3 then 'attention' else 'queued' end;
  if st='queued' then return false;end if;
  a:=jsonb_set(a,'{state}',to_jsonb(st));a:=jsonb_set(a,'{sourceFlag}',to_jsonb('Processing needs attention. Retry or provide checked manual passages.'::text));
 else
  st:=p_result->>'state';
  if st not in ('ready','readable_copy') or p_result->>'id'<>a->>'id' or (p_result->>'documentVersion')::integer<>(a->>'documentVersion')::integer then raise exception 'invalid processing result';end if;
  a:=p_result;
  run:=gen_random_uuid();a:=jsonb_set(a,'{runId}',to_jsonb(run));
  insert into public.assessment_runs(id,processing_key,application_id,document_id,rubric_version,config_version,pass_outputs,merged_suggestions,usage,state) values(run,p_key,d.application_id,d.id,(b->>'rubricVersion')::integer,coalesce(d.processing_config,'legacy-evidence-v1'),p_outputs,a->'assessments',p_usage,'complete') on conflict(processing_key) do nothing;
 end if;
 s.payload:=jsonb_set(s.payload,array['vacancies',vi::text,'batches',bi::text,'applications',ai::text],a);
 s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
 update public.synthetic_workspaces set payload=s.payload,version=s.version+1 where workspace_id=s.workspace_id;
 update public.documents set status=case when st='ready' then 'complete' else st end,safe_error_code=p_error where id=d.id;
 if p_error is null then
  delete from public.source_blocks where document_id=d.id;
  insert into public.source_blocks(id,document_id,locator_json,original_text,assessment_text,input_method) select x->>'id',d.id,jsonb_build_object('label',x->>'locator'),x->>'text',coalesce(x->>'assessmentText',x->>'text'),coalesce(x->>'inputMethod','parsed') from jsonb_array_elements(a->'blocks') x;
 end if;
 insert into public.audit_events(workspace_id,operation,entity_id) values(d.workspace_id,'complete_document',d.id::text);
 return true;
end $$;
