-- Track last contact and follow-up reminder timing
alter table leads
  add column if not exists last_contact_at timestamptz,
  add column if not exists followup_sent_at timestamptz;
