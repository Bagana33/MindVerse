-- Migration: Add game_images table for voting game
-- Date: 2025-12-10

begin;

create table if not exists game_images (
  id text primary key,
  image_url text not null,
  added_by text references users(email) on delete set null,
  liked_by text[] default '{}',
  disliked_by text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_game_images_created on game_images(created_at desc);

-- RLS
alter table game_images enable row level security;

drop policy if exists "Public read access" on game_images;
create policy "Public read access" on game_images for select using (true);

drop policy if exists "Public write access" on game_images;
create policy "Public write access" on game_images for all using (true);

commit;

