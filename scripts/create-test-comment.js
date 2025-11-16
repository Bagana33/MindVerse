// Manually create AI comment for testing
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestComment() {
  // Get the latest student post
  const { data: posts } = await supabase
    .from('posts')
    .select('id, author_email')
    .eq('author_email', 'west@gmail.com')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!posts || posts.length === 0) {
    console.log('No student posts found');
    return;
  }

  const postId = posts[0].id;
  console.log('Adding AI comment to post:', postId);

  const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const testComment = {
    id: commentId,
    post_id: postId,
    author_email: 'ai-assistant',
    content: `✅ Сайн талууд: Өнгө тод, зураг сонирхолтой харагдаж байна.

💡 Сайжруулах санал: 
- Гарчгийг илүү тодорхой бичээрэй
- Зургийн тайлбарт ямар tool ашигласан талаар нэмж бичих

🎯 Дараагийн алхам: Typography болон layout-д анхаарч, илүү мэргэжлийн харагдах болгоорой!`,
    is_ai: true,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('comments')
    .insert([testComment])
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! AI comment created:', data);
  }
}

createTestComment();
