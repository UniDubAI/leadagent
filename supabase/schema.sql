-- LeadAgent Database Schema

-- Leads table
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
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
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Outreach messages table
create table if not exists outreach_messages (
  id         uuid primary key default gen_random_uuid(),
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
create index if not exists outreach_lead_id_idx on outreach_messages(lead_id);
