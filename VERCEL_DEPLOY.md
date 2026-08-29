# 🚀 Vercel Deployment Guide - Алхам алхмаар

## Option 1: Vercel Dashboard (Хамгийн хялбар - 5 минут)

### Алхам 1: GitHub руу Push хийх

```bash
# GitHub дээр шинэ repository үүсгэ
# https://github.com/new
# Repository name: neoncanvas (эсвэл өөр нэр)

# Terminal дээр:
git remote add origin https://github.com/Bagana33/MindVerse.git
git branch -M main
git push -u origin main
```

### Алхам 2: Vercel дээр Deploy хийх

1. **Vercel.com руу орох**
   - [https://vercel.com](https://vercel.com) 
   - GitHub account-аараа нэвтэр

2. **Import Project**
   - "Add New..." → "Project" дар
   - GitHub repository сонго: `Bagana33/MindVerse`
   - "Import" дар

3. **Configure Project**
   - **Framework Preset**: Next.js (автоматаар илрүүлнэ)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. **Environment Variables нэмэх** ⚠️ **МАШ ЧУХАЛ! (AI болон зураг ажиллахад шаардлагатай)**
   
   Vercel Dashboard → **Settings** → **Environment Variables** хэсэгт `.env.local` файл доторх бүх утгуудыг нэм:
   
   ```
   # 1. Supabase (Database)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # 2. Google Gemini AI (AI Chatbot, Fake Client, AI Шүүмжлэл)
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-3.1-flash-lite
   
   # 3. OpenRouter / OpenAI (Нэмэлт AI туслах)
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_SITE_URL=https://your-domain.vercel.app
   OPENROUTER_APP_NAME=Mind Verse
   OPENAI_API_KEY=your_openai_api_key
   
   # 4. Cloudinary (Зураг оруулах)
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   
   # 5. Бусад тохиргоо
   CRON_SECRET=your_cron_secret
   NC_SESSION_SECRET=your_session_secret
   ```
   
   💡 **Тайлбар:** Өөрийн `.env.local` файл доторх бодит утгуудыг хуулж Vercel Environment Variables дээр оруулна уу.

5. **Deploy дарах**
   - "Deploy" товч дар
   - 2-3 минут хүлээ
   - ✅ Deployment амжилттай!

6. **URL авах**
   - `https://mind-verse-xxxx.vercel.app`
   - Энэ URL-г хүүхдүүдэд өгч болно!

---

## Option 2: Vercel CLI (Terminal)

```bash
# 1. Vercel CLI суулгах
sudo npm install -g vercel

# 2. Нэвтрэх
vercel login

# 3. Deploy хийх
vercel --prod

# Асуултууд гарвал:
# - "Set up and deploy?" → Yes
# - "Which scope?" → Таны account сонго
# - "Link to existing project?" → No
# - "What's your project's name?" → neoncanvas
# - "In which directory?" → ./
# - "Want to override settings?" → No

# 4. Environment variables нэмэх
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Enter value: https://your-project.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Enter value: your-anon-key

# 5. Redeploy with env vars
vercel --prod
```

---

## ✅ Deployment амжилттай бол:

### Шалгах зүйлс:
1. **URL нээгдэж байна уу**: `https://your-app.vercel.app`
2. **Login хийж болж байна уу**: Email оруулж тест хийнэ
3. **Database холбогдсон уу**: Post үүсгэж тест хийнэ
4. **Error байна уу**: Vercel Dashboard → Deployments → Logs шалгана

### Хэрвээ алдаа гарвал:

#### "Could not connect to Supabase"
- ✅ Environment variables зөв оруулсан эсэхийг шалгана
- ✅ Supabase project идэвхтэй эсэхийг нягтална
- ✅ Vercel Dashboard → Settings → Environment Variables → Redeploy

#### "Build failed"
- ✅ Local дээр `npm run build` ажилладаг эсэхийг шалгана
- ✅ Vercel logs-г унш: Function logs хэсэг
- ✅ TypeScript errors байна уу шалгана

#### "Runtime error"
- ✅ Vercel Dashboard → Functions → Logs
- ✅ Database schema зөв ажиллуулсан эсэхийг шалгана
- ✅ `.env.local` дахь keys Vercel дээр нэмсэн эсэхийг нягтална

---

## 🎯 Deployment дууссаны дараа:

### 1. Custom Domain (Хүсвэл)
```bash
# Vercel Dashboard:
# Settings → Domains → Add domain
# Жишээ: neoncanvas.com
```

### 2. Monitoring
```bash
# Vercel Dashboard:
# Analytics - Page views, performance
# Logs - Error tracking
# Speed Insights - Performance metrics
```

### 3. Auto-deployments
```bash
# GitHub-руу push бүрт автоматаар deploy хийгдэнэ:
git add .
git commit -m "Update feature"
git push

# Vercel автоматаар илрүүлж deploy хийнэ
```

---

## 📱 Хүүхдүүдэд өгөх зааварчилгаа:

```
🎓 NeonCanvas сайт:
https://your-app.vercel.app

1. Email оруул (жишээ: student@email.com)
2. "Student" эсвэл "Teacher" сонго
3. Login дар
4. Амжилт! Сурахад бэлэн 🚀

Features:
✅ Post үүсгэх (зураг оруулах боломжтой)
✅ Reactions өгөх (👍 ❤️ 🔥)
✅ XP цуглуулах
✅ Leaderboard-д гарч ирэх
✅ Lessons & Contests
```

---

## 🔄 Updates хийх:

```bash
# 1. Code засварлах
# 2. Commit хийх
git add .
git commit -m "Fix bug / Add feature"

# 3. Push хийх
git push

# 4. Vercel автоматаар deploy хийнэ!
# Dashboard дээр үр дүнг харна
```

---

## 💰 Үнэ:

- **Vercel Hobby Plan**: FREE
  - Unlimited deployments
  - 100GB bandwidth/month
  - Automatic HTTPS
  - Global CDN
  - Хангалттай 50-100 хэрэглэгчдэд!

---

## ✨ Та бэлэн!

1. ✅ Supabase project үүсгэсэн
2. ✅ Git commit хийсэн
3. ⏳ **GitHub push хийх**
4. ⏳ **Vercel deploy хийх**
5. 🎉 Хүүхдүүдэд URL өгөх!

**Good luck! 🚀**
