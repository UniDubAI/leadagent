-- LeadAgent Database Schema

-- Leads table
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  company          text,
  email            text,
  linkedin_url     text,
  phone            text,
  status           text not null default 'new'
                     check (status in ('new', 'contacted', 'replied', 'qualified', 'closed_won', 'closed_lost')),
  industry         text,
  message_language text,
  source           text,
  notes            text,
  email_sent_at    timestamptz,
  last_contact_at  timestamptz,
  followup_sent_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Outreach messages table
create table if not exists outreach_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  lead_id    uuid not null references leads(id) on delete cascade,
  channel    text not null check (channel in ('email', 'linkedin')),
  subject    text,            -- email only
  body       text not null,
  status     text not null default 'draft'
               check (status in ('draft', 'sent')),
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on leads
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- Indexes
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_at_idx on leads(created_at desc);
create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists outreach_lead_id_idx on outreach_messages(lead_id);
create index if not exists outreach_messages_user_id_idx on outreach_messages(user_id);

-- Business mini-pages table (Linktree-style public pages sold to clients)
create table if not exists biz_pages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,
  business_name text not null,
  tagline       text,
  phone         text,
  address       text,
  instagram     text,
  telegram      text,
  facebook      text,
  website       text,
  menu_url      text,
  working_hours text,
  reviews       jsonb not null default '[]'::jsonb,
  theme         text not null default 'brown',
  lead_id       uuid references leads(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists biz_pages_slug_idx on biz_pages(slug);
create index if not exists biz_pages_user_id_idx on biz_pages(user_id);

-- Business profile table (one per user -- powers SMM content personalization)
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

-- Saved SMM generations (posts / weekly plans / launch plans)
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

-- AI-generated recommendations (one row per user, refreshed in place)
create table if not exists recommendations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  items        jsonb not null,
  generated_at timestamptz not null default now()
);

-- Row Level Security -- every user only sees/manages their own rows. Public
-- mini-pages (/b/[slug]) are readable by anyone by design.
alter table leads enable row level security;
alter table outreach_messages enable row level security;
alter table biz_pages enable row level security;
alter table business_profiles enable row level security;
alter table smm_posts enable row level security;
alter table recommendations enable row level security;

create policy "leads_select_own" on leads for select using (auth.uid() = user_id);
create policy "leads_insert_own" on leads for insert with check (auth.uid() = user_id);
create policy "leads_update_own" on leads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leads_delete_own" on leads for delete using (auth.uid() = user_id);

create policy "outreach_messages_select_own" on outreach_messages for select using (auth.uid() = user_id);
create policy "outreach_messages_insert_own" on outreach_messages for insert with check (auth.uid() = user_id);
create policy "outreach_messages_update_own" on outreach_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "outreach_messages_delete_own" on outreach_messages for delete using (auth.uid() = user_id);

create policy "biz_pages_select_public" on biz_pages for select using (true);
create policy "biz_pages_insert_own" on biz_pages for insert with check (auth.uid() = user_id);
create policy "biz_pages_update_own" on biz_pages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "biz_pages_delete_own" on biz_pages for delete using (auth.uid() = user_id);

create policy "business_profiles_select_own" on business_profiles for select using (auth.uid() = user_id);
create policy "business_profiles_insert_own" on business_profiles for insert with check (auth.uid() = user_id);
create policy "business_profiles_update_own" on business_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "smm_posts_select_own" on smm_posts for select using (auth.uid() = user_id);
create policy "smm_posts_insert_own" on smm_posts for insert with check (auth.uid() = user_id);

create policy "recommendations_select_own" on recommendations for select using (auth.uid() = user_id);
create policy "recommendations_insert_own" on recommendations for insert with check (auth.uid() = user_id);
create policy "recommendations_update_own" on recommendations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
