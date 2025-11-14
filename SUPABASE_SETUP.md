# NeonCanvas - Supabase Setup Guide

## ✅ Суурилуулсан зүйлс:

1. **@supabase/supabase-js** - Supabase client library
2. **@supabase/ssr** - Server-side rendering support
3. **supabase-schema.sql** - Database schema файл
4. **.env.local** - Environment variables template

---

## 🚀 Supabase Project үүсгэх (5 минут):

### 1. Supabase Account үүсгэх
1. [https://supabase.com](https://supabase.com) руу орно
2. "Start your project" дарж GitHub-аар нэвтрэнэ
3. Free tier хангалттай (500MB DB, 1GB storage)

### 2. Project үүсгэх
1. Dashboard дээр "New Project" дарна
2. Мэдээлэл оруулна:
   - **Name**: `neoncanvas` (эсвэл өөр нэр)
   - **Database Password**: Хүчтэй нууц үг үүсгэ (хадгална!)
   - **Region**: `Northeast Asia (Tokyo)` эсвэл ойрын бүс
3. "Create new project" дарна (1-2 минут хүлээнэ)

### 3. Database Schema үүсгэх
1. Supabase Dashboard → **SQL Editor** руу орно
2. "New query" дарна
3. `supabase-schema.sql` файлын бүх контентыг хуулж буулгана
4. "RUN" дарна (бүх tables, indexes, RLS policies үүснэ)

### 4. API Keys авах
1. Dashboard → **Settings** → **API** руу орно
2. Дараах утгуудыг хуулж авна:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (урт token)

### 5. Environment Variables тохируулах
1. `.env.local` файлыг засна:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 🔥 Серверийг ажиллуулах:

```bash
# Dependencies суулгасан эсэхийг шалгана
npm install

# Development server эхлүүлнэ
npm run dev
```

Server [http://localhost:3000](http://localhost:3000) дээр ажиллана.

---

## ✨ Юу өөрчлөгдсөн вэ?

### Өмнө (File-based):
- ❌ `/data/*.json` файлууд ашигладаг байсан
- ❌ Server restart хийхэд data устдаг байсан
- ❌ Олон хэрэглэгч зэрэг ашиглахад concurrency асуудалтай

### Одоо (Supabase):
- ✅ PostgreSQL database ашигладаг
- ✅ Server restart хийхэд data хадгалагдана
- ✅ Real production-ready
- ✅ Scalable (олон хэрэглэгч зэрэг ажиллана)
- ✅ Free tier-д 500MB хангалттай

---

## 📊 Database Tables:

1. **users** - Хэрэглэгчдийн мэдээлэл (email, name, role, XP)
2. **posts** - Постууд (author, text, image)
3. **reactions** - Постын reactions (like, love, fire)
4. **notifications** - Мэдэгдлүүд

---

## 🔒 Security:

- Row Level Security (RLS) идэвхжүүлсэн
- Public read/write access (cookie-based auth ашигладаг учир)
- Production-д илүү нарийвчилсан RLS policy хэрэгтэй болно

---

## 🐛 Troubleshooting:

### Error: "Could not connect to Supabase"
- `.env.local` дахь URL болон key-г шалгана
- Project-г бүрэн үүссэн эсэхийг нягтална
- Server restart хийнэ: `pkill -f "next dev" && npm run dev`

### Error: "relation does not exist"
- SQL schema ажиллуулсан эсэхийг шалгана
- Supabase SQL Editor дээр алдаа гарсан эсэхийг шалгана

### Deployment (Vercel)-д алдаа
- Vercel Dashboard → Settings → Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` болон `NEXT_PUBLIC_SUPABASE_ANON_KEY` нэмнэ
- Redeploy хийнэ

---

## 📚 Дараах алхам:

1. ✅ Supabase project үүсгэсэн
2. ✅ Database schema ажиллуулсан
3. ✅ Environment variables тохируулсан
4. ✅ `npm run dev` ажиллуулсан
5. 🚀 **Vercel дээр deploy хийх бэлэн!**

```bash
# Vercel deployment
vercel --prod
```

Амжилт! 🎉
