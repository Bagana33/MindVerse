import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionFromCookies } from "../../../../lib/session";

type ChatClient = { client: OpenAI; model: string; provider: "openrouter" };

const openRouterHeaders = {
  "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "http://localhost:3000",
  "X-Title": process.env.OPENROUTER_APP_NAME || process.env.APP_NAME || "Mind Verse",
};

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

function getTextClient(): ChatClient | null {
  const openrouter = getOpenRouterClient();

  if (openrouter) {
    return { client: openrouter, model: "google/gemma-3-27b-it:free", provider: "openrouter" };
  }

  return null;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });

  const client = getTextClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, provider: null, model: null, testOk: false, error: "AI key тохируулаагүй" });
  }

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
    return NextResponse.json({ ok: true, configured: true, provider: client.provider, model: client.model, testOk: ok });
  } catch (e: any) {
    const code = e?.status ?? e?.code ?? e?.response?.status;
    const message = e?.message || "error";
    return NextResponse.json({ ok: true, configured: true, provider: client.provider, model: client.model, testOk: false, error: `${code || ''} ${message}`.trim() });
  }
}
