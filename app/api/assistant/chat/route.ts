import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getClientKey, rateLimit } from "../../../../lib/rate-limit";
import { generateGeminiText } from "../../../../lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatClient = { client: OpenAI; model: string; provider: "gemini" | "openai" | "openrouter" };

const systemPrompt = `Та график дизайны туслах багш AI. Зөвхөн дараах сэдвүүдээр тусална:
— Typography, layout, color, contrast, spacing
— Branding, posters, social media visuals, UI basics
— Composition, visual hierarchy, accessibility
— Tools: Figma, Photoshop, Illustrator (үндсэн зөвлөмж)

Хэрвээ график дизайнтай холбоогүй асуулт асуувал: найрсаг байдлаар татгалзаад, тухайн сэдвийг дизайны өнцгөөс нь хэрхэн авч үзэж болох тухай богино санал болго.
Хариултаа богино, тод, 3–6 мөр байлга.`;

const MAX_MESSAGE_LENGTH = 500;

const openRouterHeaders = {
  "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "http://localhost:3000",
  "X-Title": process.env.OPENROUTER_APP_NAME || process.env.APP_NAME || "Mind Verse",
};

const openRouterTextModels = [
  process.env.OPENROUTER_CHAT_MODEL,
  "openai/gpt-4o-mini",
  "qwen/qwen-2.5-7b-instruct",
].filter(Boolean) as string[];

function getOpenRouterClient(): OpenAI | null {
  const apiKeyRaw = process.env.OPENROUTER_API_KEY;
  const apiKey = apiKeyRaw?.trim().replace(/^<|>$/g, "");
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: openRouterHeaders,
  });
}

function getGeminiOpenAIClient(): OpenAI | null {
  const apiKeyRaw = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const apiKey = apiKeyRaw?.trim().replace(/^<|>$/g, "");
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

function getOpenAIClient(): OpenAI | null {
  const apiKeyRaw = process.env.OPENAI_API_KEY;
  const apiKey = apiKeyRaw?.trim().replace(/^<|>$/g, "");
  if (!apiKey) return null;

  return new OpenAI({ apiKey });
}

function getTextClients(): ChatClient[] {
  const clients: ChatClient[] = [];
  const gemini = getGeminiOpenAIClient();
  const openai = getOpenAIClient();
  const openrouter = getOpenRouterClient();

  // Prioritize Gemini first (free & fastest)
  if (gemini) {
    clients.push({
      client: gemini,
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      provider: "gemini",
    });
  }
  if (openai) {
    clients.push({
      client: openai,
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      provider: "openai",
    });
  }
  if (openrouter) {
    for (const model of Array.from(new Set(openRouterTextModels))) {
      clients.push({
        client: openrouter,
        model,
        provider: "openrouter",
      });
    }
  }

  return clients;
}

function fallbackDesignTips(q: string): string {
  const s = q.toLowerCase();
  const tips: string[] = [];
  const push = (t: string) => tips.push(t);

  const unrelated = !/(figma|photoshop|ps\b|ai\b|illustrator|typography|font|color|colour|palette|layout|grid|composition|contrast|branding|logo|poster|social|export|print|cmyk|rgb)/.test(s);
  if (unrelated) {
    push("Би зөвхөн график дизайнд тусална. Асуултаа дизайн талаас нь тодруулна уу (ж: layout, өнгө, typography, Figma/PS хэрэгсэл).");
  }

  if (/(photoshop|ps\b)/.test(s)) {
    push("Photoshop: Layer, Mask, Adjustment layer-ийг дадал болго. Non-destructive урсгал хамгийн чухал.");
    push("Type/Shape-аа Smart Object болговол дахин хэмжихэд чанар алдахгүй.");
    push("Ctrl/Cmd+Shift+U (Desaturate), Levels/Curves-ээр контраст тохируулж balance барь.");
  }
  if (/figma/.test(s)) {
    push("Figma: Auto Layout-ыг spacing/align-д тогтмол ашигла. Constraints-аа тодорхой тавь.");
    push("Components + Variants-аа үүсгээд Style (Color/Text/Grid)-уудаа системтэй барь.");
  }
  if (/(typography|font)/.test(s)) {
    push("Typography: 2–3 фонтоос ихгүй ашигла. Scale: 12/16/24/32/48 гэх мэт цөөн шатлал байхад уншихад амар.");
    push("Leading (line-height) 1.4–1.6 орчим, paragraph-д 60–80 тэмдэгт/мөр бол тухтай.");
  }
  if (/(color|colour|palette)/.test(s)) {
    push("Өнгө: 1 үндсэн, 1–2 туслах өнгө. Контраст AA түвшин хангахыг зорь (contrast-ratio.com).");
    push("Бага зэрэг desaturate хийх нь модерн төрх өгнө; Accent-ыг хэтрүүлэхээс сэргийл.");
  }
  if (/(layout|grid|composition|contrast)/.test(s)) {
    push("Layout: 8pt/4pt grid-ээ барь, whitespace-аа айхгүй нэм. Visual hierarchy-г эхлээд тогтоо.");
    push("Контраст: хэмжээс, зузаан (weight), өнгө, зайг ялгаруулж санаагаа тод болго.");
  }
  if (/(branding|logo)/.test(s)) {
    push("Лого: хар-цагаанаар эхлээд хэлбэрээ баталгаажуул. Дараа нь өнгө/аппликэйшн руу ор.");
  }
  if (/(poster|social)/.test(s)) {
    push("Poster/Social: Нэг гол санаа + 1 visual focus. Гарчигт хамгийн их контраст, дэд мэдээлэлд subtle.");
  }
  if (/(export|save|png|jpg|jpeg)/.test(s)) {
    push("Export: Ил тод фон – PNG; Фото – JPG (80–90% quality). Вэбд 2x хэмжээ(twice pixel density) бэлд.");
  }
  if (/(print|cmyk|dpi|resolution)/.test(s)) {
    push("Печать: CMYK, 300dpi, bleed 3mm. Хар өнгөнд 100K эсвэл Rich Black профайлаас хамаарч тохируулаарай.");
  }

  if (tips.length === 0) {
    push("Дараах сэдвийг туршаад үз: layout-г grid-тэй болгох, өнгийн контраст нэмэх, typography scale-аа цэгцлэх, whitespace нэмэх.");
  }
  return "\n• " + tips.join("\n• ");
}

function isImageRequest(message: string) {
  const msg = message.toLowerCase();
  const wantsVisual = /(зураг|image|poster|logo|banner|visual|арт|art)/i.test(msg);
  const hasAction = /(үүсгэ|бүтээ|generate|create|make|гарга|харуул|өг)/i.test(msg);
  return wantsVisual && hasAction;
}

function extractText(msg: any): string {
  if (!msg) return "";
  if (typeof msg?.content === "string") return msg.content.trim();
  if (Array.isArray(msg?.content)) {
    return msg.content
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text.trim())
      .join(" ")
      .trim();
  }
  return "";
}

