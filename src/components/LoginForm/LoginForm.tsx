'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/utils/authService';
import { getDB } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError } from '@/utils/firestoreErrorHandler';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const { isAuthenticated, isLoading: authLoading, userRole, userStatus, refreshUserData } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();
  const authService = AuthService.getInstance();

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }
    if (userRole === 'player' && userStatus !== 'approved') {
      router.push('/oczekuje');
      return;
    }
    router.push('/');
  }, [isAuthenticated, authLoading, userRole, userStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();
        const parsedBirthYear = Number.parseInt(birthYear, 10);
        const currentYear = new Date().getFullYear();

        if (!trimmedFirstName || !trimmedLastName || !birthYear) {
          throw new Error('Wprowadź imię, nazwisko oraz rok urodzenia');
        }

        if (!Number.isFinite(parsedBirthYear) || parsedBirthYear < 1900 || parsedBirthYear > currentYear) {
          throw new Error('Podaj poprawny rok urodzenia');
        }

        if (!email || !password) {
          throw new Error('Wprowadź email i hasło');
        }

        const registeredUser = await authService.registerWithEmail(email, password);
        const db = getDB();
        const userRef = doc(db, "users", registeredUser.uid);

        await setDoc(userRef, {
          email,
          role: 'player',
          status: 'pending',
          linkedPlayerId: null,
          allowedTeams: [],
          registrationData: {
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            birthYear: parsedBirthYear
          },
          createdAt: new Date(),
          lastLogin: new Date()
        }, { merge: true }).catch(error => {
          handleFirestoreError(error, db);
          throw error;
        });

        await refreshUserData();
      } else {
        if (!email || !password) {
          throw new Error('Wprowadź email i hasło');
        }
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
          {isRegistering && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="firstName" className={styles.label}>
                  Imię
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                  placeholder="Wpisz imię"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="lastName" className={styles.label}>
                  Nazwisko
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={styles.input}
                  placeholder="Wpisz nazwisko"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="birthYear" className={styles.label}>
                  Rok urodzenia
                </label>
                <input
                  id="birthYear"
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className={styles.input}
                  placeholder="np. 2006"
                  disabled={isLoading}
                  required
                  min={1900}
                  max={new Date().getFullYear()}
                  inputMode="numeric"
                />
              </div>
            </>
          )}
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
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
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