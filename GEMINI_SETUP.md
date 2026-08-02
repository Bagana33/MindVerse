# Google Gemini API Setup - StudentAssistant

StudentAssistant chat bot одоо **Google Gemini AI** (Gemini 1.5 Flash) ашигладаг болсон.

## API Key авах

1. [Google AI Studio](https://makersuite.google.com/app/apikey) руу очино уу
2. Google account-аараа нэвтэрнэ
3. "Get API Key" товч дарж шинэ API key үүсгэнэ
4. API key-г хуулна

## Тохиргоо

`.env.local` файлдаа дараах мөрийг нэмнэ:

```bash
GOOGLE_GEMINI_API_KEY=your_actual_api_key_here
```

## Давуу тал

- ✅ **Үнэгүй**: Gemini 1.5 Flash бол үнэгүй (rate limits-тай)
- ✅ **Хурдан**: OpenAI-аас хурдан хариулт өгнө
- ✅ **Монгол хэл**: Монгол хэлийг сайн ойлгоно
- ✅ **Fallback**: API алдаа гарвал curated дизайны зөвлөмж өгнө

## Ашиглалт

Chat bot нь зөвхөн **graphic design** сэдвүүдэд тусална:
- Typography, Layout, Color theory
- Figma, Photoshop, Illustrator
- Composition, Visual hierarchy
- Branding, Posters, Social media design

## Техникийн дэлгэрэнгүй

**Файлууд:**
- `lib/gemini.ts` - Gemini API client
- `lib/ai-critique.ts` - Пост бүр дээр автомат дизайны шүүмжлэл
- `app/api/posts/route.ts` - Пост үүсэхэд AI comment нэмнэ
- `app/api/assistant/chat/route.ts` - Chat bot (OpenRouter/OpenAI)
- `components/assistant/StudentAssistant.tsx` - Chat UI

**Model:** `gemini-flash-latest` (GEMINI_MODEL env-ээр өөрчлөх боломжтой)
**Max tokens:** 350
**Temperature:** 0.5
