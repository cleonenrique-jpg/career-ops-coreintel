import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { Header } from '@/components/Header';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'career-ops — Coreintelhub',
  description: 'AI job search command center.',
  icons: { icon: '/brand/logo-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body className="font-sans bg-[var(--color-bg-subtle)] min-h-screen">
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