function extractImages(msg: any): string[] {
  const urls: string[] = [];

  if (Array.isArray(msg?.images)) {
    for (const im of msg.images) {
      const url = im?.image_url?.url || im?.imageUrl?.url || im?.url;
      if (url) urls.push(url);
    }
  }

  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      const url = part?.image_url?.url || part?.imageUrl?.url || part?.url;
      if (part?.type === "image_url" && url) {
        urls.push(url);
      }
    }
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

export async function POST(req: Request) {
  const rl = rateLimit(getClientKey(req, "assistant-chat"), { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Хэт олон асуулт илгээлээ. Түр хүлээгээд дахин оролдоно уу." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 30) } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const message = String(body?.message ?? "").trim();
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];

  if (!message) {
    return NextResponse.json({ ok: false, error: "Асуултаа бичнэ үү" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Мессеж хэт урт байна (≤500)" }, { status: 400 });
  }

  const wantsImage = isImageRequest(message);
  const openrouter = getOpenRouterClient();

  if (wantsImage && openrouter) {
    try {
      // OpenRouter supports modalities ["image","text"]; OpenAI SDK types only allow ["text","audio"]
      const result = await openrouter.chat.completions.create({
        model: "bytedance-seed/seedream-4.5",
        messages: [{ role: "user", content: message }],
        modalities: ["image", "text"],
      } as any);

      const msg: any = result.choices?.[0]?.message;
      const images = extractImages(msg);
      const text = extractText(msg) || "Зураг үүсгэлээ!";

      if (images.length) {
        return NextResponse.json({ ok: true, answer: text, images });
      }
    } catch (e) {
      console.error("OpenRouter image generation error:", e);
    }
  }

  const textClients = getTextClients();
  if (!textClients.length) {
    const offline = fallbackDesignTips(message);
    return NextResponse.json({ ok: true, answer: offline, offline: true });
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const errors: string[] = [];
  for (const textClient of textClients) {
    try {
      const completion = await textClient.client.chat.completions.create({
        model: textClient.model,
        messages,
        temperature: 0.5,
        max_tokens: 350,
      });

      const answer =
        extractText(completion.choices?.[0]?.message) ||
        "Сайн асуулт байна. Илүү тодорхой тайлбар өгвөл би илүү нарийн зөвлөмж өгч чадна.";

      return NextResponse.json({
        ok: true,
        answer,
        provider: textClient.provider,
        model: textClient.model,
      });
    } catch (e: any) {
      const code = e?.status ?? e?.code ?? e?.response?.status ?? "";
      const messageText = e?.message || "unknown error";
      errors.push(`${textClient.provider}/${textClient.model}: ${code} ${messageText}`.trim());
      console.error("Assistant text error:", textClient.provider, textClient.model, e);
    }
  }

  // Direct REST Gemini fallback if OpenAI-compatible wrappers failed
  try {
    const directGemini = await generateGeminiText(message, {
      systemInstruction: systemPrompt,
      maxOutputTokens: 350,
      temperature: 0.5,
    });
    if (directGemini) {
      return NextResponse.json({
        ok: true,
        answer: directGemini,
        provider: "gemini-rest",
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      });
    }
  } catch (err: any) {
    errors.push(`gemini-rest: ${err?.message || "unknown"}`);
  }

  const tips = fallbackDesignTips(message);
  return NextResponse.json({ ok: true, answer: tips, offline: true, errors });
}
