import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');

export const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const BUCKET = process.env.STORAGE_BUCKET ?? 'career-ops';

export async function uploadPdf(userId: string, filename: string, body: Buffer): Promise<string> {
  const path = `${userId}/pdfs/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
