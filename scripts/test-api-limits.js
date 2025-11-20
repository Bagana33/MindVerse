// Test API posts endpoint with different limits
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAPILimits() {
  console.log('🧪 Testing API post limits...\n');

  const testEmail = 'ejk.kej08@gmail.com'; // Has 7 posts

  // Test with different limits
  const limits = [10, 20, 50, 100, 200];

  for (const limit of limits) {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, title, author_email, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.log(`❌ Error with limit ${limit}:`, error.message);
      continue;
    }

    const userPosts = posts?.filter(p => p.author_email === testEmail) || [];
    
    console.log(`Limit ${limit}:`);
    console.log(`  Total posts fetched: ${posts?.length || 0}`);
    console.log(`  Bumanjargal T's posts: ${userPosts.length}`);
    console.log('');
  }

  // Also check total posts in database
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total posts in database: ${count}`);
  console.log(`💡 Recommendation: Use limit >= ${count} to fetch all posts`);
}

testAPILimits();
