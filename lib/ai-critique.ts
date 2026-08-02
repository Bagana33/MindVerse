import { generateGeminiText } from "./gemini";

const SYSTEM_INSTRUCTION =
  "Та graphic design багшийн AI туслах юм. Сурагчдад найрсаг, урам өгөх маягаар практик зөвлөмж өгдөг. Зураг байвал бодит дизайны элементүүдийг (layout, өнгө, typography, composition) шинжил.";

export const FALLBACK_CRITIQUE = `✅ Сайн тал: Сэдэв тодорхой, санаа сонирхолтой байна.

💡 Зөвлөмж: Контраст (өнгө/хэмжээ) дээр илүү тоглоорой, зай талбайг амьсгаа авах боломжтой болго.

🎯 Дараагийн алхам: Гарчиг, тайлбарын typography-г нэмж туршаарай.`;

function buildCritiquePrompt(title: string, description: string, hasImage: boolean): string {
  return `Та graphic design багшийн AI туслах юм. Сурагчийн дизайн бүтээлийг шүүмжилж байна.

Гарчиг: ${title}
Тайлбар: ${description}
${hasImage ? "Зураг хавсаргасан — зургийг шууд шинжил." : "Зураггүй бүтээл — гарчиг, тайлбараас дүгнэ."}

Дараах байдлаар шүүмжлэл өг:
1. ✅ Сайн талууд (1-2 өгүүлбэр)
2. 💡 Сайжруулах санал (2-3 практик зөвлөмж)
3. 🎯 Дараагийн алхам (юу дээр анхаарах)

Монгол хэлээр, найрсаг, урам өгөх маягаар бич. Богино, тодорхой байлгаарай (5-6 өгүүлбэр).`;
}

async function generateOpenRouterCritique(prompt: string): Promise<string | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ],
        max_tokens: 450,
        temperature: 0.6,
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (text && text.length >= 30) return text;
  } catch (err) {
    console.error("OpenRouter critique error:", err);
  }
  return null;
}

export async function generateDesignCritique(input: {
  title: string;
  description: string;
  imageUrl?: string;
}): Promise<string> {
  const hasImage = Boolean(input.imageUrl);
  const prompt = buildCritiquePrompt(input.title, input.description, hasImage);

  // If image is attached, prioritize Gemini Vision AI for real visual inspection
  if (hasImage) {
    try {
      const critique = await generateGeminiText(prompt, {
        systemInstruction: SYSTEM_INSTRUCTION,
        imageUrl: input.imageUrl,
        maxOutputTokens: 400,
        temperature: 0.5,
      });

      if (critique && critique.length >= 40) return critique;
    } catch (err) {
      console.error("Gemini Vision design critique error:", err);
    }
  }

  // Try OpenRouter (GPT-4o-mini)
  const openRouterCritique = await generateOpenRouterCritique(prompt);
  if (openRouterCritique) return openRouterCritique;

  // Fallback Gemini attempt
  try {
    const critique = await generateGeminiText(prompt, {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 400,
      temperature: 0.6,
    });

    if (critique && critique.length >= 40) return critique;
  } catch (err) {
    console.error("Gemini design critique fallback error:", err);
  }

  return FALLBACK_CRITIQUE;
}
