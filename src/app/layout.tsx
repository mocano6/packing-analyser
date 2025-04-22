// src/app/layout.tsx
'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { registerFirestoreErrorHandlers } from '@/utils/firestoreErrorHandler';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
// Usuwam niepotrzebny import
// import { initializeOfflineSupport } from '@/lib/api';

// Dynamicznie importujemy AuthGuard, aby uniknąć problemów z hydracją
const AuthGuard = dynamic(() => import('@/components/AuthGuard/AuthGuard'), {
  ssr: false
});

// Ścieżki, które nie wymagają uwierzytelnienia
const publicPaths = ['/login'];

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));
  
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
    <html lang="pl" suppressHydrationWarning={true}>
      <head>
        {/* Dodajemy skrypt do obsługi przekierowań na GitHub Pages */}
        <Script id="gh-pages-redirect" strategy="beforeInteractive">
          {`
            (function() {
              var redirect = sessionStorage.redirect;
              delete sessionStorage.redirect;
              
              if (redirect && redirect !== location.href) {
                history.replaceState(null, null, redirect);
              }
              
              var p = new URLSearchParams(window.location.search).get('p');
              var q = new URLSearchParams(window.location.search).get('q');
              
              if (p) {
                var newUrl = p.replace(/~and~/g, '&');
                if (q) {
                  newUrl += '?' + q.replace(/~and~/g, '&');
                }
                window.history.replaceState(null, null, newUrl);
              }
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning={true}>
        {isPublicPath ? (
          // Strony publiczne nie wymagają uwierzytelnienia
          children
        ) : (
          // Strony prywatne chronione przez AuthGuard
          <AuthGuard>{children}</AuthGuard>
        )}
      </body>
    </html>
  );
}
