'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

interface Props {
  email: string | null;
  role?: 'admin' | 'member' | null;
}

export function UserMenu({ email, role = null }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function logout() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const initial = (email ?? 'C').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-intel-50"
      >
        <span className="w-7 h-7 rounded-full bg-core text-white flex items-center justify-center text-sm font-semibold">
          {initial}
        </span>
        <span className="hidden md:inline text-sm text-intel-700">{email ? email.split('@')[0] : 'Cuenta'}</span>
        <span className="text-xs text-gris-500">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-hairline rounded-2xl shadow-lg min-w-[240px] py-1.5 z-50">
          {email && (
            <div className="px-3 py-2 border-b border-hairline text-xs text-gris-500">
              <div className="truncate text-intel-700 font-semibold">{email}</div>
              {role && <div className="capitalize">{role}</div>}
            </div>
          )}
          <Link
            href="/profile?tab=info"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-intel-700 hover:bg-intel-50"
          >
            Mi perfil
          </Link>
          {role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-intel-700 hover:bg-intel-50"
            >
              Administración
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
}
