import Image from 'next/image';
import Link from 'next/link';

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
  return (
    <header className="border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo-principal.png" alt="Coreintelhub" width={140} height={32} priority />
          <span className="hidden md:inline-block text-intel-700 font-semibold">/ career-ops</span>
        </Link>
        <nav className="flex gap-1">
          {navItems.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="px-3 py-1.5 rounded text-sm text-intel-700 hover:bg-intel-50 transition"
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
