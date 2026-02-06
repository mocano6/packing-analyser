'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './oczekuje.module.css';

export default function PendingApprovalPage() {
  const { isAuthenticated, isLoading, userRole, userStatus, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (userRole !== 'player') {
      router.replace('/');
      return;
    }
    if (userStatus === 'approved') {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, userRole, userStatus, router]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Konto oczekuje na zatwierdzenie</h1>
        <p className={styles.subtitle}>
          Twoja rejestracja została przyjęta. Administrator musi potwierdzić
          konto i przypisać profil zawodnika.
        </p>
        <p className={styles.note}>
          Gdy konto zostanie zatwierdzone, uzyskasz pełny dostęp do profilu i
          statystyk zespołu.
        </p>
        <button type="button" className={styles.logoutButton} onClick={logout}>
          Wyloguj się
        </button>
      </div>
    </div>
  );
}
