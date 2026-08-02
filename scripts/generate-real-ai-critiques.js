// Replace fallback AI comments with REAL AI-generated design critiques using OpenRouter (GPT-4o-mini)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

if (!supabaseUrl || !supabaseKey || !openRouterKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SYSTEM_INSTRUCTION =
  "Та graphic design багшийн AI туслах юм. Сурагчдад найрсаг, урам өгөх маягаар практик зөвлөмж өгдөг. Зураг болон сэдэвт тохирсон дизайнаар зөвлөнө.";

function buildCritiquePrompt(title, description) {
  return `Та graphic design багшийн AI туслах юм. Сурагчийн дизайн бүтээлийг шүүмжилж байна.

Гарчиг: ${title || 'Дизайн бүтээл'}
Тайлбар: ${description || 'Тайлбар байхгүй'}

Дараах байдлаар шүүмжлэл өгнө үү:
1. ✅ Сайн талууд (1-2 өгүүлбэр)
2. 💡 Сайжруулах санал (2-3 практик зөвлөмж)
3. 🎯 Дараагийн алхам (юу дээр анхаарах)

Монгол хэлээр, найрсаг, урам өгөх маягаар бич. Богино, тодорхой байлгаарай (4-5 өгүүлбэр).`;
}

async function fetchRealAICritique(title, description) {
  const prompt = buildCritiquePrompt(title, description);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn(`OpenRouter Warning (${res.status}):`, errJson?.error?.message);
      return null;
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (text && text.length >= 30) {
      return text;
    }
  } catch (err) {
    console.error('OpenRouter request error:', err.message);
  }

  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Starting Real AI Critique Generator...');

  // Get all AI comments
  const { data: comments, error } = await supabase
    .from('comments')
    .select('id, post_id, content')
    .eq('author_email', 'ai-assistant');

  if (error) {
    console.error('Error fetching comments:', error);
    process.exit(1);
  }

  const fallbackComments = comments.filter((c) =>
    c.content.includes('Сайн тал: Сэдэв тодорхой')
  );

  console.log(`📋 Found ${fallbackComments.length} fallback AI comments to replace with REAL AI critiques.`);

  if (fallbackComments.length === 0) {
    console.log('🎉 No fallback comments found! All AI critiques are real.');
    return;
  }

  // Get post details for these comments
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, description, text');

  const postsMap = new Map(posts?.map((p) => [p.id, p]));

  let updatedCount = 0;

  for (let i = 0; i < fallbackComments.length; i++) {
    const comment = fallbackComments[i];
    const post = postsMap.get(comment.post_id) || {};
    const title = post.title || 'Дизайн бүтээл';
    const description = post.description || post.text || '';

    console.log(`\n[${i + 1}/${fallbackComments.length}] 🤖 Generating REAL AI critique for post: "${title}"...`);
    const realCritique = await fetchRealAICritique(title, description);

    if (realCritique) {
      const { error: updateErr } = await supabase
        .from('comments')
        .update({ content: realCritique })
        .eq('id', comment.id);

      if (updateErr) {
        console.error(`❌ Failed to update comment ${comment.id}:`, updateErr.message);
      } else {
        console.log(`✅ Updated with REAL AI Critique!`);
        updatedCount++;
      }
    } else {
      console.warn(`⚠️ Skipped comment ${comment.id} due to API failure.`);
    }

    // Gentle 150ms delay between requests
    await sleep(150);
  }

  console.log(`\n🎉 Successfully updated ${updatedCount} comments with REAL AI Critiques!`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
