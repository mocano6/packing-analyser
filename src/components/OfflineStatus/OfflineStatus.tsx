'use client';

import React, { useState, useEffect } from 'react';
import styles from './OfflineStatus.module.css';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { resetFirestoreConnection } from '@/utils/firestoreErrorHandler';

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

  useEffect(() => {
    // Dajemy czas na inicjalizację Firebase z lib/firebase.ts
    const initTimer = setTimeout(() => {
      // Inicjalizacja stanu na podstawie aktualnego statusu połączenia
      setIsOnline(navigator.onLine);
      console.log('Status połączenia:', navigator.onLine ? 'online' : 'offline');
      
      // Inicjalne sprawdzenie dostępności Firebase
      if (navigator.onLine) {
        checkFirebaseConnection();
      }
      
      setInitialCheckDone(true);
    }, 3000); // Dajemy 3 sekundy na inicjalizację Firebase
    
    // Nasłuchiwanie zmian stanu połączenia
    const handleOnline = () => {
      console.log('Aplikacja przeszła w tryb online');
      setIsOnline(true);
      // Nie resetujemy errorMessage od razu, dopiero po udanym połączeniu
      
      // Po przywróceniu połączenia automatycznie włączamy sieć w Firebase
      // ale tylko gdy już wykonaliśmy inicjalny check
      if (initialCheckDone) {
        enableFirebaseNetwork();
      }
    };

    const handleOffline = () => {
      console.log('Aplikacja przeszła w tryb offline');
      setIsOnline(false);
      // Po utracie połączenia wyłączamy sieć w Firebase
      if (initialCheckDone) {
        disableFirebaseNetwork();
      }
    };

    // Nasłuchuj na błędy Firestore
    const handleFirestoreError = (event: ErrorEvent) => {
      if (event.error && 
          typeof event.error.message === 'string' && 
          event.error.message.includes('Firestore') &&
          (event.error.message.includes('INTERNAL ASSERTION FAILED') || 
           event.error.message.includes('invalid-argument'))) {
        setErrorMessage('Wykryto problem z połączeniem do bazy danych.');
        setIsPersistenceEnabled(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('error', handleFirestoreError);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleFirestoreError);
    };
  }, [initialCheckDone]);

  // Sprawdzenie połączenia z Firebase
  const checkFirebaseConnection = async () => {
    try {
      // Zaznaczamy, że sprawdzamy stan sieci
      setSyncing(true);
      
      // Próba włączenia sieci Firebase
      await enableNetwork(db);
      console.log('Połączenie z Firestore działa poprawnie');
      setErrorMessage(null);
      setIsPersistenceEnabled(true);
    } catch (error) {
      console.error('Błąd podczas sprawdzania połączenia z Firestore:', error);
      const errorMsg = error instanceof Error ? error.message : 'Nieznany błąd';
      setErrorMessage(`Problem z połączeniem do Firebase: ${errorMsg}`);
      setIsPersistenceEnabled(false);
    } finally {
      setSyncing(false);
    }
  };

  // Włączanie sieci w Firebase
  const enableFirebaseNetwork = async () => {
    setSyncing(true);
    try {
      await enableNetwork(db);
      console.log('Sieć Firebase włączona pomyślnie');
      setIsPersistenceEnabled(true);
      setErrorMessage(null);
    } catch (error) {
      console.error('Błąd podczas włączania sieci Firebase:', error);
      const errorMsg = error instanceof Error ? error.message : 'Nieznany błąd';
      setErrorMessage(`Nie można włączyć synchronizacji: ${errorMsg}`);
      setIsPersistenceEnabled(false);
    } finally {
      setSyncing(false);
    }
  };

  // Wyłączanie sieci w Firebase
  const disableFirebaseNetwork = async () => {
    try {
      await disableNetwork(db);
      console.log('Sieć Firebase wyłączona pomyślnie');
      setIsPersistenceEnabled(false);
    } catch (error) {
      console.error('Błąd podczas wyłączania sieci Firebase:', error);
    }
  };

  // Obsługa ręcznej synchronizacji
  const handleSync = async () => {
    if (!isOnline || syncing) return;
    
    await enableFirebaseNetwork();
  };

  // Obsługa ponownego uruchomienia aplikacji przy problemach z połączeniem
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleResetFirestore = async () => {
    setIsResetting(true);
    
    try {
      const success = await resetFirestoreConnection(db);
      
      if (success) {
        setErrorMessage(null);
        setIsPersistenceEnabled(true);
        
        // Wyświetl komunikat o pomyślnym resecie
        alert('Pomyślnie zresetowano połączenie z bazą danych. Zalecane jest odświeżenie strony.');
        
        // Zapytaj o odświeżenie strony
        if (window.confirm('Czy chcesz odświeżyć stronę, aby zastosować zmiany?')) {
          window.location.reload();
        }
      } else {
        alert('Nie udało się zresetować połączenia. Spróbuj odświeżyć stronę.');
      }
    } catch (error) {
      console.error('Błąd podczas resetowania połączenia:', error);
      alert('Wystąpił błąd podczas resetowania połączenia.');
    } finally {
      setIsResetting(false);
    }
  };

  // Jeśli jesteśmy online, persistence jest włączone i nie ma błędów lub jeśli nie zakończyliśmy inicjalizacji - nie wyświetlamy komponentu
  if (!initialCheckDone || (isOnline && isPersistenceEnabled && !errorMessage)) {
    return null;
  }

  return (
    <div className={`${styles.offlineStatus} ${className || ''} ${errorMessage ? styles.hasError : ''}`}>
      {!isOnline && (
        <div className={styles.offlineIndicator}>
          <span className={styles.icon}>⚠️</span>
          <span>Brak połączenia z internetem. Tryb offline aktywny.</span>
        </div>
      )}
      
      {!isPersistenceEnabled && isOnline && (
        <div className={styles.pendingRequests}>
          <span>
            Tryb offline aktywny. Dane nie są synchronizowane z Firebase.
          </span>
          <button 
            className={styles.syncButton} 
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Synchronizacja...' : 'Włącz synchronizację'}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>
            <span className={styles.icon}>⚠️</span> 
            {errorMessage}
          </p>
          <button 
            className={styles.resetButton}
            onClick={handleResetFirestore}
            disabled={isResetting}
          >
            {isResetting ? 'Resetowanie...' : 'Resetuj połączenie'}
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineStatus; 