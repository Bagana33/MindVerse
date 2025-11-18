import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSessionFromCookies } from "../../../../lib/session";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

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

  // Basic runtime checks for clearer errors (after parsing message so we can fallback usefully)
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    // Offline fallback tips (still return ok=true so UI shows something useful)
    const offline = fallbackDesignTips(message);
    return NextResponse.json({ ok: true, answer: offline, offline: true });
  }
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build conversation history for Gemini
    const chatHistory = history
      .filter((m: any) => typeof m?.role === 'string' && typeof m?.content === 'string')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.5,
      },
    });

    const result = await chat.sendMessage(`${systemPrompt}\n\nХэрэглэгчийн асуулт: ${message}`);
    const response = await result.response;
    const answer = response.text().trim() || 
      "Сайн асуулт байна. Илүү тодорхой тайлбар өгвөл би илүү нарийн зөвлөмж өгч чадна.";

    return NextResponse.json({ ok: true, answer });
  } catch (e: any) {
    const code = e?.status ?? e?.code ?? e?.response?.status;
    const msg = e?.message || "Assistant error";
    console.error("Assistant error:", code, msg);
    // Fallback to curated tips on failure, so students still get value
    const tips = fallbackDesignTips(message);
    return NextResponse.json({ ok: true, answer: tips, offline: true });
  }
}
