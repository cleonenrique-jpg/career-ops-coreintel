import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!email) {
  console.error('Usage: node test-create-user.mjs <email>');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
});

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('User created:', data.user.id, data.user.email);
