// src/app/layout.tsx
'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { registerFirestoreErrorHandlers } from '@/utils/firestoreErrorHandler';
// Usuwam niepotrzebny import
// import { initializeOfflineSupport } from '@/lib/api';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // Wsparcie dla Firebase jest zainicjalizowane w pliku @/lib/firebase.ts
  // i nie wymaga dodatkowej inicjalizacji tutaj
  
  // Zarejestruj obsługę błędów Firestore po stronie klienta
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Rejestruj obserwatory błędów Firestore
      registerFirestoreErrorHandlers(db);
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
