'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      setLoginSuccess(true);
      const timer = setTimeout(() => {
        router.push('/');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!password) {
        throw new Error('Wprowadź hasło');
      }

      await login(password);
      setLoginSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas logowania');
    } finally {
      setIsLoading(false);
    }
  };

  if (loginSuccess) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>Zalogowano pomyślnie!</h1>
          <p className={styles.successMessage}>
            Za chwilę zostaniesz przekierowany do aplikacji...
          </p>
          <button
            className={styles.loginButton}
            onClick={() => router.push('/')}
          >
            Przejdź do aplikacji
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Packing Analyzer</h1>
          <p className={styles.subtitle}>
            Wprowadź hasło, aby uzyskać dostęp do aplikacji
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Wprowadź hasło"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className={styles.spinner} />
            ) : (
              'Zaloguj się'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 