-- Adds the business owner's personal name, used to build a "Ism, Kompaniya"
-- email signature instead of just the business name.
--
-- Run this whole file once in the Supabase SQL Editor, after 009_add_telegram_instagram_channel.sql.

alter table business_profiles add column if not exists owner_name text;
