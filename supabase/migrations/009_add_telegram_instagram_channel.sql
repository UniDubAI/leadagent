-- Allow Telegram and Instagram DM as outreach channels alongside email/linkedin.
--
-- Run this whole file once in the Supabase SQL Editor, after 008_connected_accounts.sql.

alter table outreach_messages drop constraint outreach_messages_channel_check;
alter table outreach_messages add constraint outreach_messages_channel_check
  check (channel in ('email', 'linkedin', 'telegram', 'instagram'));
