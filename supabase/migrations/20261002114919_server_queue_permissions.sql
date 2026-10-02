-- The private queue is accessible only to the privileged server role.
grant usage on schema pgmq to service_role;
grant execute on all functions in schema pgmq to service_role;
grant select,insert,update,delete on pgmq.q_shortlist_documents,pgmq.a_shortlist_documents to service_role;
grant usage,select on all sequences in schema pgmq to service_role;
