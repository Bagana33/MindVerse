-- Migration: Add spinner_options table for shared spinner
-- Date: 2025-12-08

-- Create spinner_options table
CREATE TABLE IF NOT EXISTS spinner_options (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  option_text TEXT NOT NULL UNIQUE,
  added_by TEXT REFERENCES users(email) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If table already exists with NOT NULL constraint, alter it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spinner_options' 
    AND column_name = 'added_by' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE spinner_options 
    ALTER COLUMN added_by DROP NOT NULL;
    
    ALTER TABLE spinner_options 
    DROP CONSTRAINT IF EXISTS spinner_options_added_by_fkey;
    
    ALTER TABLE spinner_options 
    ADD CONSTRAINT spinner_options_added_by_fkey 
    FOREIGN KEY (added_by) REFERENCES users(email) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spinner_options_created ON spinner_options(created_at ASC);

-- RLS policies
ALTER TABLE spinner_options ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Public read access" ON spinner_options;
CREATE POLICY "Public read access" ON spinner_options FOR SELECT USING (true);

-- Public write access (anyone can add/delete)
DROP POLICY IF EXISTS "Public write access" ON spinner_options;
CREATE POLICY "Public write access" ON spinner_options FOR ALL USING (true);

-- Insert default options if table is empty (added_by can be NULL for system defaults)
INSERT INTO spinner_options (option_text, added_by)
SELECT * FROM (VALUES
  ('Сонголт 1', NULL),
  ('Сонголт 2', NULL),
  ('Сонголт 3', NULL)
) AS v(option_text, added_by)
WHERE NOT EXISTS (SELECT 1 FROM spinner_options);

