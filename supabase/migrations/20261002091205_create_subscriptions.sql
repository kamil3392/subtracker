-- migration: create public.subscriptions
-- purpose: owner-only subscription store; the database enforces field validity
--          and row ownership (rls with one policy per operation for authenticated).
-- notes: purely additive. next_renewal_date is the base date; rollover (fr-009)
--        is computed at read time, not stored.

create type public.billing_cycle as enum ('monthly', 'quarterly', 'yearly');
create type public.subscription_status as enum ('active', 'cancelled');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  currency text not null,
  billing_cycle public.billing_cycle not null,
  next_renewal_date date not null,
  status public.subscription_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint subscriptions_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint subscriptions_price_positive check (price > 0),
  constraint subscriptions_currency_iso4217 check (currency ~ '^[A-Z]{3}$')
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- anon gets no access at all; authenticated access is gated by the policies below.
revoke all on public.subscriptions from anon;

create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "subscriptions_insert_own"
  on public.subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- with check is required too: using alone would let an owner reassign user_id to another account.
create policy "subscriptions_update_own"
  on public.subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subscriptions_delete_own"
  on public.subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
