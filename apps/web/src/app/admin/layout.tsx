import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase-server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  return <>{children}</>;
}
