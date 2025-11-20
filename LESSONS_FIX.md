# Lessons Page Fix - Бүх migration-уудыг суулгах

## Асуудал
Lessons хуудас ачаалахад "server хариу өгөөгүй" гэсэн алдаа гарч байна.

## Шийдэл
Supabase database дээр дутуу байгаа tables/columns-уудыг үүсгэх хэрэгтэй.

## Алхам 1: Supabase SQL Editor рүү орох

1. Очих: https://app.supabase.com/project/daazuexgbwlfmzinimzq/sql/new
2. Доорх SQL script-ийг хуулаад "Run" дарах

## Алхам 2: SQL Script ажиллуулах

```sql
-- ============================================
-- COMPLETE DATABASE SETUP FOR LESSONS
-- ============================================

BEGIN;

-- 1. Create lessons table if not exists
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  target_grades TEXT[], -- Target student grades
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create lesson_questions table
CREATE TABLE IF NOT EXISTS lesson_questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create lesson_files table
CREATE TABLE IF NOT EXISTS lesson_files (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create lesson_submissions table
CREATE TABLE IF NOT EXISTS lesson_submissions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  file_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  score INTEGER,
  feedback TEXT,
  reward_xp INTEGER,
  graded_at TIMESTAMPTZ,
  UNIQUE(lesson_id, student_email)
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_lessons_author ON lessons(author_email);
CREATE INDEX IF NOT EXISTS idx_lessons_published ON lessons(published);
CREATE INDEX IF NOT EXISTS idx_lessons_created ON lessons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON lesson_questions(lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lesson_files_lesson ON lesson_files(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_submissions_lesson ON lesson_submissions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_submissions_student ON lesson_submissions(student_email);
CREATE INDEX IF NOT EXISTS idx_lesson_submissions_submitted ON lesson_submissions(submitted_at DESC);

-- 6. Add target_grades column if missing
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS target_grades TEXT[];

-- 7. Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 8. Add update trigger to lessons
DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Enable RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_submissions ENABLE ROW LEVEL SECURITY;

-- 10. Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON lessons;
DROP POLICY IF EXISTS "Public write access" ON lessons;
DROP POLICY IF EXISTS "Public read access" ON lesson_questions;
DROP POLICY IF EXISTS "Public write access" ON lesson_questions;
DROP POLICY IF EXISTS "Public read access" ON lesson_files;
DROP POLICY IF EXISTS "Public write access" ON lesson_files;
DROP POLICY IF EXISTS "Public read access" ON lesson_submissions;
DROP POLICY IF EXISTS "Public write access" ON lesson_submissions;

-- 11. Create new policies
CREATE POLICY "Public read access" ON lessons FOR SELECT USING (TRUE);
CREATE POLICY "Public write access" ON lessons FOR ALL USING (TRUE);

CREATE POLICY "Public read access" ON lesson_questions FOR SELECT USING (TRUE);
CREATE POLICY "Public write access" ON lesson_questions FOR ALL USING (TRUE);

CREATE POLICY "Public read access" ON lesson_files FOR SELECT USING (TRUE);
CREATE POLICY "Public write access" ON lesson_files FOR ALL USING (TRUE);

CREATE POLICY "Public read access" ON lesson_submissions FOR SELECT USING (TRUE);
CREATE POLICY "Public write access" ON lesson_submissions FOR ALL USING (TRUE);

COMMIT;
```

## Алхам 3: Reaction types засварлах

Мөн reactions table-ийн constraint-ийг шинэчлэх:

```sql
-- Drop the old constraint
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_type_check;

-- Add new constraint with updated reaction types
ALTER TABLE reactions ADD CONSTRAINT reactions_type_check 
  CHECK (type IN ('fire', 'wow', 'love', 'cool', 'star'));
```

## Алхам 4: Шалгах

1. Dev server дахин ачаална:
```bash
npm run dev
```

2. Lessons хуудас руу орох: http://localhost:3000/lessons

Хэрэв ажиллаж байвал ✅, үгүй бол терминалын алдааг харуулна уу.

## Анхааруулга

⚠️ **Суулгасан SQL script-үүдээ backup хийж авах**

Ирээдүйд production database-ийг зассан бол энэ script-ийг дахин ажиллуулах хэрэгтэй болно.
