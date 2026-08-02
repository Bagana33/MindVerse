// Script to generate REAL Visual AI Critiques by directly inspecting post images with Gemini Vision AI
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !apiKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const SYSTEM_INSTRUCTION =
  "Та graphic design багшийн AI туслах юм. Сурагчийн хавсаргасан зургийг ЯГ ВҮЗУАЛААР ХАРЖ, тухайн зураг дээр юу харагдаж буйг (өнгө, дүрслэл, объект, текст, зохиомж) бодитоор шүүмжилж зөвлөнө.";

function buildVisionPrompt(title, description) {
  return `Та graphic design багшийн AI туслах юм. Сурагчийн хавсаргасан зургийг ЯГ ВҮЗУАЛААР ХАРЖ шүүмжилж байна.

Гарчиг: ${title || 'Дизайн бүтээл'}
Тайлбар: ${description || 'Тайлбар байхгүй'}

Дараах байдлаар богино, тодорхой шүүмжлэл өгнө үү:
1. ✅ Зураг дээр визуалаар ямар өнгө, ямар объект/дүрслэл харагдаж буй ба сайн талууд (1-2 өгүүлбэр)
2. 💡 Зургийн өнгөний хослол, композиц, товчлуурын эффект, текстийн уншигдах байдалд сайжруулах санал (2-3 зөвлөмж)
3. 🎯 Дараагийн алхам (юу дээр анхаарах)

Монгол хэлээр, найрсаг, урам өгөх маягаар бич. Богино, тодорхой байлгаарай (5-6 өгүүлбэр).`;
}

async function fetchVisionCritique(title, description, imageData) {
  if (!imageData) return null;

  let inlineData = null;
  if (imageData.startsWith('data:image')) {
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      inlineData = { mime_type: match[1], data: match[2] };
    }
  } else if (/^https?:\/\//i.test(imageData)) {
    try {
      const imgRes = await fetch(imageData);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        inlineData = {
          mime_type: imgRes.headers.get('content-type') || 'image/jpeg',
          data: buffer.toString('base64'),
        };
      }
    } catch (e) {
      console.warn('Image fetch failed:', e.message);
    }
  }

  if (!inlineData) return null;

  const prompt = buildVisionPrompt(title, description);
  const parts = [
    { inline_data: inlineData },
    { text: prompt }
  ];

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.5,
        },
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      console.warn(`Gemini Vision API Warning (${response.status}):`, json?.error?.message);
      return null;
    }

    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();

    if (text && text.length >= 40) {
      return text;
    }
  } catch (err) {
    console.error('Gemini Vision request error:', err.message);
  }

  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Starting Gemini Vision AI Critique Processor...');
  console.log(`Using model: ${model}`);

  // Fetch posts with images (lightweight list query)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, description, text, author_email')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching posts:', error);
    process.exit(1);
  }

  console.log(`📋 Found ${posts.length} posts. Checking visual images...`);

  let updatedCount = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const authorEmail = post.author_email || '';

    if (authorEmail === 'ai-assistant' || authorEmail === 'news-bot') {
      continue;
    }

    // Fetch image_data for this specific post
    const { data: postDetail } = await supabase
      .from('posts')
      .select('image_data')
      .eq('id', post.id)
      .single();

    const imageData = postDetail?.image_data;
    if (!imageData) continue;

    console.log(`\n[${i + 1}/${posts.length}] 👁️ Visually inspecting image for post: "${post.title || 'Untitled'}" (ID: ${post.id})...`);
    const visionCritique = await fetchVisionCritique(post.title, post.description || post.text, imageData);

    if (visionCritique) {
      // Find existing AI comment or create
      const { data: existingComments } = await supabase
        .from('comments')
        .select('id')
        .eq('post_id', post.id)
        .eq('author_email', 'ai-assistant')
        .limit(1);

      if (existingComments && existingComments.length > 0) {
        await supabase
          .from('comments')
          .update({ content: visionCritique })
          .eq('id', existingComments[0].id);
        console.log(`✅ Updated existing AI comment with REAL VISUAL critique!`);
      } else {
        const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await supabase.from('comments').insert([
          {
            id: commentId,
            post_id: post.id,
            author_email: 'ai-assistant',
            content: visionCritique,
            is_ai: true,
            created_at: new Date().toISOString(),
          },
        ]);
        console.log(`✅ Created new AI comment with REAL VISUAL critique!`);
      }

      updatedCount++;
    } else {
      console.warn(`⚠️ Could not generate visual critique for post ${post.id}`);
    }

    // 250ms sleep for rate limits
    await sleep(250);
  }

  console.log(`\n🎉 Finished! Successfully visually inspected and updated ${updatedCount} posts with REAL Gemini Vision AI Critiques!`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
