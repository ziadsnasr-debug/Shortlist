create function public.delete_application_content(p_workspace uuid,p_actor uuid,p_application text)
returns jsonb language plpgsql set search_path='' as $$
declare s public.synthetic_workspaces;v jsonb;b jsonb;a jsonb;vi integer;bi integer;ai integer;entity uuid;keys jsonb;
begin
 select * into s from public.synthetic_workspaces where workspace_id=p_workspace for update;
 perform public.check_member(p_workspace,p_actor,true);
 entity:=public.record_id(p_workspace,p_application);
 select coalesce(jsonb_agg(private_object_key),'[]'::jsonb) into keys from public.documents where application_id=entity and workspace_id=p_workspace;
 if exists(select 1 from public.deletion_ledger where workspace_id=p_workspace and entity_id=entity) then return keys;end if;
 for v,vi in select value,(ordinality-1)::integer from jsonb_array_elements(s.payload->'vacancies') with ordinality loop
  for b,bi in select value,(ordinality-1)::integer from jsonb_array_elements(v->'batches') with ordinality loop
   select value,(ordinality-1)::integer into a,ai from jsonb_array_elements(b->'applications') with ordinality where value->>'id'=p_application;
   if a is not null then
    insert into public.deletion_ledger(workspace_id,entity_id) values(p_workspace,entity);
    a:=jsonb_build_object('id',p_application,'name','','file','Content deleted','state','disposed','disposition','deleted','dispositionReason','Authorised content deletion','documentVersion',a->'documentVersion','runId',a->'runId','rubricVersion',a->'rubricVersion','assessments','{}'::jsonb,'blocks','[]'::jsonb,'sourceChecked',false,'confirmed',false);
    b:=jsonb_set(b,array['applications',ai::text],a);
    b:=jsonb_set(b,'{selected}',coalesce((select jsonb_agg(x) from jsonb_array_elements(b->'selected') x where x#>>'{}'<>p_application),'[]'::jsonb));
    b:=jsonb_set(b,'{reason}','"Content removed by authorised deletion"');b:=jsonb_set(b,'{tieReason}','""');b:=jsonb_set(b,'{exceptions}','{}');
    if b ? 'snapshot' then
     -- A purge is not reopening/adjudication: erase content, retain an integrity receipt.
     b:=jsonb_set(b,'{snapshot,purgeReceipt}',to_jsonb(encode(extensions.digest(convert_to((b->'snapshot')::text,'utf8'),'sha256'),'hex')));
     b:=jsonb_set(b,'{snapshot,applications}',coalesce((select jsonb_agg(x) from jsonb_array_elements(b->'snapshot'->'applications') x where x->>'id'<>p_application),'[]'::jsonb));
     b:=jsonb_set(b,'{snapshot,selected}',b->'selected');b:=jsonb_set(b,'{snapshot,reason}',b->'reason');b:=jsonb_set(b,'{snapshot,tieReason}','""');b:=jsonb_set(b,'{snapshot,exceptions}','{}');
    end if;
    s.payload:=jsonb_set(s.payload,array['vacancies',vi::text,'batches',bi::text],b);
    s.payload:=jsonb_set(s.payload,'{version}',to_jsonb(s.version+1));
    update public.synthetic_workspaces set payload=s.payload,version=s.version+1 where workspace_id=p_workspace;
    delete from public.application_reviews where application_id=entity;
    delete from public.assessment_runs where application_id=entity;
    delete from public.source_blocks where document_id in (select id from public.documents where application_id=entity);
    update public.documents set deletion_state='pending',status='deleted',original_filename='',hash=null,safe_error_code=null where application_id=entity;
    update public.applications set identity_record='{}',state='disposed',disposition_reason='Authorised content deletion' where id=entity;
    insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'delete_application_content',entity::text);
    return keys;
   end if;
  end loop;
 end loop;
 raise exception 'application unavailable';
end $$;
create function public.finish_deletion(p_workspace uuid,p_entity uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.deletion_ledger where workspace_id=p_workspace and entity_id=p_entity) then raise exception 'missing deletion';end if;
 update public.documents set deletion_state='deleted' where application_id=p_entity and workspace_id=p_workspace;
 update public.deletion_ledger set completed_at=now() where workspace_id=p_workspace and entity_id=p_entity;
end $$;
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('delete_application_content','finish_deletion') loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end $$;
