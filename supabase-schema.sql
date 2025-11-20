-- Supabase Database Schema for NeonCanvas
-- Run these SQL queries in your Supabase SQL Editor

-- ================================================
-- USERS TABLE
-- ================================================
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  name TEXT,
  password TEXT, -- Hashed password (nullable for migration)
  nickname TEXT,
  bio TEXT,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')) DEFAULT 'student',
  experience INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster role queries
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_experience ON users(experience DESC);

-- ================================================
-- POSTS TABLE
-- ================================================
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  text TEXT NOT NULL,
  image_data TEXT, -- Base64 or URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster author queries
CREATE INDEX idx_posts_author ON posts(author_email);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- ================================================
-- REACTIONS TABLE
-- ================================================
CREATE TABLE reactions (
  id SERIAL PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fire', 'wow', 'love', 'cool', 'star')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_email, type)
);

-- Indexes for faster reaction queries
CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_user ON reactions(user_email);

-- ================================================
-- NOTIFICATIONS TABLE
-- ================================================
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX idx_notifications_user ON notifications(user_email);
CREATE INDEX idx_notifications_read ON notifications(user_email, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read access (since we're using custom auth)
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Public read access" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reactions FOR SELECT USING (true);

-- Public write access (since we're using custom auth via API routes)
CREATE POLICY "Public write access" ON users FOR ALL USING (true);
CREATE POLICY "Public write access" ON posts FOR ALL USING (true);
CREATE POLICY "Public write access" ON reactions FOR ALL USING (true);
CREATE POLICY "Public write access" ON notifications FOR ALL USING (true);

-- ================================================
-- SAMPLE DATA (Optional - for testing)
-- ================================================
-- Insert demo users
INSERT INTO users (email, name, nickname, role, experience, avatar_color) VALUES
('demo@student.com', 'Demo Student', 'DemoKid', 'student', 150, '#8b5cf6'),
('teacher@demo.com', 'Demo Teacher', 'Mr. Demo', 'teacher', 0, '#3b82f6')
ON CONFLICT (email) DO NOTHING;
