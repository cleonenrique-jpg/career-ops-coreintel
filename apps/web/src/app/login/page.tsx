'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const REASON_MESSAGES: Record<string, { tone: 'warning' | 'danger'; text: string }> = {
  pending: {
    tone: 'warning',
    text: 'Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas acceder.',
  },
  suspended: {
    tone: 'danger',
    text: 'Tu cuenta fue suspendida. Contactá a un administrador para más información.',
  },
  auth_error: {
    tone: 'danger',
    text: 'El enlace de acceso expiró o ya fue usado. Pedí uno nuevo abajo.',
  },
};

function ReasonBanner() {
  const params = useSearchParams();
  const reason = params.get('reason');
  if (!reason || !REASON_MESSAGES[reason]) return null;
  const { tone, text } = REASON_MESSAGES[reason];
  const styles =
    tone === 'danger'
      ? 'bg-red-50 border-red-300 text-red-700'
      : 'bg-amarillo/15 border-amarillo text-[#7a5d00]';
  return (
    <div className={`mb-4 rounded border px-3 py-2 text-sm ${styles}`}>{text}</div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function sendMagicLink() {
    // Lazy-init the supabase client so this page doesn't fail to pre-render
    // when env vars aren't present at build time (Railway injects them at runtime).
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) alert(error.message);
    else setSent(true);
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-intel-700 mb-2">Iniciar sesión</h1>
        <p className="text-text-muted mb-4">Ingresá con magic link.</p>
        <ReasonBanner />
        {sent ? (
          <p className="text-core-700">Revisá tu email para el enlace de acceso.</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 rounded-[14px] border border-hairline px-3 py-2 text-sm"
            />
            <Button onClick={sendMagicLink} disabled={!email}>Enviar</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
