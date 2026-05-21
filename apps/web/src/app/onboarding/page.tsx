import { redirect } from 'next/navigation';
import { Card } from '@/components/Card';
import { serverSupabase } from '@/lib/supabase-server';
import { LogoutButton } from './LogoutButton';

const ADMIN_CONTACT_EMAIL = 'carlos.leon@coreintelhub.com';

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
    <div className="max-w-lg mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-intel-700 mb-3">Cuenta pendiente de aprobación</h1>
        <p className="text-text-muted mb-4">
          Hola <span className="font-semibold text-intel-700">{user.email}</span>, tu cuenta fue creada
          correctamente pero aún no está activa. Un administrador necesita aprobarla antes de que puedas
          acceder al pipeline.
        </p>
        <p className="text-text-muted mb-6">
          Para acelerar el proceso, escribinos a{' '}
          <a href={`mailto:${ADMIN_CONTACT_EMAIL}`} className="text-core-700 font-semibold underline">
            {ADMIN_CONTACT_EMAIL}
          </a>{' '}
          con tu nombre y motivo del acceso.
        </p>
        <LogoutButton />
      </Card>
    </div>
  );
}
