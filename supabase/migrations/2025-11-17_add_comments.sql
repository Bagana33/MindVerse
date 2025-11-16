-- Add comments table for AI and user feedback on posts

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_email);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- RLS policies
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON comments FOR SELECT USING (true);
CREATE POLICY "Public write access" ON comments FOR ALL USING (true);
