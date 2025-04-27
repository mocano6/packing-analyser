'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import styles from './OfflineStatusBanner.module.css';
import { enableOnlineMode } from '@/lib/firebase';

interface OfflineStatusBannerProps {
  className?: string;
}

const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ className }) => {
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  
  // Sprawdzamy stan offline przy pierwszym renderowaniu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const offlineMode = localStorage.getItem('firestore_offline_mode') === 'true';
      setIsOfflineMode(offlineMode);
    }
  }, []);
  
  // Nasłuchujemy zmian w localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'firestore_offline_mode') {
        setIsOfflineMode(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Obsługa zamknięcia banera
  const handleDismiss = () => {
    setIsHidden(true);
  };
  
  // Obsługa przełączenia na tryb online
  const handleEnableOnline = async () => {
    try {
      const success = await enableOnlineMode();
      if (success) {
        setIsOfflineMode(false);
        toast.success('Przywrócono tryb online. Odśwież stronę, aby zastosować zmiany.');
      } else {
        toast.error('Nie udało się przywrócić trybu online.');
      }
    } catch (error) {
      console.error('Błąd przy przywracaniu trybu online:', error);
      toast.error('Wystąpił błąd przy przywracaniu trybu online.');
    }
  };
  
  // Obsługa przeładowania strony
  const handleReload = () => {
    window.location.reload();
  };
  
  if (!isOfflineMode || isHidden) {
    return null;
  }
  
  return (
    <div className={`${styles.banner} ${className || ''}`}>
      <div className={styles.icon}>📵</div>
      <div className={styles.content}>
        <h3 className={styles.title}>Aplikacja działa w trybie offline</h3>
        <p className={styles.description}>
          Wykryto problemy z dostępem do Firebase. Aplikacja działa w trybie offline, 
          korzystając z lokalnej pamięci podręcznej. Zmiany nie będą synchronizowane z serwerem.
        </p>
        <div className={styles.actions}>
          <button 
            className={styles.reloadButton}
            onClick={handleReload}
          >
            Odśwież stronę
          </button>
          <button 
            className={styles.onlineButton}
            onClick={handleEnableOnline}
          >
            Spróbuj przywrócić online
          </button>
          <button 
            className={styles.dismissButton}
            onClick={handleDismiss}
          >
            Ukryj komunikat
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineStatusBanner; 