// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { metadata } from './layout-metadata';
import type { Metadata } from 'next';
import AuthGuard from '@/components/AuthGuard/AuthGuard';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Packing Analyzer',
  description: 'Aplikacja do analizy pressingów',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning={true}>
      <body className={inter.className} suppressHydrationWarning={true}>
        <AuthGuard>
          {children}
        </AuthGuard>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
