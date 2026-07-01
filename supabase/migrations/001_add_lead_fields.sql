-- Add industry, message_language, phone fields to leads table
alter table leads
  add column if not exists industry text,
  add column if not exists message_language text,
  add column if not exists phone text;
