-- Keep queued and actual run configuration explicit across provider/snapshot changes.
alter table public.documents add column processing_config text;
create or replace function public.enqueue_document(p_workspace uuid,p_actor uuid,p_document uuid,p_hash text,p_config text,p_allowance integer)
returns boolean language plpgsql set search_path='' as $$
declare d public.documents;b public.batches;k text;used integer;
begin
 perform public.check_member(p_workspace,p_actor);
 select * into d from public.documents where id=p_document and workspace_id=p_workspace for update;
 if d.id is null or d.deletion_state<>'retained' then raise exception 'document unavailable'; end if;
 if d.status<>'reserved' then return false; end if;
 select b0.* into b from public.batches b0 join public.applications a on a.batch_id=b0.id where a.id=d.application_id;
 if b.state<>'intake' then raise exception 'intake unavailable'; end if;
 if exists(select 1 from public.documents where application_id in (select id from public.applications where batch_id=b.id) and hash=p_hash and id<>d.id and deletion_state='retained') then raise exception 'duplicate document'; end if;
 if p_allowance<1 or p_allowance>1000 or p_hash!~'^[a-f0-9]{64}$' then raise exception 'invalid allowance or hash'; end if;
 k:=encode(extensions.digest(convert_to(jsonb_build_array(p_hash,d.application_key,b.rubric_version,p_config)::text,'utf8'),'sha256'),'hex');
 insert into public.processing_allowances(workspace_id,period,used) values(p_workspace,date_trunc('month',now())::date,1) on conflict(workspace_id,period) do update set used=processing_allowances.used+1 returning processing_allowances.used into used;
 if used>p_allowance then raise exception 'processing allowance exhausted'; end if;
 update public.documents set hash=p_hash,processing_key=k,processing_config=p_config,status='queued' where id=d.id;
 perform pgmq.send('shortlist_documents',jsonb_build_object('document_id',d.id));
 return true;
end $$;
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
 if a is null or a->>'state'='disposed' or b ? 'snapshot' or (b->>'closed')::boolean or (a->>'rubricVersion')::integer<>(b->>'rubricVersion')::integer then return false;end if;
 if p_error is not null then
  st:=case when p_error='NEEDS_READABLE_COPY' then 'readable_copy' when d.attempts>=3 then 'attention' else 'queued' end;
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

drop function public.retry_document(uuid,uuid,uuid);
create function public.retry_document(p_workspace uuid,p_actor uuid,p_document uuid,p_config text default null) returns boolean language plpgsql set search_path='' as $$
declare d public.documents;b public.batches;k text;
begin
 perform public.check_member(p_workspace,p_actor,true);
 select * into d from public.documents where id=p_document and workspace_id=p_workspace for update;
 if d.id is null or d.status not in ('attention','readable_copy') or d.deletion_state<>'retained' then return false;end if;
 if exists(select 1 from public.batches b join public.applications a on a.batch_id=b.id where a.id=d.application_id and b.state<>'intake') then return false;end if;
 select b0.* into b from public.batches b0 join public.applications a on a.batch_id=b0.id where a.id=d.application_id;
 p_config:=coalesce(p_config,d.processing_config,'legacy-unconfigured');
 if length(p_config)>1000 or d.hash is null then return false;end if;
 k:=encode(extensions.digest(convert_to(jsonb_build_array(d.hash,d.application_key,b.rubric_version,p_config)::text,'utf8'),'sha256'),'hex');
 update public.documents set status='queued',attempts=0,safe_error_code=null,processing_key=k,processing_config=p_config where id=d.id;
 perform pgmq.send('shortlist_documents',jsonb_build_object('document_id',d.id));
 return true;
end $$;

revoke all on function public.retry_document(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.retry_document(uuid,uuid,uuid,text) to service_role;
