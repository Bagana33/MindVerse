// Test script to create a news post
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestNews() {
  // First, ensure news-bot user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'news-bot')
    .single();

  if (!existingUser) {
    console.log('Creating news-bot user...');
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        email: 'news-bot',
        name: '📰 Мэдээ',
        role: 'teacher', // System user
        experience: 0,
      }]);

    if (userError) {
      console.error('Error creating user:', userError);
      return;
    }
  }

  // Create news post
  const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newPost = {
    id: postId,
    author_email: 'news-bot',
    text: '🎨 Дизайны зөвлөмж: Өнгөний 60-30-10 дүрмийг ашигла! Үндсэн өнгө 60%, туслах өнгө 30%, онцлох өнгө 10% харьцаатай байвал дизайн тань илүү тэнцвэртэй, мэргэжлийн харагдана. Adobe Color Wheel-ээр өнгө сонгоод дадлага хий!',
    image_data: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80', // Graphic design image
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('posts')
    .insert([newPost])
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! News post created:', data);
  }
}

createTestNews();
