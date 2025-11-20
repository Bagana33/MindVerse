require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testNicknames() {
  console.log('============================================================');
  console.log('👤 Testing Nicknames\n');

  // Get user with email bayrsaihanodko@gmail.com
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'bayrsaihanodko@gmail.com')
    .single();

  if (user) {
    console.log('User found:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Nickname: ${user.nickname || '(not set)'}`);
    console.log('');

    // Update nickname if not set
    if (!user.nickname) {
      console.log('Setting nickname to "B"...');
      const { error } = await supabase
        .from('users')
        .update({ nickname: 'B' })
        .eq('email', 'bayrsaihanodko@gmail.com');

      if (error) {
        console.error('Error:', error);
      } else {
        console.log('✅ Nickname updated!');
      }
    }
  } else {
    console.log('User not found');
  }

  console.log('\n============================================================');
}

testNicknames().catch(console.error).finally(() => process.exit(0));
