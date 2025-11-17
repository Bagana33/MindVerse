-- Performance indexes for feed-related tables
-- Created: 2025-11-17

begin;

-- Posts ordered by newest
create index if not exists idx_posts_created_at_desc on posts(created_at desc);
create index if not exists idx_posts_author_created on posts(author_email, created_at desc);

-- Reactions lookup by post and by (post,user)
create index if not exists idx_reactions_post on reactions(post_id);
create index if not exists idx_reactions_post_user on reactions(post_id, user_email);

-- Comments by post ordered by time
create index if not exists idx_comments_post on comments(post_id);
create index if not exists idx_comments_post_created on comments(post_id, created_at);

commit;
