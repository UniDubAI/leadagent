-- Multi-tenant: scope leads / outreach_messages / biz_pages to the owning
-- user via a user_id column + Row Level Security.
--
-- Run this whole file once in the Supabase SQL Editor. It is safe to run on
-- a database that already has data in it -- existing rows are backfilled to
-- your account (jamgirovbahodir@gmail.com) before user_id is made required.

-- 1. Add user_id columns (nullable for now, so existing rows can be backfilled)
alter table leads
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table outreach_messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table biz_pages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill existing rows to your account
update leads
  set user_id = (select id from auth.users where email = 'jamgirovbahodir@gmail.com')
  where user_id is null;

update outreach_messages om
  set user_id = l.user_id
  from leads l
  where om.lead_id = l.id and om.user_id is null;

update biz_pages
  set user_id = (select id from auth.users where email = 'jamgirovbahodir@gmail.com')
  where user_id is null;

-- 3. Require user_id going forward
alter table leads alter column user_id set not null;
alter table outreach_messages alter column user_id set not null;
alter table biz_pages alter column user_id set not null;

-- 4. Indexes
create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists outreach_messages_user_id_idx on outreach_messages(user_id);
create index if not exists biz_pages_user_id_idx on biz_pages(user_id);

-- 5. Row Level Security
alter table leads enable row level security;
alter table outreach_messages enable row level security;
alter table biz_pages enable row level security;

-- leads: fully private to the owning user
create policy "leads_select_own" on leads
  for select using (auth.uid() = user_id);
create policy "leads_insert_own" on leads
  for insert with check (auth.uid() = user_id);
create policy "leads_update_own" on leads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leads_delete_own" on leads
  for delete using (auth.uid() = user_id);

-- outreach_messages: fully private to the owning user
create policy "outreach_messages_select_own" on outreach_messages
  for select using (auth.uid() = user_id);
create policy "outreach_messages_insert_own" on outreach_messages
  for insert with check (auth.uid() = user_id);
create policy "outreach_messages_update_own" on outreach_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outreach_messages_delete_own" on outreach_messages
  for delete using (auth.uid() = user_id);

-- biz_pages: management (insert/update/delete) is private to the owner, but
-- SELECT stays public -- these are Linktree-style public pages, /b/[slug] is
-- meant to be viewed by anyone regardless of who owns it.
create policy "biz_pages_select_public" on biz_pages
  for select using (true);
create policy "biz_pages_insert_own" on biz_pages
  for insert with check (auth.uid() = user_id);
create policy "biz_pages_update_own" on biz_pages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "biz_pages_delete_own" on biz_pages
  for delete using (auth.uid() = user_id);
