# Auto-Refresh News System

Энэхүү систем 24 цаг тутамд автоматаар мэдээллийн постуудыг шинэчилдэг.

## Setup

### 1. OpenAI API Key авах
1. https://platform.openai.com/ рүү нэвтрэх
2. API Keys хэсэгт шинэ түлхүүр үүсгэх
3. `.env.local` файлд нэмэх:
```
OPENAI_API_KEY=sk-...your-key-here
```

### 2. Cron Secret үүсгэх
Random string үүсгээд `.env.local`-д нэмэх:
```
CRON_SECRET=your-random-secret-here
```

### 3. Vercel дээр Deploy хийх

Vercel дээр Environment Variables-д дараах утгуудыг нэмнэ:
- `OPENAI_API_KEY` - Таны OpenAI API key
- `CRON_SECRET` - Таны random secret
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Яаж ажилладаг

1. **Cron Job**: Өдөр бүр 00:00 цагт `/api/cron/refresh-news` дуудагдана
2. **Хуучин пост устгах**: 24 цагаас хуучин мэдээллийн постууд устна
3. **Шинэ пост үүсгэх**: ChatGPT API ашиглаж шинэ мэдээлэл үүсгэнэ
4. **Database-д хадгалах**: Шинэ постыг `authorId='news-bot'` гэсэн ID-тай хадгална

## Manual Test

Дараах URL-ийг ашиглаж manually test хийж болно:

```bash
# Local development
curl -X POST http://localhost:3000/api/posts/auto-refresh

# Production (Vercel дээр)
curl -X GET https://your-app.vercel.app/api/cron/refresh-news \
  -H "Authorization: Bearer your-cron-secret"
```

## Configuration

`vercel.json` файлд cron schedule өөрчилж болно:
- `0 0 * * *` - Өдөр бүр 00:00 (одоогийн)
- `0 */12 * * *` - 12 цаг тутамд
- `0 */6 * * *` - 6 цаг тутамд
- `0 * * * *` - Цаг бүр

## Database Views

Хоёр view үүсгэсэн:
- `user_posts` - Зөвхөн хэрэглэгчийн постууд
- `system_posts` - Зөвхөн системийн мэдээллийн постууд
