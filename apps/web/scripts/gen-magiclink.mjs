import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || 'carlos.leon@coreintelhub.com';
const redirectTo = process.argv[3] || 'http://localhost:3000/auth/callback';

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo },
});

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('\nPegá este link en el browser:\n');
console.log(data.properties?.action_link);
console.log('');
