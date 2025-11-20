// Check posts data structure in Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPosts() {
  console.log('🔍 Checking posts data...\n');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${posts?.length || 0} posts (showing first 5):\n`);
  
  posts?.forEach((post, idx) => {
    console.log(`Post ${idx + 1}:`);
    console.log(`  ID: ${post.id}`);
    console.log(`  Author: ${post.author_email}`);
    console.log(`  Title: ${post.title || '(null)'}`);
    console.log(`  Description: ${post.description ? post.description.substring(0, 50) + '...' : '(null)'}`);
    console.log(`  Text: ${post.text ? post.text.substring(0, 50) + '...' : '(null)'}`);
    console.log(`  Has image: ${post.image_data ? 'Yes' : 'No'}`);
    console.log('');
  });

  // Check column info
  console.log('\n📊 Checking column structure...');
  const { data: columns } = await supabase
    .from('posts')
    .select('*')
    .limit(0);
  
  if (columns !== null) {
    console.log('✅ Posts table is accessible');
  }
}

checkPosts();
