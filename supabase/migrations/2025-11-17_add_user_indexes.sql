-- Performance indexes for users table
-- Created: 2025-11-17

begin;

-- Leaderboard sorts by experience for students
create index if not exists idx_users_role_exp on users(role, experience desc);

-- Grade filtering on leaderboard
create index if not exists idx_users_grade on users(grade);

commit;
