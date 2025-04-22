"use client";

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
  
  const router = useRouter();
  const { isAuthenticated, isLoading, login, setPassword: savePassword } = useAuth();
  
  // Przekieruj do głównej strony, jeśli użytkownik jest już zalogowany
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);
  
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
        
        if (success) {
          // Przekieruj do strony głównej
          router.push("/");
        } else {
          setError("Nie udało się ustawić hasła");
        }
      } else {
        // Logowanie z istniejącym hasłem
        const success = await login(password);
        
        if (success) {
          // Przekieruj do strony głównej
          router.push("/");
        } else {
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
  
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Ładowanie...</p>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return (
      <div className={styles.redirectContainer}>
        <p>Jesteś już zalogowany. Przekierowywanie...</p>
      </div>
    );
  }
  
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
      </div>
    </div>
  );
} 