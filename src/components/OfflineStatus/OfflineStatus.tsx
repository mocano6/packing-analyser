'use client';

import React, { useState, useEffect } from 'react';
import styles from './OfflineStatus.module.css';
import { getPendingRequests, syncPendingRequests } from '@/lib/api';

interface OfflineStatusProps {
  className?: string;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingRequests, setPendingRequests] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    // Inicjalizacja stanu na podstawie aktualnego statusu połączenia
    setIsOnline(navigator.onLine);
    updatePendingRequestsCount();

    // Nasłuchiwanie zmian stanu połączenia
    const handleOnline = () => {
      setIsOnline(true);
      // Po przywróceniu połączenia automatycznie próbujemy synchronizować dane
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Regularne sprawdzanie liczby oczekujących żądań
    const intervalId = setInterval(updatePendingRequestsCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  // Aktualizacja liczby oczekujących żądań
  const updatePendingRequestsCount = () => {
    const requests = getPendingRequests();
    setPendingRequests(requests.length);
  };

  // Obsługa ręcznej synchronizacji
  const handleSync = async () => {
    if (!isOnline || syncing) return;

    setSyncing(true);
    try {
      await syncPendingRequests();
      updatePendingRequestsCount();
    } catch (error) {
      console.error('Synchronizacja nie powiodła się:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Jeśli jesteśmy online i nie ma oczekujących żądań, nie wyświetlamy komponentu
  if (isOnline && pendingRequests === 0) {
    return null;
  }

  return (
    <div className={`${styles.offlineStatus} ${className || ''}`}>
      {!isOnline && (
        <div className={styles.offlineIndicator}>
          <span className={styles.icon}>⚠️</span>
          <span>Brak połączenia z internetem. Tryb offline aktywny.</span>
        </div>
      )}
      
      {pendingRequests > 0 && (
        <div className={styles.pendingRequests}>
          <span>
            {pendingRequests} {pendingRequests === 1 ? 'żądanie oczekuje' : 'żądań oczekuje'} na synchronizację
          </span>
          {isOnline && (
            <button 
              className={styles.syncButton} 
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? 'Synchronizacja...' : 'Synchronizuj teraz'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineStatus; 