// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import AuthGuard from '@/components/AuthGuard/AuthGuard';
import ConsoleSilencer from '@/components/ConsoleSilencer/ConsoleSilencer';
import FirestoreMetricsBadge from '@/components/FirestoreMetricsBadge/FirestoreMetricsBadge';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Packing Analyzer',
  description: 'Profesjonalna aplikacja do analizy podań i pressingów w piłce nożnej. Śledź metryki packingu, wartości xT i statystyki zespołowe.',
  keywords: ['piłka nożna', 'analiza', 'packing', 'xT', 'pressing', 'statystyki', 'football', 'soccer'],
  authors: [{ name: 'Packing Analyzer Team' }],
  creator: 'Packing Analyzer',
  publisher: 'Packing Analyzer',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://packing-analyzer.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Packing Analyzer',
    description: 'Profesjonalna aplikacja do analizy podań i pressingów w piłce nożnej',
    url: 'https://packing-analyzer.vercel.app',
    siteName: 'Packing Analyzer',
    locale: 'pl_PL',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Packing Analyzer',
    description: 'Profesjonalna aplikacja do analizy podań i pressingów w piłce nożnej',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/next.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning={true}>
      <head>
        <meta name="theme-color" content="#22c55e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Packing Analyzer" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#22c55e" />
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ConsoleSilencer />
        <AuthGuard>
          {children}
        </AuthGuard>
        <FirestoreMetricsBadge />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
