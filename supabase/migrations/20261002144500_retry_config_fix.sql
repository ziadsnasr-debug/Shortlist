-- Avoid row-variable/SQL-alias ambiguity in explicit configuration retry.
create or replace function public.retry_document(p_workspace uuid,p_actor uuid,p_document uuid,p_config text default null) returns boolean language plpgsql set search_path='' as $$
declare d public.documents;current_batch public.batches;k text;
begin
 perform public.check_member(p_workspace,p_actor,true);
 select * into d from public.documents where id=p_document and workspace_id=p_workspace for update;
 if d.id is null or d.status not in ('attention','readable_copy') or d.deletion_state<>'retained' then return false;end if;
 if exists(select 1 from public.batches b join public.applications a on a.batch_id=b.id where a.id=d.application_id and b.state<>'intake') then return false;end if;
 select b0.* into current_batch from public.batches b0 join public.applications a on a.batch_id=b0.id where a.id=d.application_id;
 p_config:=coalesce(p_config,d.processing_config,'legacy-unconfigured');
 if length(p_config)>1000 or d.hash is null then return false;end if;
 k:=encode(extensions.digest(convert_to(jsonb_build_array(d.hash,d.application_key,current_batch.rubric_version,p_config)::text,'utf8'),'sha256'),'hex');
 update public.documents set status='queued',attempts=0,safe_error_code=null,processing_key=k,processing_config=p_config where id=d.id;
 perform pgmq.send('shortlist_documents',jsonb_build_object('document_id',d.id));
 return true;
end $$;
