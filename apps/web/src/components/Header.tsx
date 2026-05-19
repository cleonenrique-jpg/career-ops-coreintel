'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/applications', label: 'Applications' },
  { href: '/cv', label: 'CV' },
  { href: '/profile', label: 'Profile' },
  { href: '/portals', label: 'Portals' },
  { href: '/scan', label: 'Scan' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--color-border)] bg-white sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image src="/brand/logo-principal.png" alt="Coreintelhub" width={140} height={32} priority />
          <span className="hidden md:inline-block text-intel-700 font-semibold">/ career-ops</span>
        </Link>

        <nav className="hidden md:flex gap-1">
          {navItems.map((it) => {
            const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  active
                    ? 'bg-intel text-white font-semibold'
                    : 'text-intel-700 hover:bg-intel-50'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <button
          aria-label="Menu"
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded text-intel-700 hover:bg-intel-50"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open
              ? <path d="M6 6l12 12M6 18L18 6" />
              : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[var(--color-border)] bg-white">
          {navItems.map((it) => {
            const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`block px-6 py-3 text-sm border-b border-gris-100 ${
                  active ? 'bg-intel-50 text-intel-700 font-semibold' : 'text-intel-700'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
