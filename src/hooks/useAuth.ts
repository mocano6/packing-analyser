import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { compareHash, hashPassword } from "@/utils/password";

// Klucz localStorage do przechowywania tokenu autentykacji
const AUTH_TOKEN_KEY = "packing_app_auth_token";

interface UseAuthReturnType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setPassword: (newPassword: string) => Promise<boolean>;
}

export function useAuth(): UseAuthReturnType {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sprawdź stan autentykacji przy inicjalizacji
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
        
        // Token istnieje, zweryfikuj czy jest aktualny
        const settingsRef = doc(db, "settings", "password");
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          // Prosty token z timestampem - sprawdzamy czy jest ważny (max 24h)
          const tokenParts = token.split('_');
          if (tokenParts.length === 2) {
            const timestamp = parseInt(tokenParts[1], 10);
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            
            // Sprawdź czy token nie wygasł (ważny 24h)
            if (now - timestamp < ONE_DAY) {
              setIsAuthenticated(true);
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Token nieważny
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setIsAuthenticated(false);
      } catch (error) {
        console.error("Błąd podczas weryfikacji autentykacji:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Logowanie z użyciem hasła
  const login = async (password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Pobierz hasło z Firebase
      const settingsRef = doc(db, "settings", "password");
      const settingsDoc = await getDoc(settingsRef);
      
      if (!settingsDoc.exists()) {
        // Jeśli dokument z hasłem nie istnieje, pierwszy użytkownik może ustawić hasło
        await setPassword(password);
        return true;
      }
      
      const { hash, salt } = settingsDoc.data();
      
      // Porównaj hasło
      const isValid = await compareHash(password, hash, salt);
      
      if (isValid) {
        // Generowanie prostego tokenu z timestampem
        const token = `auth_${Date.now()}`;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        setIsAuthenticated(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Błąd podczas logowania:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Wylogowanie
  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  // Ustawienie nowego hasła
  const setPassword = async (newPassword: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Haszowanie hasła
      const { hash, salt } = await hashPassword(newPassword);
      
      // Zapisz w Firebase
      const settingsRef = doc(db, "settings", "password");
      await setDoc(settingsRef, { hash, salt, updatedAt: new Date() });
      
      // Automatyczne zalogowanie po ustawieniu hasła
      const token = `auth_${Date.now()}`;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error("Błąd podczas ustawiania hasła:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { isAuthenticated, isLoading, login, logout, setPassword };
} 