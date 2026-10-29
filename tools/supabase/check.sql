-- Live check of blindpanel's schema on the Supabase project, run as postgres:
--   op run --env-file=<hub>/tools/stilldrawn-supabase.env.op -- psql -X -q -o /dev/null -f tools/supabase/check.sql
-- Stops at the first failure. Everything runs in one transaction that is rolled back.
\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FAIL: %', m; end if;
  raise notice 'ok: %', m;
end $$;

select pg_temp.ok(to_regnamespace('blindpanel') is not null, 'schema blindpanel exists');
select pg_temp.ok(c.relrowsecurity and c.relforcerowsecurity, format('RLS enabled and forced on blindpanel.%s', c.relname))
  from pg_class c where c.relnamespace = 'blindpanel'::regnamespace and c.relname in ('submissions', 'settings');
select pg_temp.ok((select count(*) from pg_class c where c.relnamespace = 'blindpanel'::regnamespace and c.relkind = 'r') = 2, 'exactly two tables');
select pg_temp.ok(not exists (select 1 from pg_policies where schemaname = 'blindpanel'), 'no policies');

select pg_temp.ok(not has_schema_privilege(r, 'blindpanel', 'USAGE'), format('%s has no USAGE on the schema', r)),
       pg_temp.ok(not has_table_privilege(r, 'blindpanel.submissions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), format('%s has no privilege on submissions', r)),
       pg_temp.ok(not has_table_privilege(r, 'blindpanel.settings', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), format('%s has no privilege on settings', r)),
       pg_temp.ok(not has_function_privilege(r, 'blindpanel.tally(text,integer)', 'EXECUTE'), format('%s cannot execute tally()', r)),
       pg_temp.ok(not has_function_privilege(r, 'blindpanel.enforce_caps()', 'EXECUTE'), format('%s cannot execute enforce_caps()', r))
  from unnest(array['anon', 'authenticated']) r;

select pg_temp.ok(has_schema_privilege('service_role', 'blindpanel', 'USAGE'), 'service_role has USAGE');
select pg_temp.ok(has_table_privilege('service_role', 'blindpanel.submissions', 'SELECT'), 'service_role can select submissions');
select pg_temp.ok(has_table_privilege('service_role', 'blindpanel.submissions', 'INSERT'), 'service_role can insert submissions');
select pg_temp.ok(not has_table_privilege('service_role', 'blindpanel.submissions', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'service_role cannot update, delete or truncate submissions');
select pg_temp.ok(not has_table_privilege('service_role', 'blindpanel.settings', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'service_role has no privilege on settings');
select pg_temp.ok(has_function_privilege('service_role', 'blindpanel.tally(text,integer)', 'EXECUTE'), 'service_role can execute tally()');
select pg_temp.ok(not has_function_privilege('service_role', 'blindpanel.enforce_caps()', 'EXECUTE'), 'service_role cannot execute enforce_caps()');

-- real attempts, not just the catalogue
set local role anon;
do $$ begin
  perform 1 from blindpanel.submissions limit 1;
  raise exception 'FAIL: anon read submissions';
exception when insufficient_privilege then raise notice 'ok: anon is refused a read';
end $$;
reset role;
set local role authenticated;
do $$ begin
  insert into blindpanel.submissions (study, instrument, session, item_order, answers, delivery)
  values ('check', 'x', gen_random_uuid(), '{}', '{}', '{}');
  raise exception 'FAIL: authenticated inserted a row';
exception when insufficient_privilege then raise notice 'ok: authenticated is refused an insert';
end $$;
reset role;
set local role service_role;
do $$ begin
  delete from blindpanel.submissions where false;
  raise exception 'FAIL: service_role ran a delete';
exception when insufficient_privilege then raise notice 'ok: service_role is refused a delete';
end $$;
do $$ begin
  update blindpanel.submissions set flags = '{}' where false;
  raise exception 'FAIL: service_role ran an update';
exception when insufficient_privilege then raise notice 'ok: service_role is refused an update';
end $$;
insert into blindpanel.submissions (study, instrument, session, item_order, answers, delivery)
  values ('check', 'x', gen_random_uuid(), '{}', '{"clips": {}}', '{}');
select pg_temp.ok((blindpanel.tally('check', 1) ->> 'n_sessions')::int = 1, 'service_role can insert, and tally() sees the row (rolled back)');
reset role;

rollback;
\echo 'blindpanel live check passed (all changes rolled back)'
