# 🔧 Database Migration Guide

## Issue: Posts not showing on profile pages

Some users' profiles are not displaying their posts correctly. This is because the `posts` table only has a `text` column, but the app expects `title` and `description` columns.

## Solution: Add title and description columns

### Step 1: Apply the migration

Run this SQL in your **Supabase SQL Editor**:

```sql
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
```

### Step 2: Verify the migration

After running the SQL, check if the migration was successful:

```sql
-- Check if columns exist
select column_name, data_type, is_nullable 
from information_schema.columns 
where table_name = 'posts' 
  and column_name in ('title', 'description', 'text');
```

You should see:
- `title` - text - NO
- `description` - text - NO  
- `text` - text - NO

### Step 3: Deploy the code changes

The following files have been updated to use the new columns:

1. **lib/posts.ts** - Updated `dbToPost()` and `createPost()` to use `title` and `description`
2. **components/profile/ProfileView.tsx** - Added better error handling for posts

### Step 4: Test

1. Create a new post
2. Visit your profile page
3. Visit another user's profile page (by clicking their name)
4. Verify that posts are showing correctly

## Alternative: Run the migration script

You can also use the provided script:

```bash
./scripts/apply-posts-migration.sh
```

This will display the SQL commands you need to run in Supabase.

## Rollback (if needed)

If you need to rollback this migration:

```sql
begin;

-- Remove the new columns
alter table if exists posts drop column if exists title;
alter table if exists posts drop column if exists description;

commit;
```

Note: After rollback, you'll need to revert the code changes in `lib/posts.ts`.

---

## What was changed?

### Database Schema
- Added `title` column to `posts` table (NOT NULL)
- Added `description` column to `posts` table (NOT NULL)
- Backfilled existing posts with their `text` content
- Kept `text` column for backward compatibility

### Code Changes
- `lib/posts.ts`:
  - `dbToPost()` now uses `title` and `description` with fallback to `text`
  - `createPost()` now inserts into `title`, `description`, and `text`
- `components/profile/ProfileView.tsx`:
  - Added better array validation when fetching posts
  - Added error logging for failed post fetches

## Why this fix works

Previously, the app was trying to display `title` and `description` from the database, but the `posts` table only had a `text` column. This caused posts to not render correctly on profile pages.

Now:
1. ✅ New posts have proper `title` and `description`
2. ✅ Old posts are backfilled with their `text` content
3. ✅ Backward compatibility is maintained via the `text` column
4. ✅ Profile pages can properly filter and display posts

---

**Created:** November 20, 2025  
**Migration File:** `supabase/migrations/2025-11-20_add_post_columns.sql`
