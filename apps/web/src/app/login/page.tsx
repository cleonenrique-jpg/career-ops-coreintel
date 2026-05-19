'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

export default function LoginPage() {
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
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) alert(error.message);
    else setSent(true);
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <h1 className="text-h2 text-intel-700 mb-2">Iniciar sesión</h1>
        <p className="text-text-muted mb-4">Ingresá con magic link.</p>
        {sent ? (
          <p className="text-core-700">Revisá tu email para el enlace de acceso.</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 rounded border border-gris-300 px-3 py-1.5 text-sm"
            />
            <Button onClick={sendMagicLink} disabled={!email}>Enviar</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
