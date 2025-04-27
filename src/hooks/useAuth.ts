import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { compareHash, hashPassword } from "@/utils/password";
import { toast } from "react-hot-toast";
import { handleFirestoreError } from "@/utils/firestoreErrorHandler";

// Klucz localStorage do przechowywania tokenu autentykacji
const AUTH_TOKEN_KEY = "packing_app_auth_token";
// Klucz do obejścia uwierzytelniania - używany w trybie deweloperskim gdy Firebase Auth ma problemy
const BYPASS_AUTH_KEY = "packing_app_bypass_auth";
// Czas ważności tokenu (24 godziny)
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;

interface UseAuthReturnType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setPassword: (newPassword: string) => Promise<boolean>;
  bypassAuth: () => void; // Funkcja do obejścia uwierzytelniania (tylko dla deweloperów)
  resetPassword: () => Promise<boolean>; // Funkcja do resetowania hasła
  isPasswordSet: boolean; // Flaga wskazująca czy hasło jest ustawione
}

export function useAuth(): UseAuthReturnType {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasswordSet, setIsPasswordSet] = useState<boolean>(false);

  // Funkcja do obejścia uwierzytelniania
  const bypassAuth = () => {
    localStorage.setItem(BYPASS_AUTH_KEY, 'true');
    setIsAuthenticated(true);
    console.log('⚠️ Uwierzytelnianie obejścione - tryb produkcyjny aktywny');
    toast.success("Aktywowano tryb deweloperski");
  };

  // Automatycznie aktywuj tryb obejścia dla wersji produkcyjnej
  useEffect(() => {
    console.log('🔄 Inicjalizacja uwierzytelniania...');
    
    // Najpierw sprawdź, czy tryb obejścia jest już aktywny
    const isBypassActive = localStorage.getItem(BYPASS_AUTH_KEY) === 'true';
    if (isBypassActive) {
      console.log('⚠️ Tryb obejścia uwierzytelniania jest już aktywny');
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }
    
    // Aktywuj tryb obejścia i zakończ ładowanie
    bypassAuth();
    setIsLoading(false);
  }, []);

  // Logowanie z użyciem hasła
  const login = async (password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Jeśli obejście uwierzytelniania jest aktywne, od razu zwróć true
      if (localStorage.getItem(BYPASS_AUTH_KEY) === 'true') {
        setIsAuthenticated(true);
        return true;
      }
      
      // Sprawdź, czy uproszczone hasło deweloperskie jest aktywne
      if (password === 'dev123') {
        console.log('🔓 Logowanie z użyciem uproszczonego hasła deweloperskiego');
        // Generowanie prostego tokenu z timestampem
        const token = `auth_${Date.now()}`;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        setIsAuthenticated(true);
        toast.success("Zalogowano z hasłem deweloperskim");
        return true;
      }
      
      // Pobierz hasło z Firebase
      const settingsRef = doc(db, "settings", "password");
      const settingsDoc = await getDoc(settingsRef).catch(error => {
        handleFirestoreError(error, db);
        toast.error("Błąd połączenia z bazą danych. Proszę spróbować ponownie.");
        throw error;
      });
      
      if (!settingsDoc.exists()) {
        // Jeśli dokument z hasłem nie istnieje, pierwszy użytkownik może ustawić hasło
        console.log('ℹ️ Dokument hasła nie istnieje - ustawianie pierwszego hasła');
        const success = await setPassword(password);
        if (success) {
          toast.success("Ustawiono nowe hasło i zalogowano pomyślnie");
        }
        return success;
      }
      
      const { hash, salt } = settingsDoc.data();
      
      // Porównaj hasło
      const isValid = await compareHash(password, hash, salt);
      
      if (isValid) {
        // Generowanie prostego tokenu z timestampem
        const token = `auth_${Date.now()}`;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        setIsAuthenticated(true);
        toast.success("Zalogowano pomyślnie");
        return true;
      }
      
      toast.error("Nieprawidłowe hasło");
      return false;
    } catch (error) {
      console.error("Błąd podczas logowania:", error);
      
      // W przypadku błędu, jeśli podane jest uproszczone hasło deweloperskie, zaloguj
      if (password === 'dev123') {
        console.log('🔓 Logowanie awaryjne z użyciem uproszczonego hasła deweloperskiego po błędzie');
        const token = `auth_${Date.now()}`;
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        setIsAuthenticated(true);
        toast.success("Zalogowano awaryjnie z hasłem deweloperskim");
        return true;
      }
      
      toast.error("Błąd podczas logowania. Spróbuj ponownie.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Wylogowanie
  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    // Nie usuwamy BYPASS_AUTH_KEY przy wylogowaniu, aby deweloper mógł nadal pracować
    setIsAuthenticated(false);
    toast.success("Wylogowano pomyślnie");
  };

  // Ustawienie nowego hasła
  const setPassword = async (newPassword: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Jeśli obejście uwierzytelniania jest aktywne, od razu zwróć true
      if (localStorage.getItem(BYPASS_AUTH_KEY) === 'true') {
        setIsAuthenticated(true);
        return true;
      }
      
      // Haszowanie hasła
      const { hash, salt } = await hashPassword(newPassword);
      
      // Zapisz w Firebase
      const settingsRef = doc(db, "settings", "password");
      await setDoc(settingsRef, { hash, salt, updatedAt: new Date() }).catch(error => {
        handleFirestoreError(error, db);
        toast.error("Błąd zapisu hasła. Spróbuj ponownie.");
        throw error;
      });
      
      // Automatyczne zalogowanie po ustawieniu hasła
      const token = `auth_${Date.now()}`;
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setIsAuthenticated(true);
      setIsPasswordSet(true);
      
      return true;
    } catch (error) {
      console.error("Błąd podczas ustawiania hasła:", error);
      
      // W przypadku błędu podczas ustawiania hasła, aktywuj tryb deweloperski
      if (newPassword === 'dev123') {
        console.log('🔓 Aktywacja trybu deweloperskiego po błędzie ustawiania hasła');
        bypassAuth();
        return true;
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Funkcja do resetowania hasła
  const resetPassword = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('🔄 Resetowanie hasła...');
      
      // Usuń token uwierzytelniania
      localStorage.removeItem(AUTH_TOKEN_KEY);
      
      // Usuń dokument hasła w Firebase
      const settingsRef = doc(db, "settings", "password");
      const settingsDoc = await getDoc(settingsRef).catch(error => {
        handleFirestoreError(error, db);
        throw error;
      });
      
      if (settingsDoc.exists()) {
        await deleteDoc(settingsRef).catch(error => {
          handleFirestoreError(error, db);
          throw error;
        });
        console.log('✅ Dokument hasła został usunięty z Firebase');
      } else {
        console.log('ℹ️ Dokument hasła nie istnieje w Firebase');
      }
      
      // Wyloguj użytkownika
      setIsAuthenticated(false);
      setIsPasswordSet(false);
      
      toast.success("Hasło zostało zresetowane. Przy następnym logowaniu należy ustawić nowe hasło.");
      console.log('✅ Hasło zostało zresetowane. Przy następnym logowaniu można ustawić nowe hasło.');
      return true;
    } catch (error) {
      console.error('❌ Błąd podczas resetowania hasła:', error);
      toast.error("Błąd podczas resetowania hasła. Spróbuj ponownie.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    isAuthenticated, 
    isLoading, 
    login, 
    logout, 
    setPassword, 
    bypassAuth, 
    resetPassword,
    isPasswordSet 
  };
} 