-- "Tavsiyalar" module: AI-generated, per-user actionable recommendations
-- based on the user's own leads/SMM activity. One row per user (refreshed
-- in place each time they click "Tavsiyalarni yangilash").
--
-- Run this whole file once in the Supabase SQL Editor, after 006_smm_business_profile.sql.

create table if not exists recommendations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  items        jsonb not null,
  generated_at timestamptz not null default now()
);

alter table recommendations enable row level security;

create policy "recommendations_select_own" on recommendations
  for select using (auth.uid() = user_id);
create policy "recommendations_insert_own" on recommendations
  for insert with check (auth.uid() = user_id);
create policy "recommendations_update_own" on recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
