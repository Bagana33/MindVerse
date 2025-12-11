-- Migration: Link game to lesson submissions
-- Date: 2025-12-10

begin;

-- Add submission_id to game_images to link to lesson submissions
alter table game_images 
  add column if not exists submission_id text references lesson_submissions(id) on delete cascade;

-- Create index for faster lookups
create index if not exists idx_game_images_submission on game_images(submission_id);

commit;

