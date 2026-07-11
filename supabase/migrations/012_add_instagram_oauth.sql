-- Adds OAuth token storage to connected_accounts so Instagram can be
-- connected for real (via Instagram API with Instagram Login) instead of
-- the previous manual-entry form. Telegram rows leave these columns null.
--
-- Run this whole file once in the Supabase SQL Editor, after 011_user_settings.sql.

alter table connected_accounts add column if not exists access_token text;
alter table connected_accounts add column if not exists token_expires_at timestamptz;
