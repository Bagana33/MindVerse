-- Update reaction types to match the application
-- Run this in Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_type_check;

-- Add new constraint with updated reaction types
ALTER TABLE reactions ADD CONSTRAINT reactions_type_check 
  CHECK (type IN ('fire', 'wow', 'love', 'cool', 'star'));
