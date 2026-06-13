import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase-server';
import { LogoutButton } from './LogoutButton';
import { OnboardingWizard } from './OnboardingWizard';

export default async function OnboardingPage() {
  const supabase = serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('status, email')
    .eq('user_id', user.id)
    .single();

  if (profile?.status === 'active') redirect('/');
  if (profile?.status === 'suspended') redirect('/login?reason=suspended');

  return (
    <div className="pb-16">
      <OnboardingWizard email={user.email ?? ''} />
      <div className="max-w-2xl mx-auto mt-8 text-center">
        <LogoutButton />
      </div>
    </div>
  );
}
