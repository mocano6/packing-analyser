'use client';

import React, { useEffect, useState } from 'react';
import styles from './OfflineStatus.module.css';

interface OfflineStatusProps {
  className?: string;
  isOfflineMode?: boolean;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ className, isOfflineMode }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isOfflineFlag, setIsOfflineFlag] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    setIsOfflineFlag(localStorage.getItem('firestore_offline_mode') === 'true');

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'firestore_offline_mode') {
        setIsOfflineFlag(event.newValue === 'true');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const shouldShow = typeof isOfflineMode === 'boolean'
    ? isOfflineMode
    : (!isOnline || isOfflineFlag);

  if (!shouldShow) return null;

  return (
    <div className={`${styles.offlineBanner} ${className || ''}`} role="status" aria-live="polite">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">📴</span>
        <span className={styles.message}>
          Brak połączenia. Dane zapisują się lokalnie i zostaną wysłane do bazy po powrocie internetu.
        </span>
      </div>
      <button
        type="button"
        className={styles.actionButton}
        onClick={() => window.location.reload()}
      >
        Spróbuj ponownie
      </button>
    </div>
  );
};

export default OfflineStatus; 