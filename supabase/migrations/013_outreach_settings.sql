-- Outreach sozlamalari: ohang, follow-up muddati/soni, imzo.
-- user_settings jadvaliga qo'shiladi (u allaqachon per-user, RLS bilan).
--
-- Run this whole file once in the Supabase SQL Editor, after 012_add_instagram_oauth.sql.

alter table user_settings
  add column if not exists outreach_tone text not null default 'neutral'
    check (outreach_tone in ('formal', 'neutral', 'friendly')),
  add column if not exists followup_delay_days int not null default 3
    check (followup_delay_days > 0),
  add column if not exists followup_max_count int not null default 1
    check (followup_max_count >= 0),
  add column if not exists signature text;

-- Follow-up cron endi har bir lid nechta marta follow-up olganini hisoblashi
-- kerak (followup_max_count bilan solishtirish uchun).
alter table leads
  add column if not exists followup_count int not null default 0;
