create or replace function public.reserve_document(p_workspace uuid,p_actor uuid,p_expected bigint,p_vacancy text,p_batch text,p_document uuid,p_application text,p_filename text,p_size bigint,p_type text)
returns boolean language plpgsql set search_path='' as $$
declare current_payload jsonb;v jsonb;b jsonb;new_app jsonb;vi integer;bi integer;
begin
 perform public.check_member(p_workspace,p_actor);
 if exists(select 1 from public.workspaces where id=p_workspace and (settings->>'paused')::boolean) then raise exception 'processing paused'; end if;
 if p_size<1 or p_size>5242880 or p_type not in ('pdf','docx') then raise exception 'file bounds'; end if;
 select s.payload into current_payload from public.synthetic_workspaces s where workspace_id=p_workspace and version=p_expected for update;
 if not found then return false; end if;
 select value,(ordinality-1)::integer into v,vi from jsonb_array_elements(current_payload->'vacancies') with ordinality where value->>'id'=p_vacancy;
 select value,(ordinality-1)::integer into b,bi from jsonb_array_elements(v->'batches') with ordinality where value->>'id'=p_batch;
 if b is null or not (b->>'published')::boolean or (b->>'closed')::boolean or b ? 'snapshot' or jsonb_array_length(b->'applications')>=30 then raise exception 'intake unavailable'; end if;
 new_app:=jsonb_build_object('id',p_application,'name','','file','Synthetic document','state','processing','documentVersion',1,'runId',p_document,'rubricVersion',b->'rubricVersion','assessments','{}'::jsonb,'blocks','[]'::jsonb,'sourceChecked',false,'confirmed',false);
 current_payload:=jsonb_set(current_payload,array['vacancies',vi::text,'batches',bi::text,'applications'],(b->'applications')||jsonb_build_array(new_app));
 current_payload:=jsonb_set(current_payload,'{version}',to_jsonb(p_expected+1));
 update public.synthetic_workspaces set payload=current_payload,version=p_expected+1 where workspace_id=p_workspace;
 insert into public.documents(id,application_id,workspace_id,vacancy_key,batch_key,application_key,private_object_key,original_filename,size,type) values(p_document,public.record_id(p_workspace,p_application),p_workspace,p_vacancy,p_batch,p_application,p_workspace::text||'/'||p_document::text,p_filename,p_size,p_type);
 insert into public.audit_events(workspace_id,actor,operation,entity_id) values(p_workspace,p_actor,'reserve_document',p_document::text);
 return true;
end $$;
