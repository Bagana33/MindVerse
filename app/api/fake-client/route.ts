import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { addExperience } from "../../../lib/users";
import { invalidateServerCache } from "../../../lib/serverCache";

export const runtime = "nodejs";

// ── Fake Client Briefs pool ─────────────────────────────────────────────────
const CLIENT_BRIEFS = [
  {
    id: "brief_001",
    clientName: "Мөнгөн Од Брэнд",
    clientAvatar: "🌙",
    clientColor: "#6366f1",
    task: "Бидэнд шинэ logo дизайн хэрэгтэй байна. Бид орчин үеийн, минималист брэнд бүтээхийг зорьж байгаа.",
    requirements: ["Тойрог хэлбэр агуулсан байх", "Хос өнгийн gradient (уусгалт) ашиглах", "Минималист, цэвэрхэн загвартай байх"],
    challenge: "Логоны голд жижигхэн одны дүрс нууцаар (negative space ашиглан) оруулж чадах уу?",
    category: "Logo Design",
    xpReward: 25,
    keywords: ["logo", "тойрог", "gradient", "минималист", "брэнд", "дизайн", "од", "negative space"],
  },
  {
    id: "brief_002",
    clientName: "Цагаан Салхи Кофе",
    clientAvatar: "☕",
    clientColor: "#92400e",
    task: "Манай кофены дэлгүүрийн шинэ урамшууллыг зарлах Instagram пост хиймээр байна.",
    requirements: ["Дулаахан, таатай өнгийн палитр ашиглах", "Serif фонтоор гарчиг бичих", "Кофены зураг эсвэл дүрс оруулах"],
    challenge: "Зурган дээрх текстийг 3D мэт сүүдэртэй (drop shadow) болгож, кофены уурыг дүрсэлж чадах уу?",
    category: "Social Media",
    xpReward: 20,
    keywords: ["instagram", "пост", "social media", "дулаан", "өнгө", "кофе", "serif", "фонт", "уур"],
  },
  {
    id: "brief_003",
    clientName: "TechStart Startup",
    clientAvatar: "🚀",
    clientColor: "#0ea5e9",
    task: "Шинэ гар утасны аппликэйшнд зориулсан Landing page (танилцуулга хуудас) дизайн гаргаж өгнө үү.",
    requirements: ["Dark mode буюу бараан дэвсгэртэй байх", "Neon accent (тод гэрэлтсэн) өнгө оруулах", "Том, анхаарал татсан Hero section-той байх"],
    challenge: "Гар утасны mockup (загвар) дотор апп-ийн дэлгэцийг байрлуулж, хуудсыг илүү бодит харагдуулах.",
    category: "UI/UX Design",
    xpReward: 35,
    keywords: ["landing page", "dark mode", "neon", "hero section", "ui", "ux", "mobile", "app", "mockup"],
  },
  {
    id: "brief_004",
    clientName: "Ногоон Тал НТ",
    clientAvatar: "🌿",
    clientColor: "#16a34a",
    task: "Байгаль орчныг хамгаалах өдөрлөгт зориулсан брошур (гарын авлага) хэрэгтэй байна.",
    requirements: ["Цэвэр, ногоон өнгө давамгайлсан байх", "Байгаль, модны дүрс зураг ашиглах", "Мэдээллийг уншихад хялбар байдлаар хуваарилах"],
    challenge: "Мэдээллийг зүгээр текстээр биш, жижиг infographic (зурган мэдээлэл) ашиглан харуулах.",
    category: "Print Design",
    xpReward: 30,
    keywords: ["брошур", "brochure", "ногоон", "байгаль", "дүрс", "зураг", "хэвлэл", "infographic"],
  },
  {
    id: "brief_005",
    clientName: "Хар Чулуу Рок Бэнд",
    clientAvatar: "🎸",
    clientColor: "#dc2626",
    task: "Манай хамтлагийн дараагийн амьд тоглолтод зориулсан poster (зурагт хуудас) хийнэ үү.",
    requirements: ["Харанхуй, гранж (grunge) хэв маягтай дэвсгэр", "Цочир, тод өнгийн тексттэй байх", "Гал эсвэл усны элемент оруулах"],
    challenge: "Текстийг энгийнээр биш, эвдэрсэн эсвэл урагдсан мэт өвөрмөц typography ашиглаж бичих.",
    category: "Poster Design",
    xpReward: 28,
    keywords: ["poster", "рок", "концерт", "харанхуй", "тод", "гал", "typography", "grunge"],
  },
  {
    id: "brief_006",
    clientName: "Сансарын Аялал ХК",
    clientAvatar: "🛸",
    clientColor: "#7c3aed",
    task: "Хиймэл дагуулын аялалын компанийн Brand Identity (брэнд дүр төрх) гаргах хэрэгтэй байна.",
    requirements: ["Орчлон ертөнцийн, сансрын гүн өнгөнүүд ашиглах", "Орчин үеийн, цэвэрхэн sans-serif шрифт ашиглах", "Ирээдүйг илтгэсэн, футурист мэдрэмж төрүүлэх"],
    challenge: "Логоны тэмдэгт нь өөрөө ямар нэгэн үсэг болон гариг хоёрыг хослуулсан байх.",
    category: "Branding",
    xpReward: 40,
    keywords: ["branding", "brand", "identity", "сансар", "sans-serif", "шрифт", "өнгө", "футурист", "гариг"],
  },
  {
    id: "brief_007",
    clientName: "Арт Галерей Нэгтгэл",
    clientAvatar: "🖼️",
    clientColor: "#b45309",
    task: "Шинэ уран зургийн үзэсгэлэнгийн нээлтэд зориулсан VIP урилганы дизайн гаргаж өгнө үү.",
    requirements: ["Элэгдэлтэй буюу vintage хэв маягтай байх", "Нарийн, аристократ, тансаг харагдах", "Алтан эсвэл хүрэл өнгийн деталь оруулах"],
    challenge: "Урилгын хүрээг энгийн шугамаар биш, уран гоё хээ угалзаар чимэглэх.",
    category: "Invitation Design",
    xpReward: 22,
    keywords: ["урилга", "invitation", "галерей", "art", "elegant", "элэгдэлтэй", "тансаг", "алтан", "vintage"],
  },
  {
    id: "brief_008",
    clientName: "Эрдмийн Мэдлэг Академи",
    clientAvatar: "📚",
    clientColor: "#0891b2",
    task: "Онлайн сургалтын платформын сурагчийн Dashboard (хянах самбар)-ийн UI дизайн гаргана уу.",
    requirements: ["Тоглоомжуулалт (Gamification) буюу XP систем харуулах", "Прогресс мөр (Progress bar) оруулах", "Цэнхэр өнгө давамгайлсан, цэвэрхэн харагдах"],
    challenge: "Сурагчийн түвшнийг харуулсан жижиг батж (badge) эсвэл медаль зурж оруулах.",
    category: "Dashboard UI",
    xpReward: 45,
    keywords: ["dashboard", "ui", "gamification", "xp", "прогресс", "progress bar", "онлайн", "badge", "медаль"],
  },
];

