import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateGeminiText } from "../../../../lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatClient = { client: OpenAI; model: string; provider: "gemini" | "openai" | "openrouter" };

const openRouterHeaders = {
  "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "http://localhost:3000",
  "X-Title": process.env.OPENROUTER_APP_NAME || process.env.APP_NAME || "Mind Verse",
};

const openRouterTextModels = [
  process.env.OPENROUTER_CHAT_MODEL,
  "openai/gpt-oss-20b:free",
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
].filter(Boolean) as string[];

function getGeminiOpenAIClient(): OpenAI | null {
  const apiKeyRaw = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const apiKey = apiKeyRaw?.trim().replace(/^<|>$/g, "");
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

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

  if (gemini) {
    clients.push({ client: gemini, model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite", provider: "gemini" });
  }
  if (openai) {
    clients.push({ client: openai, model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini", provider: "openai" });
  }
  if (openrouter) {
    for (const model of Array.from(new Set(openRouterTextModels))) {
      clients.push({ client: openrouter, model, provider: "openrouter" });
    }
  }

  return clients;
}

export async function GET() {
  const clients = getTextClients();
  if (!clients.length) {
    return NextResponse.json({ ok: false, configured: false, provider: null, model: null, testOk: false, error: "AI key тохируулаагүй" });
  }

  const results = [];
  for (const client of clients) {
    try {
      const completion = await client.client.chat.completions.create({
        model: client.model,
        messages: [
          { role: "system", content: "healthcheck" },
          { role: "user", content: "ping" },
        ],
        max_tokens: 5,
        temperature: 0,
      });
      const ok = !!completion.choices?.[0]?.message?.content;
      results.push({ provider: client.provider, model: client.model, testOk: ok });
      if (ok) {
        return NextResponse.json({
          ok: true,
          configured: true,
          provider: client.provider,
          model: client.model,
          testOk: true,
          results,
        });
      }
    } catch (e: any) {
      const code = e?.status ?? e?.code ?? e?.response?.status;
      const message = e?.message || "error";
      results.push({
        provider: client.provider,
        model: client.model,
        testOk: false,
        error: `${code || ""} ${message}`.trim(),
      });
    }
  }

  return NextResponse.json({ ok: true, configured: true, provider: null, model: null, testOk: false, results });
}
