import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSessionFromCookies } from "../../../../lib/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ ok: false, error: "Зөвхөн сурагчдад нээлттэй" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body?.message ?? "").toString().trim();
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  if (!message) {
    return NextResponse.json({ ok: false, error: "Асуултаа бичнэ үү" }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ ok: false, error: "Мессеж хэт урт байна (≤500)" }, { status: 400 });
  }

  const systemPrompt = `Та график дизайны туслах багш AI. Зөвхөн дараах сэдвүүдээр тусална:
— Typography, layout, color, contrast, spacing
— Branding, posters, social media visuals, UI basics
— Composition, visual hierarchy, accessibility
— Tools: Figma, Photoshop, Illustrator (үндсэн зөвлөмж)

Хэрвээ график дизайнтай холбоогүй асуулт асуувал: найрсаг байдлаар татгалзаад, тухайн сэдвийг дизайны өнцгөөс нь хэрхэн авч үзэж болох тухай богино санал болго.
Хариултаа богино, тод, 3–6 мөр байлга.`;

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.filter((m: any) => typeof m?.role === 'string' && typeof m?.content === 'string').map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ] as { role: "system" | "user" | "assistant"; content: string }[];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: 350,
      temperature: 0.5,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() ||
      "Сайн асуулт байна. Илүү тодорхой тайлбар өгвөл би илүү нарийн зөвлөмж өгч чадна.";

    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    console.error("Assistant error:", e);
    return NextResponse.json({ ok: true, answer: "Одоо түр завгүй байна. Дахин асуугаарай." });
  }
}
