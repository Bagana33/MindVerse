-- Migration: Add lessons, lesson_files, lesson_submissions tables
-- Run this in Supabase SQL Editor after the main schema

begin;

-- ================================================
-- LESSONS TABLE
-- ================================================
create table if not exists lessons (
  id text primary key,
  title text not null,
  description text not null,
  author_email text not null references users(email) on delete cascade,
  author_name text not null,
  published boolean not null default true, -- Багш үүсгэхэд автоматаар нийтлэгдсэн
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_lessons_author on lessons(author_email);
create index if not exists idx_lessons_published on lessons(published);
create index if not exists idx_lessons_created on lessons(created_at desc);

-- ================================================
-- LESSON_QUESTIONS TABLE (normalized from questions array)
-- ================================================
create table if not exists lesson_questions (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of strings
  correct_answer integer not null,
  explanation text,
  order_index integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_lesson_questions_lesson on lesson_questions(lesson_id, order_index);

-- ================================================
-- LESSON_FILES TABLE
-- ================================================
create table if not exists lesson_files (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_url text not null, -- base64 or URL
  file_size integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_lesson_files_lesson on lesson_files(lesson_id);

-- ================================================
-- LESSON_SUBMISSIONS TABLE
-- ================================================
create table if not exists lesson_submissions (
  id text primary key,
  lesson_id text not null references lessons(id) on delete cascade,
  student_email text not null references users(email) on delete cascade,
  student_name text not null,
  file_url text, -- Student uploaded file
  submitted_at timestamptz default now(),
  score integer, -- 0-100
  feedback text,
  reward_xp integer,
  graded_at timestamptz,
  unique(lesson_id, student_email) -- One submission per student per lesson
);

create index if not exists idx_lesson_submissions_lesson on lesson_submissions(lesson_id);
create index if not exists idx_lesson_submissions_student on lesson_submissions(student_email);
create index if not exists idx_lesson_submissions_submitted on lesson_submissions(submitted_at desc);

-- ================================================
-- UPDATED_AT TRIGGER for lessons
-- ================================================
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_lessons_updated_at'
  ) then
    create trigger update_lessons_updated_at
    before update on lessons
    for each row execute function update_updated_at_column();
  end if;
end $$;

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================
alter table if exists lessons enable row level security;
alter table if exists lesson_questions enable row level security;
alter table if exists lesson_files enable row level security;
alter table if exists lesson_submissions enable row level security;

-- Public read/write policies (using custom auth via API routes)
do $$
begin
  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='lessons') then
    create policy "Public read access" on lessons for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='lessons') then
    create policy "Public write access" on lessons for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='lesson_questions') then
    create policy "Public read access" on lesson_questions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='lesson_questions') then
    create policy "Public write access" on lesson_questions for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='lesson_files') then
    create policy "Public read access" on lesson_files for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='lesson_files') then
    create policy "Public write access" on lesson_files for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='lesson_submissions') then
    create policy "Public read access" on lesson_submissions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='lesson_submissions') then
    create policy "Public write access" on lesson_submissions for all using (true) with check (true);
  end if;
end $$;

commit;
