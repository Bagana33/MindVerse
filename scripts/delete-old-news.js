// Delete old news posts (older than 24 hours)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function deleteOldNews() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log('Deleting news posts older than:', twentyFourHoursAgo);
  
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('author_email', 'news-bot')
    .lt('created_at', twentyFourHoursAgo)
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Deleted ${data?.length || 0} old news posts`);
  }
}

deleteOldNews();
