// Script to run AI Critic on posts in Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = (process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim().replace(/^<|>$/g, '');
const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const SYSTEM_INSTRUCTION =
  "Та graphic design багшийн AI туслах юм. Сурагчдад найрсаг, урам өгөх маягаар практик зөвлөмж өгдөг. Зураг байвал бодит дизайны элементүүдийг (layout, өнгө, typography, composition) шинжил.";

const FALLBACK_CRITIQUE = `✅ Сайн тал: Сэдэв тодорхой, санаа сонирхолтой байна.

💡 Зөвлөмж: Контраст (өнгө/хэмжээ) дээр илүү тоглоорой, зай талбайг амьсгаа авах боломжтой болго.

🎯 Дараагийн алхам: Гарчиг, тайлбарын typography-г нэмж туршаарай.`;

function buildCritiquePrompt(title, description, hasImage) {
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

async function generateGeminiCritique(title, description, imageUrl) {
  if (!apiKey) {
    console.log('⚠️ GOOGLE_GEMINI_API_KEY test key missing or empty. Using curated fallback critique.');
    return FALLBACK_CRITIQUE;
  }

  const prompt = buildCritiquePrompt(title || 'Бүтээл', description || 'Тайлбар байхгүй', Boolean(imageUrl));
  const parts = [{ text: prompt }];

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

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
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
          temperature: 0.6,
        },
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      console.warn(`Gemini API Warning (${response.status}):`, json?.error?.message || response.statusText);
      return FALLBACK_CRITIQUE;
    }

    const critiqueText = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();

    if (critiqueText && critiqueText.length >= 30) {
      return critiqueText;
    }
  } catch (err) {
    console.error('Gemini request failed:', err.message);
  }

  return FALLBACK_CRITIQUE;
}

async function main() {
  console.log('🚀 Starting AI Critic batch processor...');

  // 1. Ensure AI user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('email')
    .eq('email', 'ai-assistant')
    .maybeSingle();

  if (!existingUser) {
    console.log('Creating AI assistant user...');
    await supabase.from('users').insert([
      {
        email: 'ai-assistant',
        name: '🤖 AI Шүүмжлэгч',
        role: 'teacher',
        experience: 0,
      },
    ]);
    console.log('✅ AI assistant user created');
  } else {
    console.log('✅ AI assistant user exists');
  }

  // 2. Fetch public posts (lightweight columns)
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, description, text, author_email, created_at')
    .order('created_at', { ascending: false });

  if (postsError) {
    console.error('❌ Error fetching posts:', postsError);
    process.exit(1);
  }

  console.log(`\n📋 Found total ${posts.length} posts.`);

  let addedCount = 0;
  let skippedCount = 0;

  for (const post of posts) {
    const authorEmail = post.author_email || '';
    if (authorEmail === 'ai-assistant' || authorEmail === 'news-bot') {
      skippedCount++;
      continue;
    }

    // Check if AI already commented on this post
    const { data: existingComments, error: commentCheckErr } = await supabase
      .from('comments')
      .select('id')
      .eq('post_id', post.id)
      .eq('author_email', 'ai-assistant')
      .limit(1);

    if (existingComments && existingComments.length > 0) {
      console.log(`⏭️ Post [${post.title || post.id}] already has AI critique. Skipping.`);
      skippedCount++;
      continue;
    }

    console.log(`\n🤖 Generating AI critique for post: "${post.title || 'Untitled'}" (ID: ${post.id})...`);
    const critiqueText = await generateGeminiCritique(post.title, post.description || post.text, post.image_data);

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const commentPayload = {
      id: commentId,
      post_id: post.id,
      author_email: 'ai-assistant',
      content: critiqueText,
      is_ai: true,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from('comments').insert([commentPayload]);
    if (insertErr) {
      console.error(`❌ Failed to insert comment for post ${post.id}:`, insertErr.message);
      continue;
    }

    console.log(`✅ Added AI critique comment!`);

    // Add notification
    if (authorEmail) {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        await supabase.from('notifications').insert([
          {
            id: notifId,
            user_email: authorEmail,
            message: '🤖 AI шүүмжлэл таны бүтээлд бэлэн боллоо!',
            read: false,
            type: 'LIKE',
          },
        ]);
      } catch (e) {
        // ignore notification error
      }
    }

    addedCount++;
  }

  console.log(`\n🎉 Finished processing! Added ${addedCount} new AI critiques, skipped ${skippedCount} posts.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
