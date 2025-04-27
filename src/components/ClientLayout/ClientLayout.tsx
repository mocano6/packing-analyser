'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Importuj AuthGuard dynamicznie z wyłączonym SSR
const AuthGuard = dynamic(() => import('@/components/AuthGuard/AuthGuard'), {
  ssr: false,
});

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  // W wersji produkcyjnej zawsze traktujemy użytkownika jako zalogowanego
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Strony, które nie wymagają uwierzytelnienia
  const publicPages = ['/login', '/auth'];
  const isPublicPage = publicPages.includes(pathname || '');

  // Prosta inicjalizacja dla wersji produkcyjnej
  useEffect(() => {
    // Aktywacja trybu deweloperskiego
    localStorage.setItem('packing_app_bypass_auth', 'true');
    
    // Symulujemy krótkie opóźnienie, aby dać czas na inicjalizację
    const timeout = setTimeout(() => {
      setIsInitialized(true);
    }, 100);
    
    return () => clearTimeout(timeout);
  }, []);

  // Pokaż indykator ładowania podczas inicjalizacji
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // W wersji produkcyjnej zawsze renderujemy zawartość, bez względu na stan uwierzytelniania
  return <>{children}</>;
} 