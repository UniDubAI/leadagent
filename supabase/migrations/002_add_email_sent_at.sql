-- Track when an email was last sent to a lead
alter table leads
  add column if not exists email_sent_at timestamptz;
