import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionFromCookies } from "../../../../lib/session";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });

  const configured = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  if (!configured) {
    return NextResponse.json({ ok: true, configured, model, testOk: false, error: "OPENAI_API_KEY алга" });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "healthcheck" },
        { role: "user", content: "ping" },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const ok = !!completion.choices?.[0]?.message?.content;
    return NextResponse.json({ ok: true, configured, model, testOk: ok });
  } catch (e: any) {
    const code = e?.status ?? e?.code ?? e?.response?.status;
    const message = e?.message || "error";
    return NextResponse.json({ ok: true, configured, model, testOk: false, error: `${code || ''} ${message}`.trim() });
  }
}
