# 🎯 NeonCanvas - Production Deployment Guide

## Суурилсан Supabase Integration

Таны сайт одоо **production-ready** болсон! File-based storage-с Supabase PostgreSQL database руу шилжсэн.

---

## 📋 Хийгдсэн өөрчлөлтүүд:

### ✅ Backend Migration:
- `lib/users.ts` → Supabase users table
- `lib/posts.ts` → Supabase posts + reactions tables  
- `lib/notifications.ts` → Supabase notifications table
- Бүх API routes → async/await patterns

### ✅ Үүссэн файлууд:
- `supabase-schema.sql` - Database schema
- `.env.local` - Environment variables (git-д оруулахгүй)
- `.env.example` - Template for team members
- `SUPABASE_SETUP.md` - Дэлгэрэнгүй setup зааварчилгаа

---

## 🚀 Deployment хийх дараалал:

### 1. Supabase Project үүсгэх (5 минут)
```bash
# SUPABASE_SETUP.md файлыг унш!
cat SUPABASE_SETUP.md
```

Товчхондоо:
1. [supabase.com](https://supabase.com) - Project үүсгэ
2. SQL Editor → `supabase-schema.sql` ажиллуул
3. Settings → API → Keys хуул
4. `.env.local` засаж keys-г орууl

### 2. Local тест хийх
```bash
npm install
npm run dev
```

http://localhost:3000 - Хэрэв ажиллавал бүх зүйл OK!

### 3. Git Push
```bash
git add .
git commit -m "Add Supabase integration"
git push origin main
```

### 4. Vercel Deployment
```bash
# Option A: CLI ашиглах
npm i -g vercel
vercel --prod

# Option B: Dashboard ашиглах
# 1. vercel.com → Import Git Repository
# 2. Environment Variables нэм:
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
# 3. Deploy дар!
```

---

## 🎓 Хүүхдүүдэд ашиглуулахад:

### Deployment хийсний дараа:
1. **URL авах**: `https://your-app.vercel.app`
2. **Хүүхдүүдэд хуваалцах**: Login хэсэгт email оруулж ашиглана
3. **Teacher account**: Role сонгохдоо "Teacher" сонгоно
4. **Student accounts**: Default "Student" роль авна

### Автоматаар:
- ✅ Posts create/delete/edit
- ✅ Reactions (👍 ❤️ 🔥)
- ✅ XP points system
- ✅ Leaderboard (name/rank search)
- ✅ Notifications
- ✅ Profile pictures
- ✅ Lessons & Contests

---

## 💡 Key Points:

### Суурилсан:
- ✅ Supabase PostgreSQL database
- ✅ Real-time data persistence
- ✅ Free tier: 500MB DB, 1GB storage
- ✅ Automatic backups
- ✅ Scalable architecture

### Production checklist:
- [ ] Supabase project үүсгэсэн
- [ ] Schema ажиллуулсан  
- [ ] Environment variables тохируулсан
- [ ] Local тестэлсэн
- [ ] Vercel дээр deploy хийсэн
- [ ] URL хүүхдүүдэд өгсөн

---

## 🔥 Next Steps (Optional):

### Илүү сайжруулахад:
1. **Custom domain**: Vercel дээр domain холбох
2. **Email notifications**: Supabase Auth + email templates
3. **File upload**: Supabase Storage for images
4. **Real-time updates**: Supabase Realtime subscriptions
5. **Analytics**: Vercel Analytics нэмэх

### Supabase features:
- Auth: Email/password, OAuth (Google, GitHub)
- Storage: File/image upload with CDN
- Realtime: Live database subscriptions
- Edge Functions: Serverless functions

---

## 🆘 Support:

### Алдаа гарвал:
1. `SUPABASE_SETUP.md` → Troubleshooting хэсэг
2. Supabase Dashboard → Logs (алдаа шалгах)
3. Vercel → Deployment logs

### Хамгийн түгээмэл:
- **"Could not connect"** → .env variables шалгана
- **"Table doesn't exist"** → SQL schema дахин ажиллуулна
- **"403 Forbidden"** → RLS policies шалгана

---

## 🎉 Дуусгал:

Таны сайт одоо **бүрэн production-ready**!

```bash
# Эцсийн алхам:
npm run dev          # Local test
git push            # Code хадгална
vercel --prod       # Deploy хийнэ
```

**URL хүүхдүүдэд өгч, сурах явцад нь баяр хүргээрэй! 🚀**
