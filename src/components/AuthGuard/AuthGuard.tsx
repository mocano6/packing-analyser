"use client";

import React, { useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, bypassAuth } = useAuth();
  const [showLoginButton, setShowLoginButton] = useState(false);

  // Automatycznie aktywuj tryb deweloperski (obejście uwierzytelniania)
  useEffect(() => {
    console.log('🔓 AuthGuard: Aktywacja trybu deweloperskiego - obejście uwierzytelniania');
    localStorage.setItem('packing_app_bypass_auth', 'true');
    // Wywołanie funkcji bypassAuth z hooka useAuth
    bypassAuth();
    // Po aktywacji trybu deweloperskiego powinno nastąpić przekierowanie lub render dzieci
  }, [bypassAuth]);

  // Funkcja do bezpośredniego przekierowania na stronę logowania
  const goToLoginPage = () => {
    // Używamy window.location.href dla bardziej bezpośredniego przekierowania
    window.location.href = "/login";
  };

  useEffect(() => {
    // Pokaż przycisk logowania po krótkim opóźnieniu
    if (!isLoading && !isAuthenticated) {
      const timer = setTimeout(() => {
        setShowLoginButton(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading]);

  // Jeśli trwa ładowanie, pokaż indykator
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5"
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          <div style={{
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            animation: "spin 1s linear infinite",
            marginBottom: "16px"
          }}></div>
          <p>Weryfikacja dostępu...</p>
        </div>
      </div>
    );
  }

  // Jeśli użytkownik jest zalogowany, renderuj dzieci
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Wyświetl stronę logowania zamiast przekierowania
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "#f5f5f5"
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: "400px",
        padding: "20px",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginBottom: "20px" }}>Wymagane logowanie</h2>
        <p>Dostęp do tej strony wymaga logowania.</p>
        
        <div style={{ marginTop: "20px" }}>
          <button 
            onClick={goToLoginPage}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            {showLoginButton ? "Przejdź do strony logowania" : "Przygotowywanie..."}
          </button>
        </div>
        
        {/* Awaryjny link tekstowy, gdyby przycisk nie działał */}
        <div style={{ marginTop: "20px", fontSize: "14px" }}>
          <p>Jeśli przycisk nie działa, skopiuj i wklej w pasku adresu:</p>
          <code style={{ 
            display: "inline-block", 
            marginTop: "5px",
            padding: "4px 8px", 
            backgroundColor: "#f0f0f0", 
            borderRadius: "4px" 
          }}>
            /login
          </code>
        </div>
      </div>
    </div>
  );
};

export default AuthGuard; 