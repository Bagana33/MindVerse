-- Migration: Add contests, contest_submissions, contest_votes tables
-- Date: 2026-03-05

begin;

-- ================================================
-- CONTESTS TABLE
-- ================================================
create table if not exists contests (
  id text primary key,
  title text not null,
  description text not null,
  author_email text not null references users(email) on delete cascade,
  author_name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  prize integer not null default 0,
  target_grades text[] default '{}',
  winner_awarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint contests_dates_check check (end_date >= start_date)
);

create index if not exists idx_contests_author on contests(author_email);
create index if not exists idx_contests_created on contests(created_at desc);
create index if not exists idx_contests_start_end on contests(start_date, end_date);

-- ================================================
-- CONTEST_SUBMISSIONS TABLE
-- ================================================
create table if not exists contest_submissions (
  id text primary key,
  contest_id text not null references contests(id) on delete cascade,
  student_email text not null references users(email) on delete cascade,
  student_name text not null,
  file_url text not null,
  description text,
  submitted_at timestamptz default now(),
  unique(contest_id, student_email)
);

create index if not exists idx_contest_submissions_contest on contest_submissions(contest_id);
create index if not exists idx_contest_submissions_student on contest_submissions(student_email);
create index if not exists idx_contest_submissions_submitted on contest_submissions(submitted_at desc);

-- ================================================
-- CONTEST_VOTES TABLE
-- ================================================
create table if not exists contest_votes (
  id bigserial primary key,
  contest_id text not null references contests(id) on delete cascade,
  submission_id text not null references contest_submissions(id) on delete cascade,
  voter_email text not null references users(email) on delete cascade,
  created_at timestamptz default now(),
  unique(submission_id, voter_email)
);

create index if not exists idx_contest_votes_contest on contest_votes(contest_id);
create index if not exists idx_contest_votes_submission on contest_votes(submission_id);
create index if not exists idx_contest_votes_voter on contest_votes(voter_email);

-- ================================================
-- UPDATED_AT TRIGGER for contests
-- ================================================
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'update_contests_updated_at'
  ) then
    create trigger update_contests_updated_at
    before update on contests
    for each row execute function update_updated_at_column();
  end if;
end $$;

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================
alter table if exists contests enable row level security;
alter table if exists contest_submissions enable row level security;
alter table if exists contest_votes enable row level security;

-- Public read/write policies (app uses cookie auth in API routes)
do $$
begin
  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='contests') then
    create policy "Public read access" on contests for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='contests') then
    create policy "Public write access" on contests for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='contest_submissions') then
    create policy "Public read access" on contest_submissions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='contest_submissions') then
    create policy "Public write access" on contest_submissions for all using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname='Public read access' and tablename='contest_votes') then
    create policy "Public read access" on contest_votes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='Public write access' and tablename='contest_votes') then
    create policy "Public write access" on contest_votes for all using (true) with check (true);
  end if;
end $$;

commit;
