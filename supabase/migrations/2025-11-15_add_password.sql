-- Migration: Add password column to users (nullable for smooth migration)
-- Run this in Supabase SQL Editor

begin;

-- 1) Add password column if it doesn't exist yet
alter table users add column if not exists password text;

-- 2) (Optional) If you previously enforced NOT NULL somewhere, relax it
-- alter table users alter column password drop not null;

-- 3) (No backfill needed) Existing users can keep NULL password.
--    Our app will allow upgrading such users by setting a new password on signup.

commit;