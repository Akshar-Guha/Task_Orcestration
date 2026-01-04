import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout';
import { AppInitializer } from '@/components/AppInitializer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GoalTracker - Personal Goal Management',
  description: 'Track your goals, build habits, and achieve your dreams',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GoalTracker',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <AppInitializer />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
