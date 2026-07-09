-- "Akkauntlar" module: connected social accounts (Telegram channel stats
-- pulled via Bot API, Instagram stats entered manually) plus a simple
-- manual finance snapshot. Both feed into the "Tavsiyalar" business audit.
--
-- Run this whole file once in the Supabase SQL Editor, after 007_recommendations.sql.

-- 1. Connected accounts -- one row per user per platform, refreshed in
--    place (upsert) whenever the user reconnects / re-enters numbers.
create table if not exists connected_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('telegram', 'instagram')),
  account_name text not null,
  data         jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, platform)
);

create trigger connected_accounts_updated_at
  before update on connected_accounts
  for each row execute function update_updated_at();

create index if not exists connected_accounts_user_id_idx on connected_accounts(user_id);

alter table connected_accounts enable row level security;

create policy "connected_accounts_select_own" on connected_accounts
  for select using (auth.uid() = user_id);
create policy "connected_accounts_insert_own" on connected_accounts
  for insert with check (auth.uid() = user_id);
create policy "connected_accounts_update_own" on connected_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connected_accounts_delete_own" on connected_accounts
  for delete using (auth.uid() = user_id);

-- 2. Business finances -- one simple manually-entered snapshot per user.
create table if not exists business_finances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  monthly_revenue numeric,
  monthly_expense numeric,
  avg_receipt     numeric,
  updated_at      timestamptz not null default now()
);

create trigger business_finances_updated_at
  before update on business_finances
  for each row execute function update_updated_at();

alter table business_finances enable row level security;

create policy "business_finances_select_own" on business_finances
  for select using (auth.uid() = user_id);
create policy "business_finances_insert_own" on business_finances
  for insert with check (auth.uid() = user_id);
create policy "business_finances_update_own" on business_finances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
