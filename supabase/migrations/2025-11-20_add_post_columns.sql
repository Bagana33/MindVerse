-- Migration: Add title and description columns to posts table
-- Date: 2025-11-20

begin;

-- Add title column (use text field as fallback for existing posts)
alter table if exists posts 
add column if not exists title text;

-- Add description column (use text field as fallback for existing posts)
alter table if exists posts 
add column if not exists description text;

-- Update existing posts: copy text to both title and description
update posts 
set title = text, description = text
where title is null or description is null;

-- Now make them not null (after backfill)
alter table if exists posts 
alter column title set not null;

alter table if exists posts 
alter column description set not null;

-- Add comment for documentation
comment on column posts.title is 'Post title (short headline)';
comment on column posts.description is 'Post description (full content)';

-- The 'text' column can now be deprecated but we'll keep it for backward compatibility
comment on column posts.text is 'DEPRECATED: Use title/description instead. Kept for backward compat.';

commit;
