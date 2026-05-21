'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function handle() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const code = params.get('code');
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const next = params.get('next') ?? '/';

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace('/login?reason=auth_error');
          return;
        }
        router.replace(next);
        return;
      }

      if (hash && hash.includes('access_token')) {
        const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            router.replace('/login?reason=auth_error');
            return;
          }
          // Replace hash to avoid leaking tokens in history.
          window.history.replaceState(null, '', window.location.pathname);
          router.replace(next);
          return;
        }
      }

      router.replace('/login?reason=auth_error');
    }

    handle();
  }, [params, router]);

  return (
    <div className="text-center mt-12 text-text-muted">
      Verificando sesión…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackHandler />
    </Suspense>
  );
}
