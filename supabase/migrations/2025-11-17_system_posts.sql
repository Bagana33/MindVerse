-- System user for automated news posts
-- This ensures posts table can store automated content

-- No schema changes needed, just documenting the usage:
-- System posts will use authorId = 'news-bot'
-- Regular posts use actual user IDs from the users table

-- Optional: Create a view to separate system and user posts
CREATE OR REPLACE VIEW user_posts AS
SELECT * FROM posts
WHERE authorId != 'news-bot';

CREATE OR REPLACE VIEW system_posts AS
SELECT * FROM posts
WHERE authorId = 'news-bot';
