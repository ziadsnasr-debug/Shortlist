-- Server-only operations; no client access to identity/source/model output.
alter table public.workspaces add column settings jsonb not null default '{"paused":false,"retentionDays":null,"incidentOwner":""}';
alter table public.documents add column workspace_id uuid references public.workspaces(id), add column vacancy_key text, add column batch_key text, add column application_key text, add column status text not null default 'reserved', add column processing_key text, add column reserved_at timestamptz not null default now(), add column attempts integer not null default 0, add column safe_error_code text;
alter table public.documents alter column hash drop not null;
create unique index document_processing_identity on public.documents(processing_key) where processing_key is not null;
create table public.processing_allowances(workspace_id uuid not null references public.workspaces(id), period date not null, used integer not null default 0, primary key(workspace_id,period));
alter table public.processing_allowances enable row level security;
revoke all on public.processing_allowances from public,anon,authenticated;
grant all on public.processing_allowances to service_role;
create function public.record_id(p_workspace uuid,p_key text) returns uuid language sql immutable set search_path='' as $$ select md5(p_workspace::text||':'||p_key)::uuid $$;
revoke all on function public.record_id(uuid,text) from public,anon,authenticated;
grant execute on function public.record_id(uuid,text) to service_role;
create function public.check_member(p_workspace uuid,p_actor uuid,p_admin boolean default false) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=p_actor and active and (not p_admin or role='administrator')) then raise exception 'access denied'; end if;
end $$;
revoke all on function public.check_member(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.check_member(uuid,uuid,boolean) to service_role;
create function public.sync_workspace_relations() returns trigger language plpgsql set search_path='' as $$
declare v jsonb;b jsonb;a jsonb;vi uuid;bi uuid;ai uuid;
begin
 for v in select value from jsonb_array_elements(new.payload->'vacancies') loop
  vi:=public.record_id(new.workspace_id,v->>'id');
  insert into public.vacancies(id,workspace_id,title,department,job_description) values(vi,new.workspace_id,v->>'title',v->>'team',v->>'description') on conflict(id) do update set title=excluded.title,department=excluded.department,job_description=excluded.job_description;
  for b in select value from jsonb_array_elements(v->'batches') loop
   bi:=public.record_id(new.workspace_id,b->>'id');
   insert into public.batches(id,vacancy_id,period_label,state,rubric_json,rubric_version,processing_config_version,final_snapshot_json) values(bi,vi,b->>'label',case when b ? 'snapshot' then 'finalised' when (b->>'closed')::boolean then 'review' when (b->>'published')::boolean then 'intake' else 'criteria' end,b->'rubric',(b->>'rubricVersion')::integer,'evidence-v1',b->'snapshot') on conflict(id) do update set state=excluded.state,rubric_json=excluded.rubric_json,rubric_version=excluded.rubric_version,final_snapshot_json=excluded.final_snapshot_json;
   for a in select value from jsonb_array_elements(b->'applications') loop
    ai:=public.record_id(new.workspace_id,a->>'id');
    insert into public.applications(id,batch_id,anonymous_label,identity_record,state,disposition_reason,version) values(ai,bi,a->>'id',jsonb_build_object('name',a->>'name'),a->>'state',a->>'dispositionReason',new.version) on conflict(id) do update set identity_record=excluded.identity_record,state=excluded.state,disposition_reason=excluded.disposition_reason,version=excluded.version;
   end loop;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.sync_workspace_relations() from public,anon,authenticated;
create trigger sync_relations after insert or update on public.synthetic_workspaces for each row execute function public.sync_workspace_relations();
update public.synthetic_workspaces set payload=payload;
create function public.reserve_document(p_workspace uuid,p_actor uuid,p_expected bigint,p_vacancy text,p_batch text,p_document uuid,p_application text,p_filename text,p_size bigint,p_type text)
returns boolean language plpgsql set search_path='' as $$
declare payload jsonb;v jsonb;b jsonb;new_app jsonb;vi integer;bi integer;
begin
 perform public.check_member(p_workspace,p_actor);
 if exists(select 1 from public.workspaces where id=p_workspace and (settings->>'paused')::boolean) then raise exception 'processing paused'; end if;
 if p_size<1 or p_size>5242880 or p_type not in ('pdf','docx') then raise exception 'file bounds'; end if;
 select s.payload into payload from public.synthetic_workspaces s where workspace_id=p_workspace and version=p_expected for update;
 if not found then return false; end if;
 select value,(ordinality-1)::integer into v,vi from jsonb_array_elements(payload->'vacancies') with ordinality where value->>'id'=p_vacancy;
 select value,(ordinality-1)::integer into b,bi from jsonb_array_elements(v->'batches') with ordinality where value->>'id'=p_batch;
 if b is null or not (b->>'published')::boolean or (b->>'closed')::boolean or b ? 'snapshot' or jsonb_array_length(b->'applications')>=30 then raise exception 'intake unavailable'; end if;
 new_app:=jsonb_build_object('id',p_application,'name','','file','Synthetic document','state','processing','documentVersion',1,'runId',p_document,'rubricVersion',b->'rubricVersion','assessments','{}'::jsonb,'blocks','[]'::jsonb,'sourceChecked',false,'confirmed',false);
 payload:=jsonb_set(payload,array['vacancies',vi::text,'batches',bi::text,'applications'],(b->'applications')||jsonb_build_array(new_app));
 payload:=jsonb_set(payload,'{version}',to_jsonb(p_expected+1));
 update public.synthetic_workspaces set payload=payload,version=p_expected+1 where workspace_id=p_workspace;
 insert into public.documents(id,application_id,workspace_id,vacancy_key,batch_key,application_key,private_object_key,original_filename,size,type) values(p_document,public.record_id(p_workspace,p_application),p_workspace,p_vacancy,p_batch,p_application,p_workspace::text||'/'||p_document::text,p_filename,p_size,p_type);
 insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'reserve_document',p_document::text);
 return true;
