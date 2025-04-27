'use client';

import React, { useState, useEffect } from 'react';
import styles from './OfflineStatus.module.css';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db, forceOfflineMode, enableOnlineMode } from '@/lib/firebase';
import { resetFirestoreConnection } from '@/utils/firestoreErrorHandler';
import { testFirebaseConnection, testAllCollections } from '@/utils/testFirebaseConnection';
import { toast } from 'react-hot-toast';

interface OfflineStatusProps {
  className?: string;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isPersistenceEnabled, setIsPersistenceEnabled] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isOfflineForced, setIsOfflineForced] = useState<boolean>(false);

  // Sprawdzenie czy komponenty renderują się po stronie SSR
  const isServer = typeof window === 'undefined';
  
  // Sprawdzamy stan połączenia i ustawienie offline mode przy montowaniu komponentu
  useEffect(() => {
    // Nie wykonuj tego kodu na serwerze
    if (isServer) return;
    
    let isMounted = true;
    
    // Sprawdź, czy tryb offline jest już wymuszony
    if (typeof window !== 'undefined') {
      const offlineMode = localStorage.getItem('firestore_offline_mode') === 'true';
      setIsOfflineForced(offlineMode);
      if (offlineMode) {
        setIsPersistenceEnabled(false);
      }
    }
    
    // Dajemy czas na inicjalizację Firebase
    const initTimer = setTimeout(() => {
      if (!isMounted) return;
      
      // Inicjalizacja stanu na podstawie aktualnego statusu połączenia
      setIsOnline(navigator.onLine);
      console.log('Status połączenia:', navigator.onLine ? 'online' : 'offline');
      
      setInitialCheckDone(true);
    }, 1000);
    
    // Nasłuchiwanie zmian stanu połączenia
    const handleOnline = () => {
      console.log('Aplikacja przeszła w tryb online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Aplikacja przeszła w tryb offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isServer]);

  // Funkcja testująca połączenie z Firestore
  const handleTestConnection = async () => {
    if (isServer) return;
    
    setIsTesting(true);
    toast.loading('Testowanie połączenia z bazą danych...');

    try {
      // Testowanie połączenia
      const connectionResult = await testFirebaseConnection();
      
      if (connectionResult) {
        toast.success('Test połączenia z bazą danych zakończony pomyślnie!');
        
        // Testowanie dostępu do kolekcji
        const collectionsResults = await testAllCollections();
        
        // Sprawdzamy, czy wszystkie kolekcje mają dostęp
        const allAccessible = Object.values(collectionsResults).every(result => result);
        
        if (allAccessible) {
          toast.success('Masz dostęp do wszystkich kolekcji!');
        } else {
          // Filtrujemy kolekcje bez dostępu
          const noAccessCollections = Object.entries(collectionsResults)
            .filter(([_, hasAccess]) => !hasAccess)
            .map(([collection]) => collection);
            
          toast.error(`Brak dostępu do kolekcji: ${noAccessCollections.join(', ')}`);
        }
      } else {
        toast.error('Test połączenia z bazą danych nie powiódł się');
      }
    } catch (error) {
      toast.error(`Błąd podczas testowania: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
      console.error('Błąd podczas testowania połączenia:', error);
    } finally {
      setIsTesting(false);
    }
  };

  // Funkcja wymuszająca tryb offline
  const handleForceOffline = async () => {
    if (isServer) return;
    
    try {
      const success = await forceOfflineMode();
      if (success) {
        setIsOfflineForced(true);
        setIsPersistenceEnabled(false);
        toast.success('Wymuszono tryb offline. Odśwież stronę, aby zastosować zmiany.');
        // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
      } else {
        toast.error('Nie udało się wymusić trybu offline.');
      }
    } catch (error) {
      console.error('Błąd przy wymuszaniu trybu offline:', error);
      toast.error('Wystąpił błąd przy wymuszaniu trybu offline.');
    }
  };

  // Funkcja przywracająca tryb online
  const handleEnableOnline = async () => {
    if (isServer) return;
    
    try {
      const success = await enableOnlineMode();
      if (success) {
        setIsOfflineForced(false);
        setIsPersistenceEnabled(true);
        toast.success('Przywrócono tryb online. Odśwież stronę, aby zastosować zmiany.');
        // Usuń informację o trybie offline z localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem('firestore_offline_mode');
        }
      } else {
        toast.error('Nie udało się przywrócić trybu online.');
      }
    } catch (error) {
      console.error('Błąd przy przywracaniu trybu online:', error);
      toast.error('Wystąpił błąd przy przywracaniu trybu online.');
    }
  };

  // Obsługa odświeżania strony
  const handleReload = () => {
    if (isServer) return;
    window.location.reload();
  };

  // Na serwerze nie renderujemy nic
  if (isServer) return null;

  // Sprawdzenie czy powinniśmy wyświetlić komponent
  // Zawsze pokazujemy komponent jeśli tryb offline jest wymuszony
  const shouldShow = initialCheckDone && (isOfflineForced || (!isOnline) || (!isPersistenceEnabled) || errorMessage);
  
  if (!shouldShow) return null;

  return (
    <div className={`${styles.offlineStatus} ${className || ''} ${errorMessage ? styles.hasError : ''}`}>
      {isOfflineForced && (
        <div className={styles.forcedOfflineIndicator}>
          <span className={styles.icon}>📴</span>
          <span>Tryb offline wymuszony. Dane są przechowywane lokalnie.</span>
        </div>
      )}
      
      {!isOnline && (
        <div className={styles.offlineIndicator}>
          <span className={styles.icon}>⚠️</span>
          <span>Brak połączenia z internetem. Tryb offline aktywny.</span>
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>
            <span className={styles.icon}>⚠️</span> 
            {errorMessage}
          </p>
        </div>
      )}

      <div className={styles.statusContainer}>
        <div 
          className={`${styles.statusIndicator} ${isOfflineForced ? styles.forcedOffline : isOnline ? styles.online : styles.offline}`} 
          title={isOfflineForced ? 'Tryb offline wymuszony' : isOnline ? 'Połączono z internetem' : 'Brak połączenia z internetem'}
        />
        <span className={styles.statusText}>
          {isOfflineForced ? 'Offline (wymuszony)' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      
      <div className={styles.actions}>
        <button 
          className={styles.testButton} 
          onClick={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? 'Testowanie...' : 'Test połączenia'}
        </button>
        
        <button 
          className={styles.reloadButton}
          onClick={handleReload}
        >
          Odśwież stronę
        </button>
        
        {isOfflineForced ? (
          <button 
            className={styles.onlineButton} 
            onClick={handleEnableOnline}
          >
            Przywróć online
          </button>
        ) : (
          <button 
            className={styles.offlineButton} 
            onClick={handleForceOffline}
          >
            Wymuś offline
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineStatus; 