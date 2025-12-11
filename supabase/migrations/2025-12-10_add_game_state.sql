-- Migration: Add game state tracking (ended status and winner)
-- Date: 2025-12-10

begin;

-- Add columns to track if game has ended and who won (if game_images table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'game_images') then
    alter table game_images 
      add column if not exists game_ended boolean default false,
      add column if not exists winner_email text references users(email) on delete set null;
  end if;
end $$;

-- Create game_state table if it doesn't exist
create table if not exists game_state (
  id text primary key default 'game-state',
  ended boolean default false,
  winner_email text references users(email) on delete set null,
  ended_at timestamptz,
  ended_by text references users(email) on delete set null
);

-- Add new columns if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'game_state' and column_name = 'lesson_id') then
    alter table game_state add column lesson_id text references lessons(id) on delete set null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'game_state' and column_name = 'target_grade') then
    alter table game_state add column target_grade text;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'game_state' and column_name = 'winner_submission_id') then
    alter table game_state add column winner_submission_id text references lesson_submissions(id) on delete set null;
  end if;
end $$;

-- Insert initial state if not exists
insert into game_state (id, lesson_id, target_grade, ended, ended_at, ended_by)
values ('game-state', null, null, false, null, null)
on conflict (id) do nothing;

-- RLS for game_state
alter table game_state enable row level security;

drop policy if exists "Public read access" on game_state;
create policy "Public read access" on game_state for select using (true);

drop policy if exists "Public write access" on game_state;
create policy "Public write access" on game_state for all using (true);

commit;

