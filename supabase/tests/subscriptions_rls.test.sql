-- test: public.subscriptions owner-only isolation (rls) and data constraints
-- purpose: prove the privacy nfr — account b cannot read, change, delete or plant
--          subscriptions of account a; anon has no access — and pin the constraints s-01 relies on.
-- notes: users are simulated with a role plus jwt claims; foreign-row reads/updates/deletes
--        do not raise, they touch 0 rows, so those assertions count rows via returning.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- privileges, checked as superuser: authenticated gets exactly the four rls-covered
-- operations, anon nothing — a future grant or a returning truncate fails here.
select table_privs_are(
  'public', 'subscriptions', 'anon', array[]::text[],
  'anon has no privileges on subscriptions'
);

select table_privs_are(
  'public', 'subscriptions', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated has only select, insert, update, delete on subscriptions'
);

-- fixtures: two accounts, inserted as superuser before switching roles.
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@example.test');

-- ---------------------------------------------------------------- account a
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

insert into public.subscriptions (id, name, price, currency, billing_cycle, next_renewal_date)
values ('11111111-1111-1111-1111-111111111111', 'Netflix', 49.00, 'PLN', 'monthly', '2026-11-01');

select is(
  (select user_id from public.subscriptions where id = '11111111-1111-1111-1111-111111111111'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'insert without user_id defaults to auth.uid()'
);

select is(
  (select count(*)::int from public.subscriptions where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'owner sees own subscription'
);

-- ---------------------------------------------------------------- account b
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';

select is(
  (select count(*)::int from public.subscriptions where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'other account sees none of the owner''s subscriptions'
);

with touched as (
  update public.subscriptions set name = 'hijacked'
  where id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is(count(*)::int, 0, 'other account update of owner''s row touches 0 rows') from touched;

with touched as (
  delete from public.subscriptions
  where id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is(count(*)::int, 0, 'other account delete of owner''s row touches 0 rows') from touched;

select throws_ok(
  $$insert into public.subscriptions (user_id, name, price, currency, billing_cycle, next_renewal_date)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Planted', 10.00, 'PLN', 'monthly', '2026-11-01')$$,
  '42501',
  null,
  'other account cannot insert a row owned by the owner'
);

-- ---------------------------------------------------------------- account a again
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select name from public.subscriptions where id = '11111111-1111-1111-1111-111111111111'),
  'Netflix',
  'other account update did not change the owner''s data'
);

select is(
  (select count(*)::int from public.subscriptions where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'owner''s row still exists after other account delete'
);

select throws_ok(
  $$update public.subscriptions set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'owner cannot reassign user_id to another account'
);

with touched as (
  update public.subscriptions set price = 59.00
  where id = '11111111-1111-1111-1111-111111111111'
  returning price
)
select is(
  (select array_agg(price) from touched),
  array[59.00]::numeric[],
  'owner can update own subscription'
);

with touched as (
  delete from public.subscriptions
  where id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is(count(*)::int, 1, 'owner can delete own subscription') from touched;

-- constraints, checked as the owner so only the constraint can reject the row.
select throws_ok(
  $$insert into public.subscriptions (name, price, currency, billing_cycle, next_renewal_date)
    values ('Zero', 0, 'PLN', 'monthly', '2026-11-01')$$,
  '23514',
  null,
  'price = 0 is rejected'
);

select throws_ok(
  $$insert into public.subscriptions (name, price, currency, billing_cycle, next_renewal_date)
    values ('Lowercase', 10.00, 'pln', 'monthly', '2026-11-01')$$,
  '23514',
  null,
  'lowercase currency is rejected'
);

select throws_ok(
  $$insert into public.subscriptions (name, price, currency, billing_cycle, next_renewal_date)
    values ('', 10.00, 'PLN', 'monthly', '2026-11-01')$$,
  '23514',
  null,
  'empty name is rejected'
);

select throws_ok(
  $$insert into public.subscriptions (name, price, currency, billing_cycle, next_renewal_date)
    values ('   ', 10.00, 'PLN', 'monthly', '2026-11-01')$$,
  '23514',
  null,
  'whitespace-only name is rejected'
);

select throws_ok(
  $$insert into public.subscriptions (name, price, currency, billing_cycle, next_renewal_date)
    values ('Weekly', 10.00, 'PLN', 'weekly', '2026-11-01')$$,
  '22P02',
  null,
  'unknown billing_cycle is rejected'
);

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  'select * from public.subscriptions',
  '42501',
  null,
  'anon has no access to subscriptions'
);

select * from finish();
rollback;
