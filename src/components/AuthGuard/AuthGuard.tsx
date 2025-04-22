"use client";

import React, { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Użytkownik nie jest zalogowany, przekieruj do strony logowania
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Pokaż indykator ładowania
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

  // Renderuj pustą stronę podczas przekierowania do logowania
  return null;
};

export default AuthGuard; 