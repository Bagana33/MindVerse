// Test profile posts filtering
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testProfilePosts() {
  console.log('🧪 Testing profile posts filtering...\n');

  // Get all posts
  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select('id, author_email, title, text, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    return;
  }

  console.log(`📊 Total posts in database: ${postsData?.length || 0}\n`);

  // Get unique authors
  const authors = [...new Set(postsData?.map(p => p.author_email) || [])];
  console.log(`👥 Unique authors: ${authors.length}\n`);

  // Show posts per author
  authors.forEach(email => {
    const userPosts = postsData?.filter(p => p.author_email === email) || [];
    console.log(`${email}:`);
    console.log(`  - ${userPosts.length} posts`);
    if (userPosts.length > 0) {
      console.log(`  - Latest: "${userPosts[0].title || userPosts[0].text}"`);
    }
  });

  console.log('\n✅ Profile filtering test complete!');
  console.log('\n💡 If posts still not showing on profile:');
  console.log('   1. Check browser console for errors');
  console.log('   2. Verify you are logged in');
  console.log('   3. Clear browser cache and reload');
  console.log('   4. Check network tab for /api/posts response');
}

testProfilePosts();
