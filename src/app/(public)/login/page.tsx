'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import styles from "./login.module.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isInitialPassword, setIsInitialPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  const router = useRouter();
  const { isAuthenticated, isLoading, login, setPassword: savePassword, bypassAuth, resetPassword } = useAuth();
  
  // Resetuj licznik przekierowań, gdy strona się załaduje
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Wyczyść wszystkie stare stany przekierowań
      sessionStorage.removeItem('auth_redirect_count');
    }
  }, []);
  
  // Pokazujemy przycisk przejścia do aplikacji po pomyślnym zalogowaniu
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLoginSuccess(true);
    }
  }, [isAuthenticated, isLoading]);
  
  // Funkcja do sprawdzania, czy to pierwsze logowanie
  const checkIfInitialSetup = async () => {
    try {
      // Sprawdzamy bezpośrednio w Firestore czy hasło istnieje
      const settingsRef = doc(db, "settings", "password");
      const settingsDoc = await getDoc(settingsRef);
      
      setIsInitialPassword(!settingsDoc.exists());
    } catch (error) {
      console.error("Błąd podczas sprawdzania statusu hasła:", error);
      // W przypadku błędu zakładamy, że to nie jest pierwsze logowanie
      setIsInitialPassword(false);
    }
  };
  
  // Sprawdź przy ładowaniu strony
  useEffect(() => {
    checkIfInitialSetup();
  }, []);
  
  // Logowanie z uproszczonym hasłem deweloperskim
  const handleDevLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const success = await login("dev123");
      
      if (!success) {
        setError("Nie udało się zalogować w trybie deweloperskim");
      }
    } catch (error) {
      console.error("Błąd podczas logowania deweloperskiego:", error);
      setError("Wystąpił błąd podczas logowania");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Aktywacja trybu deweloperskiego
  const activateDevMode = () => {
    bypassAuth();
  };
  
  // Przełączanie widoczności opcji deweloperskich
  const toggleDevOptions = () => {
    setShowDevMode(prev => !prev);
  };
  
  // Włączenie trybu deweloperskiego przez kombinację klawiszy (Shift + D + E + V)
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const konami = ['Shift', 'KeyD', 'KeyE', 'KeyV'];
    let konamiPosition = 0;
    
    const keyDownHandler = (e: KeyboardEvent) => {
      keys[e.code] = true;
      
      if (e.code === konami[konamiPosition]) {
        konamiPosition++;
        
        if (konamiPosition === konami.length) {
          setShowDevMode(true);
          konamiPosition = 0;
        }
      } else {
        konamiPosition = 0;
      }
    };
    
    const keyUpHandler = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    
    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
    };
  }, []);
  
  // Obsługa logowania
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      if (isInitialPassword) {
        // Sprawdź potwierdzenie hasła
        if (password !== confirmPassword) {
          setError("Hasła nie są identyczne");
          setIsSubmitting(false);
          return;
        }
        
        // Zapisz nowe hasło
        const success = await savePassword(password);
        
        if (!success) {
          setError("Nie udało się ustawić hasła");
        }
      } else {
        // Logowanie z istniejącym hasłem
        const success = await login(password);
        
        if (!success) {
          setError("Nieprawidłowe hasło");
        }
      }
    } catch (error) {
      console.error("Błąd podczas logowania:", error);
      setError("Wystąpił błąd podczas logowania");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Obsługa resetowania hasła
  const handleResetPassword = async () => {
    if (window.confirm('Czy na pewno chcesz zresetować hasło? Ta operacja jest nieodwracalna.')) {
      setResettingPassword(true);
      setError(null);
      
      try {
        const success = await resetPassword();
        
        if (success) {
          window.alert('Hasło zostało zresetowane. Teraz możesz ustawić nowe hasło przy logowaniu.');
          window.location.reload();
        } else {
          setError('Nie udało się zresetować hasła.');
        }
      } catch (error) {
        console.error('Błąd podczas resetowania hasła:', error);
        setError('Wystąpił błąd podczas resetowania hasła.');
      } finally {
        setResettingPassword(false);
      }
    }
  };
  
  // Jeśli trwa ładowanie, pokaż indykator ładowania
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Ładowanie...</p>
      </div>
    );
  }
  
  // Jeśli zalogowano pomyślnie, pokaż przycisk do przejścia do aplikacji
  if (loginSuccess) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>Zalogowano pomyślnie</h1>
          <p style={{ marginBottom: "20px" }}>Zostałeś pomyślnie zalogowany do aplikacji.</p>
          <button 
            className={styles.loginButton}
            onClick={() => window.location.href = "/"}
          >
            Przejdź do aplikacji
          </button>
        </div>
      </div>
    );
  }
  
  // W przeciwnym razie zawsze wyświetl formularz logowania
  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>
          {isInitialPassword ? "Ustaw hasło aplikacji" : "Logowanie do aplikacji"}
        </h1>
        
        {isInitialPassword && (
          <div className={styles.infoBox}>
            <p>To pierwsze logowanie do aplikacji. Ustaw hasło, które będzie używane przez wszystkich użytkowników.</p>
          </div>
        )}
        
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label htmlFor="password">Hasło</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
              placeholder="Wprowadź hasło"
            />
          </div>
          
          {isInitialPassword && (
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Potwierdź hasło</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={styles.input}
                placeholder="Potwierdź hasło"
              />
            </div>
          )}
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Przetwarzanie..." : isInitialPassword ? "Ustaw hasło" : "Zaloguj się"}
          </button>
        </form>
        
        {/* Sekcja developerska - widoczna po trzykrotnym kliknięciu lub kombinacji klawiszy */}
        <div className={styles.devSection}>
          <div 
            className={styles.devModeToggle}
            onClick={toggleDevOptions}
            title="Kliknij, aby pokazać/ukryć opcje deweloperskie"
          >
            {/* Niewidoczny element do aktywacji trybu deweloperskiego */}
            &nbsp;
          </div>
          
          {showDevMode && (
            <div className={styles.devOptions}>
              <div className={styles.devWarning}>
                <h3>Tryb deweloperski</h3>
                <p>Te opcje są przeznaczone wyłącznie do celów rozwojowych i testowych!</p>
              </div>
              
              <button 
                type="button"
                className={styles.devButton}
                onClick={handleDevLogin}
                disabled={isSubmitting || resettingPassword}
              >
                Logowanie deweloperskie
              </button>
              
              <button 
                type="button"
                className={styles.bypassButton}
                onClick={activateDevMode}
                disabled={isSubmitting || resettingPassword}
              >
                Obejście uwierzytelniania
              </button>
              
              <button 
                type="button"
                className={styles.resetButton}
                onClick={handleResetPassword}
                disabled={isSubmitting || resettingPassword}
              >
                {resettingPassword ? 'Resetowanie...' : 'Resetuj hasło w Firebase'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 