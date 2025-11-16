# AI Comments System Setup

## 1. Supabase Database Setup

Comments table үүсгэх хэрэгтэй. Дараах SQL-ийг Supabase SQL Editor дээр ажиллуулна уу:

```sql
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
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_email);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- RLS policies
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON comments;
DROP POLICY IF EXISTS "Public write access" ON comments;

CREATE POLICY "Public read access" ON comments FOR SELECT USING (true);
CREATE POLICY "Public write access" ON comments FOR ALL USING (true);
```

## 2. Create AI User

AI comment-үүдийг бичих системийн хэрэглэгч үүсгэнэ:

```bash
node scripts/create-ai-user.js
```

## 3. How It Works

### Сурагч пост оруулах үед:

1. **Пост үүсгэгдэнэ** - Title, description, зураг
2. **AI анализ ажиллана** - GPT-4 бүтээлийг үнэлнэ
3. **Comment үүсгэгдэнэ** - AI шүүмжлэл автоматаар бичигдэнэ
4. **Notification ирнэ** - "🤖 AI шүүмжлэл таны бүтээлд бэлэн боллоо!"

### AI шүүмжлэлийн бүтэц:

```
✅ Сайн талууд (1-2 өгүүлбэр)
💡 Сайжруулах санал (2-3 практик зөвлөмж)
🎯 Дараагийн алхам (юу дээр анхаарах)
```

## 4. Visual Design

- 🤖 AI avatar (cyan-blue gradient)
- "✨ Автомат" badge
- Цэнхэр хайрцаг (cyan border)
- Post-ын доор харагдана

## 5. Test

1. Сурагчийн эрхээр нэвтрэх
2. Шинэ пост үүсгэх (PUBLIC visibility)
3. Publish дарах
4. Хэдэн секундын дараа AI comment feed дээр харагдана

## 6. Deployment

Vercel дээр автоматаар deploy хийгдэх үед бүх зүйл ажиллана. OpenAI API key шаардлагатай:

```
OPENAI_API_KEY=sk-proj-...
```

## Troubleshooting

### Comments харагдахгүй байвал:

1. Supabase SQL Editor дээр table үүссэн эсэхийг шалгах:
   ```sql
   SELECT * FROM comments;
   ```

2. AI user үүссэн эсэхийг шалгах:
   ```sql
   SELECT * FROM users WHERE email = 'ai-assistant';
   ```

3. Browser console-д алдаа байгаа эсэхийг шалгах

4. Server logs шалгах (Vercel Logs эсвэл terminal output)
