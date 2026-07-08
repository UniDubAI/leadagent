-- SMM module multi-tenant support: each user fills in a business profile
-- once, and every generated SMM post/plan is saved under that user.
--
-- Run this whole file once in the Supabase SQL Editor, after 005_multi_tenant.sql.

-- 1. Business profile -- one row per user, describes their business so
--    Claude can personalize SMM content without asking every time.
create table if not exists business_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  industry      text not null,
  description   text,
  city          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger business_profiles_updated_at
  before update on business_profiles
  for each row execute function update_updated_at();

-- 2. Saved SMM generations -- every post / weekly plan / launch plan the
--    user generates gets stored so they can look back at it later.
create table if not exists smm_posts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  business_profile_id uuid references business_profiles(id) on delete set null,
  platform            text not null check (platform in ('instagram', 'telegram', 'both')),
  content_type        text not null check (content_type in ('single', 'weekly', 'launch')),
  language            text not null,
  consider_trends     boolean not null default false,
  posts               jsonb not null,
  created_at          timestamptz not null default now()
);

create index if not exists smm_posts_user_id_idx on smm_posts(user_id);
create index if not exists smm_posts_created_at_idx on smm_posts(created_at desc);

-- 3. Row Level Security -- every user only sees/manages their own profile
--    and their own generated posts.
alter table business_profiles enable row level security;
alter table smm_posts enable row level security;

create policy "business_profiles_select_own" on business_profiles
  for select using (auth.uid() = user_id);
create policy "business_profiles_insert_own" on business_profiles
  for insert with check (auth.uid() = user_id);
create policy "business_profiles_update_own" on business_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "smm_posts_select_own" on smm_posts
  for select using (auth.uid() = user_id);
create policy "smm_posts_insert_own" on smm_posts
  for insert with check (auth.uid() = user_id);
