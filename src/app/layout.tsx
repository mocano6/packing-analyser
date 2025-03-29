// src/app/layout.tsx
'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { initializeOfflineSupport } from '@/lib/api';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // Inicjalizacja wsparcia dla trybu offline
  useEffect(() => {
    initializeOfflineSupport();
  }, []);
  
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
