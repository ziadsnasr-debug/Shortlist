create function public.reserve_processing_budget(p_workspace uuid,p_limit integer) returns boolean language plpgsql set search_path='' as $$
declare n integer;begin
 if p_limit<1 or p_limit>1000 then raise exception 'budget';end if;
 insert into public.processing_allowances(workspace_id,period,used) values(p_workspace,date_trunc('month',now())::date,1) on conflict(workspace_id,period) do update set used=processing_allowances.used+1 returning used into n;
 if n>p_limit then raise exception 'budget exhausted';end if;
 return true;
end $$;
-- pgmq visibility is the lease; no additional lease system. Each attempt consumes allowance.
create or replace function public.document_attempt(p_document uuid) returns boolean language plpgsql set search_path='' as $$
declare d public.documents;
begin
 select * into d from public.documents where id=p_document for update;
 if d.id is null or d.deletion_state<>'retained' or d.status in ('complete','readable_copy','attention') or d.attempts>=3 then return false;end if;
 if exists(select 1 from public.workspaces where id=d.workspace_id and (settings->>'paused')::boolean) then return false;end if;
 update public.documents set attempts=attempts+1 where id=d.id;
 return true;
end $$;
create function public.enforce_deletion_ledger() returns trigger language plpgsql set search_path='' as $$
declare v jsonb;b jsonb;a jsonb;begin
 for v in select value from jsonb_array_elements(new.payload->'vacancies') loop
  for b in select value from jsonb_array_elements(v->'batches') loop
   for a in select value from jsonb_array_elements(b->'applications') loop
    if exists(select 1 from public.deletion_ledger where workspace_id=new.workspace_id and entity_id=public.record_id(new.workspace_id,a->>'id')) then
     if a->>'name'<>'' or jsonb_array_length(a->'blocks')>0 or a->'assessments'<>'{}'::jsonb or (a->>'confirmed')::boolean then raise exception 'deleted content cannot be restored';end if;
     if exists(select 1 from jsonb_array_elements(coalesce(b->'snapshot'->'applications','[]'::jsonb)) x where x->>'id'=a->>'id') then raise exception 'deleted snapshot cannot be restored';end if;
    end if;
   end loop;
  end loop;
 end loop;return new;
end $$;
create trigger deletion_ledger_guard before insert or update on public.synthetic_workspaces for each row execute function public.enforce_deletion_ledger();
create function public.block_deleted_document() returns trigger language plpgsql set search_path='' as $$
begin
 if new.deletion_state='retained' and exists(select 1 from public.deletion_ledger where workspace_id=new.workspace_id and entity_id=new.application_id) then raise exception 'deleted document cannot be restored';end if;return new;
end $$;
create trigger deleted_document_guard before insert or update on public.documents for each row execute function public.block_deleted_document();
create function public.sync_manual_reviews() returns trigger language plpgsql set search_path='' as $$
declare v jsonb;b jsonb;a jsonb;d public.documents;run uuid;
begin
 for v in select value from jsonb_array_elements(new.payload->'vacancies') loop
  for b in select value from jsonb_array_elements(v->'batches') loop
   for a in select value from jsonb_array_elements(b->'applications') loop
    select * into d from public.documents where application_id=public.record_id(new.workspace_id,a->>'id') and deletion_state='retained' limit 1;
    if d.id is null then continue;end if;
    if exists(select 1 from jsonb_array_elements(a->'blocks') x where x->>'inputMethod'='manual') then
     update public.documents set status='complete',source_quality='manual',extraction_version='manual-v1' where id=d.id;
     delete from public.source_blocks where document_id=d.id;
     insert into public.source_blocks(id,document_id,locator_json,original_text,assessment_text,input_method) select x->>'id',d.id,jsonb_build_object('label',x->>'locator'),x->>'text',coalesce(x->>'assessmentText',x->>'text'),'manual' from jsonb_array_elements(a->'blocks') x;
     run:=(a->>'runId')::uuid;
     insert into public.assessment_runs(id,processing_key,application_id,document_id,rubric_version,config_version,merged_suggestions,state) values(run,'manual:'||run::text,d.application_id,d.id,(b->>'rubricVersion')::integer,'manual-v1',a->'assessments','complete') on conflict(id) do nothing;
    end if;
    if exists(select 1 from public.assessment_runs where id=(a->>'runId')::uuid) then
     insert into public.application_reviews(application_id,assessment_run_id,effective_categories,evidence_references,essential_checks,reasons,reviewed_by,reviewed_at,version) values(d.application_id,(a->>'runId')::uuid,a->'assessments','{}','{}','{}',case when (a->>'confirmed')::boolean then (a->>'reviewedBy')::uuid else null end,case when (a->>'confirmed')::boolean then (a->>'reviewedAt')::timestamptz else null end,new.version) on conflict(application_id) do update set assessment_run_id=excluded.assessment_run_id,effective_categories=excluded.effective_categories,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,version=excluded.version;
    end if;
   end loop;
  end loop;
 end loop;return new;
end $$;
create trigger sync_manual_review after insert or update on public.synthetic_workspaces for each row execute function public.sync_manual_reviews();
revoke all on function public.reserve_processing_budget(uuid,integer),public.enforce_deletion_ledger(),public.block_deleted_document(),public.sync_manual_reviews() from public,anon,authenticated;
grant execute on function public.reserve_processing_budget(uuid,integer) to service_role;
