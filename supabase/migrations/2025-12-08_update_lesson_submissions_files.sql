-- Migration: Update lesson_submissions to support multiple files (up to 2)
-- Change file_url to file_urls (JSON array)

begin;

-- Add new column for file URLs array
alter table if exists lesson_submissions 
  add column if not exists file_urls jsonb;

-- Migrate existing file_url data to file_urls array
update lesson_submissions
set file_urls = case 
  when file_url is not null then jsonb_build_array(file_url)
  else null
end
where file_urls is null;

-- Drop the old file_url column (after migration)
-- Note: We'll keep file_url for backward compatibility temporarily
-- Uncomment below after verifying the migration works:
-- alter table if exists lesson_submissions drop column if exists file_url;

commit;

