'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const REASON_MESSAGES: Record<string, { tone: 'warning' | 'danger'; text: string }> = {
  pending: { tone: 'warning', text: 'Tu cuenta está pendiente de aprobación.' },
  suspended: { tone: 'danger', text: 'Tu cuenta fue suspendida. Contactá a un administrador.' },
  auth_error: { tone: 'danger', text: 'El acceso anterior expiró. Probá de nuevo.' },
};

function ReasonBanner() {
  const params = useSearchParams();
  const reason = params.get('reason');
  if (!reason || !REASON_MESSAGES[reason]) return null;
  const { tone, text } = REASON_MESSAGES[reason];
  const styles = tone === 'danger' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amarillo/15 border-amarillo text-[#7a5d00]';
  return <div className={`mb-4 rounded border px-3 py-2 text-sm ${styles}`}>{text}</div>;
}

type Mode = 'signin' | 'signup' | 'forgot';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function sb() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  async function submit() {
    setError(null); setInfo(null);
    if (!email) { setError('Ingresá tu email.'); return; }

    if (mode === 'forgot') {
      setBusy(true);
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/reset` : undefined;
      const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo });
      setBusy(false);
      if (error) setError(error.message);
      else setInfo('Si la cuenta existe, te enviamos un link para restablecer tu contraseña.');
      return;
    }

    if (!password) { setError('Ingresá tu contraseña.'); return; }
    if (mode === 'signup' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }

    setBusy(true);
    if (mode === 'signin') {
      const { error } = await sb().auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setError('Email o contraseña incorrectos.');
      else window.location.href = next;
    } else {
      const { data, error } = await sb().auth.signUp({ email, password });
      setBusy(false);
      if (error) setError(error.message);
      else if (data.session) window.location.href = next; // "Confirm email" OFF → entra directo
      else setInfo('Cuenta creada. Revisá tu email para confirmarla y luego iniciá sesión.');
    }
  }

  const inputCls = 'w-full rounded-[14px] border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-core';

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-negro mb-1">
          {mode === 'signin' ? 'Iniciá sesión' : mode === 'signup' ? 'Creá tu cuenta' : 'Restablecer contraseña'}
        </h1>
        <p className="text-text-muted mb-4 text-sm">
          {mode === 'signin' && 'Ingresá con tu email y contraseña.'}
          {mode === 'signup' && 'Creá tu cuenta y te guiamos para configurar tu búsqueda.'}
          {mode === 'forgot' && 'Te enviamos un link para que elijas una contraseña nueva.'}
        </p>

        <ReasonBanner />
        {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {info && <div className="mb-4 rounded border border-[#cfe8d4] bg-[#EDF3EC] px-3 py-2 text-sm text-[#346538]">{info}</div>}

        <div className="space-y-3">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="tu@email.com" className={inputCls} autoFocus
          />
          {mode !== 'forgot' && (
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={mode === 'signup' ? 'Elegí una contraseña (mín. 6)' : 'Tu contraseña'}
              className={inputCls}
            />
          )}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? 'Procesando…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar link'}
          </Button>
        </div>

        <div className="mt-4 text-sm text-gris-500 space-y-1.5">
          {mode === 'signin' && (
            <>
              <p>¿No tenés cuenta?{' '}
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-core-500 font-semibold hover:underline">Creá una</button>
              </p>
              <p>
                <button onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="text-gris-500 hover:text-intel-700 hover:underline">¿Olvidaste tu contraseña?</button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p>¿Ya tenés cuenta?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-core-500 font-semibold hover:underline">Iniciá sesión</button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-core-500 font-semibold hover:underline">← Volver a iniciar sesión</button>
            </p>
          )}
        </div>

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
