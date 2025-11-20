require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testGradeFilter() {
  console.log('============================================================');
  console.log('📊 Testing Grade Filter\n');

  // Get all users with their grades
  const { data: users } = await supabase
    .from('users')
    .select('email, name, grade')
    .order('grade', { ascending: true });

  console.log(`Total users: ${users?.length || 0}\n`);

  const gradeGroups = {};
  users?.forEach(u => {
    const grade = u.grade || 'unknown';
    if (!gradeGroups[grade]) gradeGroups[grade] = [];
    gradeGroups[grade].push(u);
  });

  console.log('Users by grade:');
  Object.keys(gradeGroups).sort().forEach(g => {
    console.log(`  ${g}: ${gradeGroups[g].length} users`);
    gradeGroups[g].slice(0, 3).forEach(u => {
      console.log(`    - ${u.name || u.email}`);
    });
    if (gradeGroups[g].length > 3) {
      console.log(`    ... and ${gradeGroups[g].length - 3} more`);
    }
  });

  // Get all posts
  const { data: allPosts } = await supabase
    .from('posts')
    .select('id, author_email, title')
    .order('created_at', { ascending: false });

  console.log(`\n📝 Total posts: ${allPosts?.length || 0}\n`);

  // Count posts by user grade
  const postsByGrade = {};
  for (const post of allPosts || []) {
    const user = users?.find(u => u.email === post.author_email);
    const grade = user?.grade || 'unknown';
    if (!postsByGrade[grade]) postsByGrade[grade] = [];
    postsByGrade[grade].push(post);
  }

  console.log('Posts by grade:');
  Object.keys(postsByGrade).sort().forEach(g => {
    console.log(`  ${g}: ${postsByGrade[g].length} posts`);
    postsByGrade[g].slice(0, 2).forEach(p => {
      console.log(`    - "${p.title}"`);
    });
    if (postsByGrade[g].length > 2) {
      console.log(`    ... and ${postsByGrade[g].length - 2} more`);
    }
  });

  console.log('\n✅ Grade filter test complete!');
  console.log('============================================================');
}

testGradeFilter().catch(console.error).finally(() => process.exit(0));
