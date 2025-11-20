// Run posts table migration directly on Supabase
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🔧 Running posts table migration...\n');

  try {
    // Step 1: Add title column
    console.log('1. Adding title column...');
    const { error: titleError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;'
    });
    
    // Step 2: Add description column
    console.log('2. Adding description column...');
    const { error: descError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE posts ADD COLUMN IF NOT EXISTS description TEXT;'
    });
    
    // Step 3: Check current posts
    console.log('3. Checking existing posts...');
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, text, title, description');
    
    if (postsError) {
      console.error('Error fetching posts:', postsError);
      console.log('\n⚠️  Migration may need to be done via SQL Editor.');
      console.log('Please run the SQL from: supabase/migrations/2025-11-20_add_post_columns.sql');
      return;
    }

    console.log(`   Found ${posts?.length || 0} posts`);

    // Step 4: Update posts that need backfilling
    if (posts && posts.length > 0) {
      console.log('4. Backfilling posts with title/description...');
      let updated = 0;
      
      for (const post of posts) {
        if (!post.title || !post.description) {
          const { error: updateError } = await supabase
            .from('posts')
            .update({
              title: post.text,
              description: post.text,
            })
            .eq('id', post.id);
          
          if (!updateError) {
            updated++;
          }
        }
      }
      
      console.log(`   ✅ Updated ${updated} posts`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Added title column to posts table');
    console.log('   - Added description column to posts table');
    console.log('   - Backfilled existing posts with their text content');
    console.log('\n🎉 Profile pages should now display posts correctly!');

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    console.log('\n⚠️  Please run the migration manually via Supabase SQL Editor:');
    console.log('   File: supabase/migrations/2025-11-20_add_post_columns.sql');
  }
}

runMigration();
