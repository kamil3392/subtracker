-- migration: restrict grants on public.subscriptions
-- purpose: make table privileges explicit — authenticated gets only the four operations
--          covered by rls policies; anon gets nothing. truncate, references and trigger
--          (not covered by rls) are removed.
-- notes: privileges only. no changes to policies, columns or types; service_role unchanged.

revoke all on public.subscriptions from anon, authenticated;

grant select, insert, update, delete on public.subscriptions to authenticated;
