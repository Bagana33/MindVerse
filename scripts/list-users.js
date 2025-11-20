// List all users with posts
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listUsers() {
  console.log('👥 Listing all users...\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('email, name, nickname, role, grade')
    .order('email');

  if (error || !users) {
    console.log('❌ Error:', error?.message);
    return;
  }

  console.log(`Found ${users.length} users:\n`);

  // Check posts for each user
  for (const user of users.slice(0, 20)) { // First 20
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('author_email', user.email);

    const postCount = posts?.length || 0;
    const icon = postCount > 0 ? '📝' : '⭕';
    
    console.log(`${icon} ${user.email}`);
    console.log(`   Name: ${user.nickname || user.name || '(none)'}`);
    console.log(`   Role: ${user.role}${user.grade ? ` | Grade: ${user.grade}` : ''}`);
    console.log(`   Posts: ${postCount}`);
    console.log('');
  }

  if (users.length > 20) {
    console.log(`... and ${users.length - 20} more users`);
  }
}

listUsers();
