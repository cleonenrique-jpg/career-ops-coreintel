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
    text: 'El acceso anterior expiró. Pedí un código nuevo abajo.',
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
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function sb() {
    // Lazy-init: evita fallar el pre-render si las env no están en build time.
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  async function sendCode() {
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error } = await sb().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // El enlace queda como respaldo; el flujo principal es el código.
        emailRedirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else { setStep('code'); setCode(''); }
  }

  async function verify() {
    if (code.replace(/\D/g, '').length < 6) return;
    setBusy(true);
    setError(null);
    const { error } = await sb().auth.verifyOtp({ email, token: code.replace(/\D/g, ''), type: 'email' });
    setBusy(false);
    if (error) setError('Código incorrecto o vencido. Pedí uno nuevo.');
    else window.location.href = next;
  }

  const inputCls = 'flex-1 rounded-[14px] border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-core';

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-negro mb-2">Entrá o creá tu cuenta</h1>

        {step === 'email' ? (
          <>
            <p className="text-text-muted mb-4">
              Ingresá tu email y te enviamos un <strong>código de 6 dígitos</strong>. Si es tu
              primera vez, tu cuenta se crea automáticamente y te guiamos para configurar tu búsqueda.
            </p>
            <ReasonBanner />
            {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && email) sendCode(); }}
                placeholder="tu@email.com"
                className={inputCls}
                autoFocus
              />
              <Button onClick={sendCode} disabled={!email || busy}>{busy ? 'Enviando…' : 'Continuar'}</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-text-muted mb-4">
              Te enviamos un <strong>código de 6 dígitos</strong> a <strong className="text-negro">{email}</strong>.
              Ingresalo acá (revisá spam si no llega):
            </p>
            {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
                placeholder="123456"
                className={`${inputCls} tracking-[0.4em] font-mono text-center text-lg`}
                autoFocus
              />
              <Button onClick={verify} disabled={code.replace(/\D/g, '').length < 6 || busy}>{busy ? 'Verificando…' : 'Entrar'}</Button>
            </div>
            <div className="flex items-center justify-between mt-3 text-xs">
              <button onClick={() => { setStep('email'); setError(null); }} className="text-gris-500 hover:text-intel-700">← Cambiar email</button>
              <button onClick={sendCode} disabled={busy} className="text-core-500 font-semibold hover:underline disabled:opacity-50">Reenviar código</button>
            </div>
          </>
        )}

        <p className="text-xs text-gris-500 mt-5 pt-4 border-t border-hairline">
          career-ops por{' '}
          <a href="https://coreintelhub.com" className="text-core-500 font-semibold hover:underline">Coreintelhub</a>
          {' '}— tu agente de IA para la búsqueda de empleo.
        </p>
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
