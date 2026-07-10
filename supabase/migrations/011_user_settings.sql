-- Per-user interface language preference, used by the i18n system
-- (independent of business_profiles, so it exists from first login —
-- before the user has necessarily filled in their business profile).
--
-- Run this whole file once in the Supabase SQL Editor, after 010_add_owner_name.sql.

create table if not exists user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'uz'
                       check (preferred_language in ('uz', 'ru', 'en', 'kk', 'tr', 'az')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

alter table user_settings enable row level security;

create policy "user_settings_select_own" on user_settings for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
