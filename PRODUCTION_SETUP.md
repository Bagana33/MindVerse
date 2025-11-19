# Production Deployment Setup

## Critical: Add Environment Variables to Vercel

The chat bot requires API keys to work in production. Follow these steps:

### 1. Go to Vercel Dashboard
Visit: https://vercel.com/dashboard

1. Select your project (MindVerse)
2. Click **Settings** tab
3. Click **Environment Variables** in sidebar

### 2. Add Required Variables

Add these environment variables:

#### Required for Chat Bot:
```
GROQ_API_KEY=your_groq_api_key_here
```

**Where to get it**: Copy the `GROQ_API_KEY` value from your `.env.local` file (starts with `gsk_...`)

#### Already Set (check these exist):
```
NEXT_PUBLIC_SUPABASE_URL=https://daazuexgbwlfmzinimzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CLOUDINARY_CLOUD_NAME=dzuau3fae
CLOUDINARY_API_KEY=524826371873985
CLOUDINARY_API_SECRET=vL0vLbxEYOn5cCvHDkW3DLh6TKU
CRON_SECRET=mindverse_cron_secret_2025_xk9p2m4n
```

### 3. Important Settings

For each variable:
- **Environment**: Select **Production**, **Preview**, AND **Development**
- Click **Save**

### 4. Redeploy

After adding variables:
1. Go to **Deployments** tab
2. Click the three dots (**⋯**) on latest deployment
3. Click **Redeploy**
4. Wait for deployment to finish (~2 minutes)

### 5. Test Chat Bot

After redeployment:
1. Visit your domain (e.g., https://mindverse.vercel.app)
2. Login as student
3. Click chat icon (💬) bottom right
4. Send a message like "typography"
5. Should get AI response in ~1-2 seconds

## Troubleshooting

### Chat shows "AI одоогоор ашиглах боломжгүй"

**Cause**: `GROQ_API_KEY` not set in Vercel

**Fix**:
1. Check Vercel → Settings → Environment Variables
2. Make sure `GROQ_API_KEY` exists
3. Make sure it's enabled for **Production**
4. Redeploy

### Chat works locally but not on domain

**Cause**: Environment variables only in `.env.local` (not in Vercel)

**Fix**: Follow steps 1-4 above

### "Session expired" or "401 Unauthorized"

**Cause**: Supabase keys mismatch or missing

**Fix**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Must match your `.env.local` values
3. Redeploy after fixing

## Quick Commands

Push to trigger auto-deploy:
```bash
git add -A
git commit -m "trigger redeploy"
git push
```

Check deployment logs:
```bash
vercel logs
```

## Security Note

⚠️ **NEVER commit `.env.local` to git!**

The `.gitignore` file already excludes it, but double-check:
```bash
git status
# Should NOT show .env.local
```

Environment variables should ONLY be set in:
- `.env.local` (for local development)
- Vercel Dashboard (for production)

## Current Status Checklist

After setup, verify:
- ✅ `GROQ_API_KEY` set in Vercel
- ✅ All Supabase keys set in Vercel
- ✅ Cloudinary keys set in Vercel
- ✅ Latest commit deployed
- ✅ Chat bot works on domain
- ✅ Chat bot works locally

If all checked, production is ready! 🚀
