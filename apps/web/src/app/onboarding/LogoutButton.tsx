'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/Button';

export function LogoutButton() {
  async function logout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
  return (
    <Button variant="ghost" onClick={logout}>
      Cerrar sesión
    </Button>
  );
}
