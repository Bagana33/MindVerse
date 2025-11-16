// Create AI assistant user
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createAIUser() {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'ai-assistant')
    .single();

  if (!existingUser) {
    console.log('Creating AI assistant user...');
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        email: 'ai-assistant',
        name: '🤖 AI Шүүмжлэгч',
        role: 'teacher',
        experience: 0,
      }]);

    if (userError) {
      console.error('Error creating user:', userError);
    } else {
      console.log('AI assistant user created successfully!');
    }
  } else {
    console.log('AI assistant user already exists');
  }
}

createAIUser();
