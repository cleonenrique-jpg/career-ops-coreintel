'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb().auth.getSession();
      if (!data.session) { window.location.href = '/login'; return; }
      setReady(true);
    })();
  }, []);

  async function save() {
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setBusy(true); setError(null);
    const { error } = await sb().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else { setDone(true); setTimeout(() => { window.location.href = '/'; }, 1300); }
  }

  if (!ready) return <div className="text-center mt-12 text-text-muted">Cargando…</div>;

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-negro mb-1">Nueva contraseña</h1>
        {done ? (
          <p className="text-[#346538] text-sm mt-3">¡Contraseña actualizada! Redirigiéndote…</p>
        ) : (
          <>
            <p className="text-text-muted mb-4 text-sm">Elegí una contraseña nueva para tu cuenta.</p>
            {error && <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="space-y-3">
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                placeholder="Nueva contraseña (mín. 6)"
                className="w-full rounded-[14px] border border-hairline px-3 py-2 text-sm focus:outline-none focus:border-core"
                autoFocus
              />
              <Button onClick={save} disabled={busy} className="w-full">{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
