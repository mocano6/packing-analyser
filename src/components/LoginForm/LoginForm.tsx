'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/utils/authService';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();
  const authService = AuthService.getInstance();

  useEffect(() => {
    const unsubscribe = authService.subscribe((authState) => {
      if (authState.isAuthenticated && !authState.isAnonymous) {
        router.push('/');
      }
    });

    return unsubscribe;
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Wprowadź email i hasło');
      }

      if (isRegistering) {
        await authService.registerWithEmail(email, password);
      } else {
        await authService.signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Błąd logowania:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Nie znaleziono użytkownika o tym adresie email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Nieprawidłowe hasło');
      } else if (err.code === 'auth/invalid-email') {
        setError('Nieprawidłowy format adresu email');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Konto z tym adresem email już istnieje');
      } else if (err.code === 'auth/weak-password') {
        setError('Hasło jest zbyt słabe. Użyj co najmniej 6 znaków');
      } else {
        setError(err.message || 'Wystąpił błąd podczas logowania');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>Packing Analyzer</h1>
          <p className={styles.subtitle}>
            {isRegistering ? 'Utwórz nowe konto' : 'Zaloguj się do aplikacji'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="wprowadz@email.com"
              disabled={isLoading}
              required
            />
          </div>

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
              required
              minLength={6}
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
              isRegistering ? 'Utwórz konto' : 'Zaloguj się'
            )}
          </button>

          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setIsRegistering(!isRegistering)}
            disabled={isLoading}
          >
            {isRegistering 
              ? 'Masz już konto? Zaloguj się' 
              : 'Nie masz konta? Zarejestruj się'
            }
          </button>
        </form>
      </div>
    </div>
  );
} 