// ── AI grading system ────────────────────────────────────────────────────────
function buildGradingPrompt(brief: typeof CLIENT_BRIEFS[0], studentResponse: string, hasImage: boolean): string {
  return `Та "Fake Client" тоглоомын AI шүүгч. Сурагч дизайны даалгавраа дуусгасан гэж мэдэгдсэн, та тэдний тайлбарыг шалгана.
${hasImage ? "\nСурагч хариултдаа зураг хавсаргасан байна, зургийг сайтар шинжилж үнэлгээндээ оруулаарай!" : ""}

Клиентийн даалгавар: "${brief.task}"
Шаардлагууд (Requirements):
${brief.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}
Сорилт (Challenge): "${brief.challenge}"

Сурагчийн хариулт: "${studentResponse}"

Та доорх шалгуураар 10 оноо өгч дүгнэнэ үү. Хариугаа зөвхөн JSON хэлбэрээр өгнө.
Шалгах зүйлс:
- Клиентийн шаардлагуудыг хэр сайн хангасан бэ? (Онооны 50%)
- Сорилтыг (challenge) биелүүлсэн байвал нэмэлт оноо өгөх. (Онооны 20%)
- Дизайны хийсэн процессын тайлбар (ямар программ ашигласан, өнгө, фонт сонгосон учир г.м). (Онооны 30%)
- Мөн ЗУРАГТ ШИНЖИЛГЭЭ ХИЙНЭ: Хэрэв сурагч бэлэн AI арт/фото зураг оруулаад (Midjourney/DALL-E г.м) өөрөө графикаар хийсэн мэт хуурахыг оролдсон бол эсвэл дизайны файл/программ дээр хийсэн вектор/текст/дэлгэцийн ажил биш байвал score = 0, passed = false өгч, хуурахгүйгээр өөрөө дизайн хийхийг анхааруулна.
- Хэрэв зураг эсвэл тайлбар нь даалгавартай огт хамааралгүй, эсвэл хангалтгүй байвал score <= 4, passed = false, xpEarned = 0 өгнө.
- Хэрэв өөрөө хийсэн сайн дизайн байвал score >= 6, passed = true, xpEarned = Math.round(score * ${brief.xpReward} / 10) өгнө.`;
}

