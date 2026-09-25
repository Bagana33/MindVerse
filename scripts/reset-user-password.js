// Script to reset a user's password directly in the database
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or Key not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword(email, newPassword) {
  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-user-password.js <email> <new_password>');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user exists
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('email, name, role')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (findError) {
    console.error('❌ DB Error:', findError.message);
    process.exit(1);
  }

  if (!user) {
    console.error(`❌ Хэрэглэгч олдсонгүй: ${normalizedEmail}`);
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('❌ Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой');
    process.exit(1);
  }

  // 2. Hash and update password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('email', user.email);

  if (updateError) {
    console.error('❌ Нууц үг шинэчлэхэд алдаа гарлаа:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ Амжилттай! ${user.email} (${user.name || user.role})-ийн нууц үг шинэчлэгдлээ.`);
  console.log(`Шинэ нууц үг: ${newPassword}`);
}

const [, , email, password] = process.argv;
resetPassword(email, password);
