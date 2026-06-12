import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { Header } from '@/components/Header';
import { BrandBar } from '@/components/BrandBar';
import { FeedbackLauncher } from '@/components/FeedbackLauncher';
import { UsageTracker } from '@/components/UsageTracker';
import { serverSupabase } from '@/lib/supabase-server';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let role: 'admin' | 'member' | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    role = (profile?.role as 'admin' | 'member' | undefined) ?? null;
  }

  return (
    <html lang="es" className={montserrat.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,0..1,-50..200"
        />
      </head>
      <body className="font-sans bg-[var(--color-bg-subtle)] min-h-screen">
        <BrandBar />
        <Header email={user?.email ?? null} role={role} />
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        {user && <FeedbackLauncher />}
        {user && <UsageTracker />}
      </body>
    </html>
  );
}