function getGeminiClient() {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  return apiKey;
}

async function callGeminiGrading(prompt: string, imageUrl?: string): Promise<string> {
  const apiKey = getGeminiClient();
  if (!apiKey) throw new Error("No Gemini API key");

  const parts: any[] = [{ text: prompt }];

  if (imageUrl && imageUrl.startsWith('data:image')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      parts.unshift({
        inline_data: {
          mime_type: match[1],
          data: match[2],
        },
      });
    }
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      score: { type: "INTEGER" },
      passed: { type: "BOOLEAN" },
      feedback: { type: "STRING" },
      clientReaction: { type: "STRING" },
      xpEarned: { type: "INTEGER" }
    },
    required: ["score", "passed", "feedback", "clientReaction", "xpEarned"]
  };

  const model = (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 2048, 
          responseMimeType: "application/json",
          responseSchema
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── GET: return the current client brief ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const briefId = searchParams.get("briefId");

  if (briefId) {
    const brief = CLIENT_BRIEFS.find((b) => b.id === briefId);
    if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    return NextResponse.json({ brief });
  }

  // Return all briefs (without xpReward exposed)
  const safeBriefs = CLIENT_BRIEFS.map(({ id, clientName, clientAvatar, clientColor, task, requirements, challenge, category }) => ({
    id, clientName, clientAvatar, clientColor, task, requirements, challenge, category,
  }));

  return NextResponse.json({ briefs: safeBriefs });
}

// ── POST: submit work + AI grade + award XP ──────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { briefId, response: studentResponse, imageUrl } = body;

  const brief = CLIENT_BRIEFS.find((b) => b.id === briefId);
  if (!briefId || (!studentResponse?.trim() && !imageUrl)) {
    return NextResponse.json({ error: "briefId болон response (эсвэл зураг) шаардлагатай" }, { status: 400 });
  }

  const responseText = studentResponse?.trim() || "Зураг илгээв";

  if (!imageUrl && responseText.length < 20) {
    return NextResponse.json({
      ok: false,
      score: 0,
      passed: false,
      feedback: "Хариулт хэтэрхий богино байна. Дизайны ажлаа тайлбарлаарай.",
      clientReaction: "Клиент: \"Энэ бол хариулт биш..\" 😑",
      xpEarned: 0,
    });
  }

  try {
    const prompt = buildGradingPrompt(brief, responseText, Boolean(imageUrl));
    const rawResponse = await callGeminiGrading(prompt, imageUrl);

    // Parse JSON from AI response
    console.log("Raw Gemini Response:", rawResponse);
    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch (e) {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid AI response format");
      result = JSON.parse(jsonMatch[0]);
    }
    const xpEarned = Math.min(Math.max(Math.round(result.xpEarned || 0), 0), brief.xpReward);
    const passed = Boolean(result.passed) && xpEarned > 0;

    // Award XP if passed
    if (passed && xpEarned > 0) {
      await addExperience(session.email, xpEarned);
      invalidateServerCache("leaderboard");
    }

    return NextResponse.json({
      ok: true,
      score: result.score ?? 0,
      passed,
      feedback: result.feedback || "AI шүүгч хариу өгч чадсангүй.",
      clientReaction: result.clientReaction || "",
      xpEarned: passed ? xpEarned : 0,
      maxXp: brief.xpReward,
    });
  } catch (err) {
    console.error("Fake client grading error:", err);
    // Fallback: keyword-based simple grading
    const responseTextLower = responseText.toLowerCase();
    const matchCount = brief.keywords.filter((kw) => responseTextLower.includes(kw.toLowerCase())).length;
    const score = Math.min(Math.round((matchCount / Math.max(brief.keywords.length, 1)) * 10), 10);
    const passed = score >= 5;
    const xpEarned = passed ? Math.round((score / 10) * brief.xpReward) : 0;

    if (passed && xpEarned > 0) {
      await addExperience(session.email, xpEarned).catch(() => {});
      invalidateServerCache("leaderboard");
    }

    return NextResponse.json({
      ok: true,
      score,
      passed,
      feedback: passed
        ? "Таны ажил шаардлагын голлох хэсгийг хангасан байна. Дизайны ойлголт харуулсан."
        : "Клиентийн шаардлагыг хангаагүй байна. Даалгаварыг дахин уншаад илүү дэлгэрэнгүй тайлбарлана уу.",
      clientReaction: passed ? "Клиент сэтгэл ханасан байна! 👍" : "Клиент: \"Дахин оролдоно уу...\" 🙁",
      xpEarned,
      maxXp: brief.xpReward,
    });
  }
}
