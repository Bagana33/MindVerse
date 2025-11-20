// Check specific user's posts
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkUserPosts() {
  // Check multiple users
  const emails = [
    'ejk.kej08@gmail.com', // Bumanjargal T from screenshot
    'amina0924dnd@gmail.com',
    'aykozbaurjan@gmail.com', // Has multiple posts
  ];
  
  for (const targetEmail of emails) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Checking posts for: ${targetEmail}\n`);

  // Check if user exists
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', targetEmail)
    .single();

  if (userError || !user) {
    console.log('❌ User not found in database!');
    console.log('Error:', userError?.message);
    return;
  }

  console.log('✅ User found:');
  console.log(`   Name: ${user.name}`);
  console.log(`   Nickname: ${user.nickname}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Grade: ${user.grade}`);
  console.log('');

  // Check posts
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, description, author_email, created_at')
    .eq('author_email', targetEmail)
    .order('created_at', { ascending: false });

  if (postsError) {
    console.log('❌ Error fetching posts:', postsError.message);
    return;
  }

  console.log(`📊 Posts count: ${posts?.length || 0}\n`);

  if (posts && posts.length > 0) {
    posts.forEach((post, idx) => {
      console.log(`${idx + 1}. "${post.title}"`);
      console.log(`   ID: ${post.id}`);
      console.log(`   Created: ${new Date(post.created_at).toLocaleString()}`);
      console.log('');
    });
  } else {
    console.log('ℹ️  This user has no posts yet.');
    console.log('');
    console.log('💡 Possible reasons:');
    console.log('   1. User exists but never posted');
    console.log('   2. Email address mismatch (check for typos)');
      console.log('   3. Posts were deleted');
  }
  } // End of for loop
}

checkUserPosts();