end $$;
create function public.enqueue_document(p_workspace uuid,p_actor uuid,p_document uuid,p_hash text,p_config text,p_allowance integer)
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
 update public.documents set hash=p_hash,processing_key=k,status='queued' where id=d.id;
 perform pgmq.send('shortlist_documents',jsonb_build_object('document_id',d.id));
 return true;
end $$;
create function public.read_document_queue() returns table(msg_id bigint,read_ct integer,message jsonb) language sql set search_path='' as $$ select msg_id,read_ct,message from pgmq.read('shortlist_documents',360,2) $$;
create function public.ack_document_queue(p_message bigint) returns boolean language sql set search_path='' as $$ select pgmq.archive('shortlist_documents',p_message) $$;
create function public.document_attempt(p_document uuid) returns boolean language plpgsql set search_path='' as $$
declare d public.documents;
begin
 select * into d from public.documents where id=p_document for update;
 if d.id is null or d.deletion_state<>'retained' or d.status in ('complete','readable_copy','attention') or d.attempts>=3 then return false;end if;
 if exists(select 1 from public.workspaces where id=d.workspace_id and (settings->>'paused')::boolean) then return false;end if;
 update public.documents set attempts=attempts+1 where id=d.id;
 return true;
end $$;
create function public.complete_document(p_document uuid,p_key text,p_result jsonb,p_outputs jsonb,p_usage jsonb,p_error text)
returns boolean language plpgsql set search_path='' as $$
declare d public.documents;s public.synthetic_workspaces;v jsonb;b jsonb;a jsonb;vi integer;bi integer;ai integer;st text;run uuid;
begin
 -- Lock workspace before document: same lock order as reservation/deletion.
 select s0.* into s from public.synthetic_workspaces s0 where workspace_id=(select workspace_id from public.documents where id=p_document) for update;
 select * into d from public.documents where id=p_document for update;
 if d.id is null or d.deletion_state<>'retained' or d.processing_key<>p_key then return false;end if;
 if d.status in ('complete','readable_copy') then return true;end if;
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
  insert into public.assessment_runs(id,processing_key,application_id,document_id,rubric_version,config_version,pass_outputs,merged_suggestions,usage,state) values(run,p_key,d.application_id,d.id,(b->>'rubricVersion')::integer,'evidence-v1',p_outputs,a->'assessments',p_usage,'complete') on conflict(processing_key) do nothing;
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
create function public.retry_document(p_workspace uuid,p_actor uuid,p_document uuid) returns boolean language plpgsql set search_path='' as $$
declare d public.documents;
begin
 perform public.check_member(p_workspace,p_actor,true);
 select * into d from public.documents where id=p_document and workspace_id=p_workspace for update;
 if d.id is null or d.status not in ('attention','readable_copy') or d.deletion_state<>'retained' then return false;end if;
 if exists(select 1 from public.batches b join public.applications a on a.batch_id=b.id where a.id=d.application_id and b.state<>'intake') then return false;end if;
 update public.documents set status='queued',attempts=0,safe_error_code=null where id=d.id;
 perform pgmq.send('shortlist_documents',jsonb_build_object('document_id',d.id));
 return true;
end $$;
-- Default execute is PUBLIC: explicitly deny every server-only function.
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('reserve_document','enqueue_document','read_document_queue','ack_document_queue','document_attempt','complete_document','retry_document') loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end $$;
