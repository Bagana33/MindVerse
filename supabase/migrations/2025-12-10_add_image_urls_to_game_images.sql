-- Migration: Add image_urls array column to game_images table
-- Date: 2025-12-10

begin;

-- Add image_urls column to store multiple images per submission
alter table game_images 
add column if not exists image_urls text[] default '{}';

-- Migrate existing data: if image_url exists but image_urls is empty, populate it
update game_images 
set image_urls = array[image_url]
where image_url is not null 
  and (image_urls is null or array_length(image_urls, 1) is null);

commit;

