type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function getGeminiApiKey(): string | null {
  const raw = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const key = raw?.trim().replace(/^<|>$/g, "");
  return key || null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

export function parseImageForGemini(
  imageUrl: string
): { mimeType: string; data: string } | null {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) return { mimeType: match[1], data: match[2] };
  }
  return null;
}

export async function fetchImageForGemini(
  imageUrl: string
): Promise<{ mimeType: string; data: string } | null> {
  const inline = parseImageForGemini(imageUrl);
  if (inline) return inline;

  if (!/^https?:\/\//i.test(imageUrl)) return null;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { mimeType, data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

export async function generateGeminiText(
  prompt: string,
  options?: {
    systemInstruction?: string;
    imageUrl?: string;
    maxOutputTokens?: number;
    temperature?: number;
  }
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const model = getGeminiModel();
  const parts: GeminiPart[] = [];

  if (options?.imageUrl) {
    const image = await fetchImageForGemini(options.imageUrl);
    if (image) {
      parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data,
        },
      });
    }
  }

  parts.push({ text: prompt });

  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: options?.maxOutputTokens ?? 400,
      temperature: options?.temperature ?? 0.6,
    },
  };

  if (options?.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as GeminiResponse;

  if (!res.ok) {
    const msg = json.error?.message || res.statusText;
    throw new Error(`Gemini API error (${res.status}): ${msg}`);
  }

  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  return text || null;
}
