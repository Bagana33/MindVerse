# Groq API Setup for Design Assistant

## Why Groq?
- **FREE unlimited API calls** (Community tier)
- **Lightning fast** responses (faster than OpenAI/Gemini)
- **OpenAI-compatible** API (easy to use)
- **Reliable** - no quota/balance issues

## Setup Steps

### 1. Get Groq API Key
Visit: https://console.groq.com/keys

1. Sign up with GitHub/Google (free)
2. Click "Create API Key"
3. Copy the key (starts with `gsk_...`)

### 2. Add to Environment
Open `.env.local` and paste your key:
```bash
GROQ_API_KEY=gsk_YOUR_KEY_HERE
```

### 3. Restart Server
```bash
npm run dev
```

## Technical Details

- **Model**: `llama-3.3-70b-versatile` (70B parameters, very smart)
- **Speed**: ~100 tokens/second (very fast)
- **Max Tokens**: 350 per response
- **Temperature**: 0.5 (balanced creativity)
- **Base URL**: https://api.groq.com/openai/v1

## Fallback
If `GROQ_API_KEY` is not set, the system will:
1. Try `OPENAI_API_KEY` if available
2. Fall back to curated design tips

## Testing
After setup, test the chat bot:
1. Go to http://localhost:3000
2. Click the 💬 button (bottom right)
3. Ask: "Typography scale яаж барих вэ?"
4. You should get a real AI response in Mongolian

## Troubleshooting

**Problem**: "AI одоогоор ашиглах боломжгүй"
- **Solution**: Check that `GROQ_API_KEY` is set correctly in `.env.local`
- Restart the dev server

**Problem**: Rate limit error
- **Solution**: Groq Community tier is very generous, but if hit:
  - Wait a few minutes
  - Or sign up for Groq Pro (still free tier available)

## Benefits Over Previous Solutions

| Provider | Cost | Speed | Quota Issues | Reliability |
|----------|------|-------|--------------|-------------|
| Google Gemini | Free | Medium | Model version conflicts | Medium |
| DeepSeek | Paid | Fast | Balance required | Low |
| OpenRouter | Free tier | Medium | Quota limits | Medium |
| **Groq** | **FREE** | **Very Fast** | **None** | **High** |

Groq is the best choice for this project! 🚀
