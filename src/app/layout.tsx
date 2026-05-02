// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import AuthGuard from '@/components/AuthGuard/AuthGuard';
import ConsoleSilencer from '@/components/ConsoleSilencer/ConsoleSilencer';
import FirestoreMetricsBadge from '@/components/FirestoreMetricsBadge/FirestoreMetricsBadge';
import { PresentationProvider } from '@/contexts/PresentationContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LOOKBALL',
  description: 'Profesjonalna aplikacja do analizy podań i pressingów w piłce nożnej. Śledź metryki packingu, wartości xT i statystyki zespołowe.',
  keywords: ['piłka nożna', 'analiza', 'packing', 'xT', 'pressing', 'statystyki', 'football', 'soccer'],
  authors: [{ name: 'LOOKBALL' }],
  creator: 'LOOKBALL',
  publisher: 'LOOKBALL',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://lookball.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'LOOKBALL',
    description: 'Profesjonalna aplikacja do analizy podań i pressingów w piłce nożnej',
    url: 'https://lookball.app',
    siteName: 'LOOKBALL',
    locale: 'pl_PL',
    type: 'website',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'LOOKBALL' }],
  },
  twitter: {
    card: 'summary',
    title: 'LOOKBALL',
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
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/logo.png', type: 'image/png' }],
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
        <meta name="apple-mobile-web-app-title" content="LOOKBALL" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#22c55e" />
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ConsoleSilencer />
        <PresentationProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </PresentationProvider>
        <FirestoreMetricsBadge />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
