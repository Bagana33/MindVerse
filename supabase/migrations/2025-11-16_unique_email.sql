-- Migration: Ensure email is UNIQUE in users table
-- Run this in Supabase SQL Editor to prevent duplicate accounts

begin;

-- Add UNIQUE constraint to email column if not already present
-- This prevents duplicate emails across accounts
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'users_email_key'
  ) then
    alter table users add constraint users_email_key unique (email);
  end if;
end $$;

commit;
