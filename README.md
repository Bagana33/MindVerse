# MindVerse

## Environment setup

1) Copy the example env file and fill in your own values (do not paste secrets into the repo):

```
cp .env.example .env.local
```

2) Never commit `.env.local` — it's already ignored via `.gitignore`.

3) If you ever posted or committed a real key by mistake, rotate it immediately at the provider, then update `.env.local` and Vercel.

Providers used (optional, pick what you need):
- Groq (OpenAI-compatible) → GROQ_API_KEY
- Google Gemini → GOOGLE_GEMINI_API_KEY
- DeepSeek → DEEPSEEK_API_KEY
- OpenRouter → OPENROUTER_API_KEY (+ OPENROUTER_SITE_URL, OPENROUTER_APP_NAME)
- Cloudinary → CLOUDINARY_* keys
- Supabase → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- Cron secret → CRON_SECRET

See `PRODUCTION_SETUP.md` for Vercel deployment and environment configuration.
