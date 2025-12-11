-- Migration: Add game state tracking (ended status and winner)
-- Date: 2025-12-10

begin;

-- Add columns to track if game has ended and who won
alter table game_images 
  add column if not exists game_ended boolean default false,
  add column if not exists winner_email text references users(email) on delete set null;

-- Create a simple game state table (alternative approach - we'll use columns on game_images)
-- Actually, let's use a separate table for game state to track when it ended
create table if not exists game_state (
  id text primary key default 'game-state',
  ended boolean default false,
  winner_email text references users(email) on delete set null,
  ended_at timestamptz,
  ended_by text references users(email) on delete set null
);

-- Insert initial state if not exists
insert into game_state (id, ended, ended_at, ended_by)
values ('game-state', false, null, null)
on conflict (id) do nothing;

-- RLS for game_state
alter table game_state enable row level security;

drop policy if exists "Public read access" on game_state;
create policy "Public read access" on game_state for select using (true);

drop policy if exists "Public write access" on game_state;
create policy "Public write access" on game_state for all using (true);

commit;

