// src/hooks/useMatchInfo.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PlayerMinutes } from "@/types";
import { getDB } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where, orderBy, writeBatch, getDoc, setDoc
} from "firebase/firestore";
import { handleFirestoreError, resetFirestoreConnection } from "@/utils/firestoreErrorHandler";
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
// Usunięto import synchronizacji - minuty są teraz tylko w matches

// Rozszerzenie interfejsu Window
declare global {
  interface Window {
    _lastRefreshEventId?: string;
  }
}

// Klucz dla localStorage
const LOCAL_MATCHES_CACHE_KEY = 'packing_matches_cache';

// Funkcja do generowania unikalnych ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Typ dla lokalnego cache'u meczów
interface MatchesCache {
  data: TeamInfo[];
  timestamp: number; // Kiedy ostatnio pobrano dane z Firebase
  lastTeamId?: string; // Ostatni wybrany zespół
}

// Bufor operacji Firebase dla uniknięcia kolizji - kolejka operacji
const firebaseQueue = {
  isProcessing: false,
  queue: [] as { operation: () => Promise<any>, resolve: (value: any) => void, reject: (error: any) => void }[],
  
  add: function<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  },
  
  processQueue: async function() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    // Dodajemy opóźnienie przed rozpoczęciem przetwarzania kolejki
    await new Promise(res => setTimeout(res, 100));
    
    const { operation, resolve, reject } = this.queue.shift()!;
    
    try {
      // Dodajemy małe opóźnienie między operacjami
      await new Promise(res => setTimeout(res, 200));
      const result = await operation();
      resolve(result);
    } catch (error) {
      console.error("Błąd podczas wykonywania operacji Firebase:", error);
      reject(error);
    } finally {
      // Dodajemy opóźnienie przed przetwarzaniem kolejnej operacji
      setTimeout(() => {
        this.isProcessing = false;
        if (this.queue.length > 0) {
          this.processQueue();
        }
      }, 300);
    }
  }
};

// Funkcja wielokrotnych prób dla operacji Firebase
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Dodajemy opóźnienie przed każdą próbą
      if (attempt > 0) {
        await new Promise(res => setTimeout(res, delay * Math.pow(2, attempt - 1)));
      }
      return await operation();
    } catch (error) {
      console.warn(`Próba ${attempt + 1}/${maxRetries} nie powiodła się:`, error);
      lastError = error;
    }
  }
  
  throw lastError;
}

// Aktualizacja interfejsu TeamInfo, aby zawierał pole lastUpdated
export interface TeamInfo {
  matchId?: string;
  team: string;
  opponent: string;
  isHome: boolean;
  competition: string;
  date: string;
  playerMinutes?: PlayerMinutes[];
  lastUpdated?: string; // Dodajemy pole lastUpdated
}

export function useMatchInfo() {
  const [matchInfo, setMatchInfo] = useState<TeamInfo | null>(null);
  const [allMatches, setAllMatches] = useState<TeamInfo[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Referencja do lokalnego cache'u
  const localCacheRef = useRef<MatchesCache>({
    data: [],
    timestamp: 0
  });
  
  // Sprawdzamy połączenie sieciowe
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false);
    };

    const handleOffline = () => {
      setIsOfflineMode(true);
    };

    // Inicjalna kontrola stanu połączenia
    if (typeof navigator !== 'undefined') {
      setIsOfflineMode(!navigator.onLine);
    }

    // Dodajemy nasłuchiwanie zmian stanu połączenia
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Funkcja do zapisywania cache'u do localStorage
  const saveLocalCache = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LOCAL_MATCHES_CACHE_KEY, JSON.stringify(localCacheRef.current));
      } catch (err) {
        console.error('Błąd podczas zapisywania cache do localStorage:', err);
      }
    }
  };
  
  // Funkcja do ładowania cache'u z localStorage
  const loadLocalCache = (): MatchesCache | null => {
    if (typeof window !== "undefined") {
      try {
        const cachedData = localStorage.getItem(LOCAL_MATCHES_CACHE_KEY);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData) as MatchesCache;
          return parsedCache;
        }
      } catch (err) {
        console.error('Błąd podczas wczytywania cache z localStorage:', err);
      }
    }
    return null;
  };

  // Funkcja do aktualizacji lokalnego cache'u
  const updateLocalCache = (newData: TeamInfo[], teamId?: string) => {
    localCacheRef.current = {
      data: newData,
      timestamp: Date.now(),
      lastTeamId: teamId || localCacheRef.current.lastTeamId
    };
    saveLocalCache();
  };

  // Ładowanie cache'u przy inicjalizacji
  useEffect(() => {
    const cachedData = loadLocalCache();
    if (cachedData) {
      localCacheRef.current = cachedData;
      setAllMatches(cachedData.data);
      
      // Jeśli są dane w cache'u, ustaw pierwszy mecz jako wybrany
      if (cachedData.data.length > 0) {
        const teamId = cachedData.lastTeamId;
        if (teamId) {
          // Jeśli jest zapamiętany zespół, znajdź jego mecze
          const teamMatches = cachedData.data.filter(m => m.team === teamId);
          if (teamMatches.length > 0) {
            setMatchInfo(teamMatches[0]);
          } else {
            setMatchInfo(cachedData.data[0]);
          }
        } else {
          setMatchInfo(cachedData.data[0]);
        }
      }
      
      // Sprawdź, czy jesteśmy online i dane są stare (starsze niż 5 minut)
      const isStale = Date.now() - cachedData.timestamp > 5 * 60 * 1000;
      if (!isOfflineMode && isStale) {
        console.log('🕒 Cache jest przestarzały, próba odświeżenia danych z Firebase');
        fetchFromFirebase(cachedData.lastTeamId).catch(err => {
          console.warn("Nie udało się odświeżyć danych z Firebase:", err);
          // Używamy danych z cache w razie błędu
        });
      }
    } else {
      // Brak danych w cache'u, próbujemy pobrać z Firebase jeśli online
      if (!isOfflineMode) {
        fetchFromFirebase().catch(err => {
          console.warn("Nie udało się pobrać danych z Firebase:", err);
          // W trybie offline będziemy używać pustej listy
        });
      }
    }
  }, [isOfflineMode]);

  // Rozszerzona funkcja otwierania/zamykania modalu
  const toggleMatchModal = (isOpen: boolean, isNewMatch: boolean = false) => {
    // Zawsze aktualizujemy stan modalu - najpierw ustawiamy stan
    if (isOpen === false) {
      setIsMatchModalOpen(false);
    } else {
      setIsMatchModalOpen(true);
    }
    
    // Jeśli otwieramy modal dla nowego meczu, resetujemy dane meczu
    if (isOpen && isNewMatch) {
      // Opóźnienie jest potrzebne, aby zmiany stanu nastąpiły w odpowiedniej kolejności
      setTimeout(() => {
        setMatchInfo(null);
      }, 0);
    }
  };

  // Funkcja do pobierania meczów z Firebase
  const fetchFromFirebase = async (teamId?: string) => {
    try {
      setIsSyncing(true);
      
      // Sprawdzamy czy jesteśmy w trybie offline
      if (isOfflineMode) {
        // Zwracamy dane z cache zamiast rzucać wyjątek
        const cachedMatches = localCacheRef.current.data;
        const filteredMatches = teamId 
          ? cachedMatches.filter(match => match.team === teamId)
          : cachedMatches;
        
        return filteredMatches;
      }
      
      // Dodajemy opóźnienie przed próbą pobrania danych
      await new Promise(res => setTimeout(res, 300));
      

      
      // Używamy kolejki operacji i mechanizmu ponownych prób
      const matchesData = await firebaseQueue.add(async () => {
        return withRetry(async () => {
          try {
      const matchesCollection = collection(getDB(), "matches");
      let matchesQuery;
      
      if (teamId) {
        matchesQuery = query(
          matchesCollection, 
          where("team", "==", teamId),
          orderBy("date", "desc")
        );
      } else {
        matchesQuery = query(
          matchesCollection,
          orderBy("date", "desc")
        );
      }
      
      const matchesSnapshot = await getDocs(matchesQuery);
      
      if (!matchesSnapshot.empty) {
              return matchesSnapshot.docs.map(doc => ({
          matchId: doc.id,
          ...doc.data()
        })) as TeamInfo[];
            } else {
              return [];
            }
          } catch (err) {
            console.error("Błąd przy pobieraniu meczów z Firebase:", err);
            
            // Rozszerzona obsługa błędów offline
            if (String(err).includes("client is offline") || String(err).includes("Failed to get document because the client is offline")) {
              setIsOfflineMode(true);
              
              // Zapisz status offline do localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem('firestore_offline_mode', 'true');
              }
              
              notifyUser("Aplikacja działa w trybie offline z lokalnym cache.", "info");
              
              // Zwracamy dane z cache zamiast rzucać wyjątek
              const cachedMatches = localCacheRef.current.data;
              const filteredMatches = teamId 
                ? cachedMatches.filter(match => match.team === teamId)
                : cachedMatches;
              
              return filteredMatches;
            }
            // W przypadku błędu uprawnień, przełączamy się na tryb offline
            else if (String(err).includes("permission") || String(err).includes("Missing or insufficient permissions")) {
              setIsOfflineMode(true);
              setError("Brak uprawnień do synchronizacji danych z bazą. Działamy w trybie offline.");
              
              // Zwracamy dane z cache zamiast rzucać wyjątek
              const cachedMatches = localCacheRef.current.data;
              const filteredMatches = teamId 
                ? cachedMatches.filter(match => match.team === teamId)
                : cachedMatches;
              
              return filteredMatches;
            }
            throw err;
          }
        }, 2, 2000); // Mniejsze parametry ponownych prób
      });
      
      // Aktualizacja cache'u i stanu
      updateLocalCache(matchesData, teamId);
        setAllMatches(matchesData);
      
      return matchesData;
    } catch (err) {
      console.error("Błąd podczas pobierania meczów z Firebase:", err);
      
      // Sprawdzenie czy to błąd offline
      if (String(err).includes("client is offline") || String(err).includes("Failed to get document because the client is offline")) {
        setIsOfflineMode(true);
        
        // Zapisz status offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
        
        notifyUser("Aplikacja działa w trybie offline z lokalnym cache.", "info");
      }
      
      // W przypadku błędu, używamy danych z cache
      const cachedMatches = localCacheRef.current.data;
      const filteredMatches = teamId 
        ? cachedMatches.filter(match => match.team === teamId)
        : cachedMatches;
      
      return filteredMatches;
    } finally {
      setIsSyncing(false);
      
      // Dodajemy opóźnienie przed kolejnymi operacjami
      await new Promise(res => setTimeout(res, 300));
    }
  };

  // Funkcja do powiadamiania użytkownika o błędach
  const notifyUser = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      default:
        toast(message);
    }
  }, []);

  // Funkcja do pobierania meczów (z cache'u, próbuje z Firebase w tle jeśli online)
  const fetchMatches = useCallback(async (teamId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 1. Najpierw sprawdzamy cache
      const cachedMatches = localCacheRef.current.data;
      
      // 2. Filtrujemy dane z cache'u (jeśli jest teamId)
      let filteredMatches = cachedMatches;
      if (teamId) {
        filteredMatches = cachedMatches.filter(match => match.team === teamId);
      }
      
      // 3. Aktualizujemy stan z cache'u
      setAllMatches(filteredMatches);
      
      // 4. Aktualizujemy wybrany mecz
        if (matchInfo?.matchId) {
        const selectedMatch = filteredMatches.find(m => m.matchId === matchInfo.matchId);
          if (selectedMatch) {
            setMatchInfo(selectedMatch);
        } else if (filteredMatches.length > 0) {
          setMatchInfo(filteredMatches[0]);
          } else {
            setMatchInfo(null);
        }
      } else if (filteredMatches.length > 0) {
        setMatchInfo(filteredMatches[0]);
      } else {
        setMatchInfo(null);
      }
      
      // 5. W tle odświeżamy dane z Firebase tylko jeśli jesteśmy online
      if (!isOfflineMode) {
        // Dodatkowe sprawdzenie statusu online przed próbą dostępu do Firebase
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        
        // Sprawdzamy, czy tryb offline nie jest wymuszony w localStorage
        const isOfflineForced = typeof window !== 'undefined' && 
                               localStorage.getItem('firestore_offline_mode') === 'true';
        
        if (!isOnline || isOfflineForced) {
          setIsOfflineMode(true);
          return filteredMatches;
        }
        
        // Przed próbą pobrania danych, sprawdzamy, czy mamy dostęp do Firebase
        try {
          // Użycie try/catch zamiast await dla operacji sprawdzenia uprawnień,
          // aby natychmiast obsłużyć błąd offline
          const testPermissions = async () => {
            try {
              // Sprawdzenie, czy możemy uzyskać dostęp do kolekcji "matches"
              const testDoc = doc(getDB(), "matches", "test_permissions");
              return await getDoc(testDoc);
            } catch (error) {
              // Rozszerzona obsługa błędów offline
              if (String(error).includes("client is offline") || String(error).includes("Failed to get document because the client is offline")) {
                setIsOfflineMode(true);
                
                // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
                  localStorage.setItem('firestore_offline_mode', 'true');
                }
                
                notifyUser("Wykryto tryb offline. Aplikacja działa z lokalnym cache.", "info");
                
                return null;
              }
              throw error; // Przekazujemy inne błędy dalej
            }
          };
          
          // Wykonaj test uprawnień z timeout - jeśli trwa zbyt długo, zakładamy problemy z połączeniem
          const timeoutPromise = new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error("Timeout przy próbie połączenia z Firebase")), 5000);
          });
          
          const testResult = await Promise.race([testPermissions(), timeoutPromise])
            .catch(error => {
              if (String(error).includes("Timeout")) {
                console.warn("⏱️ Przekroczono czas oczekiwania na Firebase, przełączam na tryb offline");
                setIsOfflineMode(true);
                return null;
              }
              throw error;
            });
          
          // Jeśli test zwrócił null lub undefined, oznacza to że jesteśmy offline lub wystąpił timeout
          if (!testResult) {
            return filteredMatches;
          }
        
          // Jeśli nie wystąpił błąd uprawnień, kontynuujemy pobieranie danych
          try {
            const firebaseMatches = await fetchFromFirebase(teamId);
            
            if (teamId) {
              const teamMatches = firebaseMatches.filter(match => match.team === teamId);

              
              if (teamMatches.length !== filteredMatches.length) {
                console.log('📊 Wykryto różnicę między cache a Firebase, aktualizuję stan');
                setAllMatches(teamMatches);
                
                // Aktualizacja wybranego meczu
                if (matchInfo?.matchId) {
                  const selectedMatch = teamMatches.find(m => m.matchId === matchInfo.matchId);
                  if (selectedMatch) {
                    setMatchInfo(selectedMatch);
                  }
                }
              }
            } else {
              console.log(`🔄 Odświeżono dane z Firebase: ${firebaseMatches.length} meczów łącznie`);
              if (firebaseMatches.length !== filteredMatches.length) {
                console.log('📊 Wykryto różnicę między cache a Firebase, aktualizuję stan');
                setAllMatches(firebaseMatches);
              }
            }
          } catch (error) {
            console.error("❌ Błąd podczas synchronizacji z Firebase w tle:", error);
            
            // Dodajemy rozszerzoną obsługę błędów
            if (String(error).includes("client is offline") || String(error).includes("Failed to get document because the client is offline")) {
              console.warn("📴 Wykryto tryb offline. Przełączam aplikację na tryb lokalnego cache.");
              notifyUser("Aplikacja działa w trybie offline z lokalnym cache.", "info");
              setIsOfflineMode(true);
              
              // Zapisz status offline do localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem('firestore_offline_mode', 'true');
              }
            } 
            else if (String(error).includes("FirebaseError: [code=unavailable]")) {
              notifyUser("Serwer Firebase jest niedostępny. Działamy w trybie offline z lokalnym cache.", "info");
              setIsOfflineMode(true);
            } else if (String(error).includes("permission") || String(error).includes("auth/") || String(error).includes("Missing or insufficient permissions")) {
              notifyUser("Problem z autoryzacją lub uprawnieniami Firebase. Działamy w trybie offline.", "info");
              setIsOfflineMode(true);
              
              // Dodatkowe logowanie diagnostyczne
              console.warn("🔒 Szczegóły błędu uprawnień:", error);
              
              // Zapisz informację o trybie offline do localStorage
              if (typeof window !== "undefined") {
                localStorage.setItem('firestore_offline_mode', 'true');
              }
            } else if (String(error).includes("Failed to fetch") || String(error).includes("NetworkError")) {
              notifyUser("Problem z połączeniem sieciowym. Działamy w trybie offline z lokalnym cache.", "info");
              setIsOfflineMode(true);
            } else {
              setError(`Błąd podczas synchronizacji: ${String(error).slice(0, 100)}...`);
            }
          }
        } catch (permissionError) {
          // Obsługa błędu uprawnień podczas testu
          console.error("🔒 Błąd podczas testowania uprawnień Firebase:", permissionError);
          
          if (String(permissionError).includes("client is offline") || String(permissionError).includes("Failed to get document because the client is offline")) {
            console.log("📴 Klient jest offline - pomijam synchronizację z Firebase");
            notifyUser("Wykryto tryb offline. Działamy z lokalną pamięcią podręczną.", "info");
            setIsOfflineMode(true);
            
            // Zapisz informację o trybie offline do localStorage
            if (typeof window !== "undefined") {
              localStorage.setItem('firestore_offline_mode', 'true');
            }
          }
          else if (String(permissionError).includes("permission") || 
              String(permissionError).includes("auth/") || 
              String(permissionError).includes("Missing or insufficient permissions")) {
            notifyUser("Wykryto problem z uprawnieniami do bazy danych. Przełączam na tryb offline.", "info");
            setIsOfflineMode(true);
            
            // Zapisz informację o trybie offline do localStorage
            if (typeof window !== "undefined") {
              localStorage.setItem('firestore_offline_mode', 'true');
            }
          }
        }
      }
      
      return filteredMatches;
    } catch (err) {
      console.error("❌ Błąd krytyczny w fetchMatches:", err);
      setError(`Wystąpił błąd podczas pobierania danych: ${String(err).slice(0, 100)}...`);
      
      // Sprawdzamy, czy to błąd związany z trybem offline
      if (String(err).includes("client is offline") || String(err).includes("Failed to get document because the client is offline")) {
        console.log("📴 Klient jest offline - przełączam na tryb offline");
        notifyUser("Wykryto tryb offline. Działamy z lokalnym cache.", "info");
        setIsOfflineMode(true);
        
        // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
      }
      
      // Sprawdzamy, czy to błąd uprawnień
      else if (String(err).includes("permission") || 
          String(err).includes("auth/") || 
          String(err).includes("Missing or insufficient permissions")) {
        notifyUser("Krytyczny błąd uprawnień. Działamy w trybie offline.", "error");
        setIsOfflineMode(true);
        
        // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
      }
      
      // Zawsze zwracamy dane z cache w przypadku błędu
      return localCacheRef.current.data.filter(match => !teamId || match.team === teamId);
    } finally {
      setIsLoading(false);
    }
  }, [matchInfo, isOfflineMode, notifyUser]);

  // Funkcja do pełnego odświeżenia danych z Firebase (ignoruje cache)
  const forceRefreshFromFirebase = async (teamId?: string) => {
    try {
      console.log("🔄 Wymuszam pełne odświeżenie danych z Firebase");
      setIsLoading(true);
      
      // Sprawdzamy, czy jesteśmy w trybie offline przed próbą odświeżenia
      if (isOfflineMode) {
        console.warn("📴 Próba odświeżenia danych w trybie offline");
        notifyUser("Aplikacja jest w trybie offline. Odświeżenie danych z serwera jest niemożliwe.", "info");
        return localCacheRef.current.data.filter(m => !teamId || m.team === teamId);
      }
      
      // Wyczyść cache dla danego zespołu
      if (teamId) {
        console.log(`🗑️ Czyszczę cache dla zespołu: ${teamId}`);
        // Usuwamy z cache tylko dane dla danego zespołu
        const otherTeamsData = localCacheRef.current.data.filter(m => m.team !== teamId);
        updateLocalCache(otherTeamsData);
      } else {
        console.log("🗑️ Czyszczę cały cache");
        // Czyszczenie całego cache
        updateLocalCache([]);
      }
      
      // Pobierz świeże dane bezpośrednio z Firebase
      const freshData = await fetchFromFirebase(teamId);
      console.log(`✅ Pobrano świeże dane z Firebase: ${freshData.length} elementów`);
      
      // Uaktualnij stan aplikacji
      const filteredData = teamId 
        ? freshData.filter(m => m.team === teamId) 
        : freshData;
      
      setAllMatches(filteredData);
      
      // Aktualizuj wybrany mecz
      if (matchInfo?.matchId) {
        const selectedMatch = filteredData.find(m => m.matchId === matchInfo.matchId);
        if (selectedMatch) {
          setMatchInfo(selectedMatch);
        } else if (filteredData.length > 0) {
          setMatchInfo(filteredData[0]);
        }
      } else if (filteredData.length > 0) {
        setMatchInfo(filteredData[0]);
      }
      
      return filteredData;
    } catch (error) {
      console.error("❌ Błąd podczas wymuszania odświeżenia:", error);
      
      // Sprawdzamy, czy to błąd związany z trybem offline
      if (String(error).includes("client is offline") || String(error).includes("Failed to get document because the client is offline")) {
        console.warn("📴 Wykryto tryb offline podczas próby odświeżenia danych");
        notifyUser("Wykryto tryb offline. Odświeżenie danych z serwera jest niemożliwe.", "info");
        setIsOfflineMode(true);
        
        // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
        
        // Zwracamy dane z lokalnego cache
        return localCacheRef.current.data.filter(m => !teamId || m.team === teamId);
      }
      
      setError(`Błąd podczas odświeżania danych: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Funkcja do zapisywania informacji o meczu
  const handleSaveMatchInfo = useCallback(async (info: Omit<TeamInfo, "matchId"> & { matchId?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Dodajemy informacje debugujące
      
      
      // Sprawdzamy tryb offline
      if (isOfflineMode && info.matchId && info.matchId !== 'local') {
        console.warn("❌ Próba zapisu meczu do Firebase w trybie offline");
        notifyUser("Zmiany zostaną zapisane lokalnie. Synchronizacja z bazą danych nastąpi po przywróceniu połączenia.", "info");
      }
      
      // Przygotowujemy ID meczu (używamy istniejącego lub generujemy nowy)
      const matchId = info.matchId && info.matchId !== 'local' ? info.matchId : uuidv4();
      
      // Przygotowujemy obiekt meczu
      const matchData: TeamInfo = {
        ...info,
        matchId,
        lastUpdated: new Date().toISOString(),
      };
      
  
      
      // Najpierw aktualizujemy cache lokalnie
      const updatedCacheData = [...localCacheRef.current.data];
      const existingMatchIndex = updatedCacheData.findIndex(match => match.matchId === matchId);
      
      if (existingMatchIndex !== -1) {
        updatedCacheData[existingMatchIndex] = matchData;
      } else {
        updatedCacheData.push(matchData);
      }
      
      // Aktualizacja cache
      localCacheRef.current = {
        ...localCacheRef.current,
        data: updatedCacheData,
        timestamp: new Date().getTime()
      };
      
      // Zapisujemy cache do localStorage
      saveLocalCache();
      
      // Aktualizacja stanu UI
      const newAllMatches = [...allMatches];
      const existingMatchIndexInState = newAllMatches.findIndex(match => match.matchId === matchId);
      
      if (existingMatchIndexInState !== -1) {
        newAllMatches[existingMatchIndexInState] = matchData;
      } else {
        newAllMatches.push(matchData);
      }
      
      setAllMatches(newAllMatches);
      setMatchInfo(matchData);
      
      // Zapisujemy w Firebase w tle, tylko jeśli nie jesteśmy w trybie offline
      if (!isOfflineMode) {
        try {
          const docRef = doc(getDB(), "matches", matchId);
          await setDoc(docRef, matchData);
  
          notifyUser("Mecz został zapisany", "success");
        } catch (firebaseError) {
          console.error('❌ Błąd zapisu do Firebase:', firebaseError);
          
          // Sprawdzamy, czy błąd dotyczy trybu offline
          if (String(firebaseError).includes("client is offline") || String(firebaseError).includes("Failed to get document because the client is offline")) {
            console.warn("📴 Wykryto tryb offline podczas zapisu. Dane zostały zapisane tylko lokalnie.");
            notifyUser("Mecz zapisany lokalnie. Synchronizacja nastąpi po przywróceniu połączenia.", "info");
            setIsOfflineMode(true);
            
            // Zapisz informację o trybie offline do localStorage
            if (typeof window !== "undefined") {
              localStorage.setItem('firestore_offline_mode', 'true');
            }
            
            // Dane są zapisane lokalnie, więc zwracamy matchId
            return matchId;
          }
          
          // Obsługa błędu Firebase
          await handleFirestoreError(firebaseError, getDB());
          
          const errorMessage = `Zmiany zapisane lokalnie, ale wystąpił błąd synchronizacji z bazą danych: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`;
          setError(errorMessage);
          notifyUser(errorMessage, "error");
          
          // Mimo błędu Firebase, dane są zapisane lokalnie, więc zwracamy matchId
        }
      } else {
        // W trybie offline potwierdzamy tylko lokalny zapis
        notifyUser("Mecz zapisany lokalnie", "success");
      }
      

      return matchId;
      
    } catch (error) {
      console.error('❌ Błąd podczas zapisywania meczu:', error);
      
      // Sprawdzamy, czy błąd dotyczy trybu offline
      if (String(error).includes("client is offline") || String(error).includes("Failed to get document because the client is offline")) {
        console.warn("📴 Wykryto tryb offline podczas operacji. Przełączam na tryb lokalny.");
        notifyUser("Aplikacja działa w trybie offline. Dane zostały zapisane lokalnie.", "info");
        setIsOfflineMode(true);
        
        // Zapisz informację o trybie offline do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem('firestore_offline_mode', 'true');
        }
      }
      
      const errorMessage = `Nie udało się zapisać meczu: ${error instanceof Error ? error.message : String(error)}`;
      setError(errorMessage);
      notifyUser(errorMessage, "error");
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [allMatches, isOfflineMode, notifyUser]);

  // Funkcja do usuwania meczu
  const handleDeleteMatch = useCallback(async (matchId: string) => {
    try {
  
      
      if (isOfflineMode) {
        console.warn("❌ Próba usunięcia meczu z Firebase w trybie offline");
        notifyUser("Mecz zostanie usunięty lokalnie. Synchronizacja z bazą danych nastąpi po przywróceniu połączenia.", "info");
      }
      
      setIsLoading(true);
      setError(null);
      
      // Najpierw usuwamy z lokalnego cache
      const updatedCacheData = localCacheRef.current.data.filter(match => match.matchId !== matchId);
      localCacheRef.current = {
        ...localCacheRef.current,
        data: updatedCacheData,
        timestamp: new Date().getTime()
      };
      
      // Zapisujemy zaktualizowany cache
      saveLocalCache();
      
      // Aktualizujemy stan UI
      const updatedMatches = allMatches.filter(match => match.matchId !== matchId);
      setAllMatches(updatedMatches);
      
      // Jeśli usuwany mecz był aktualnie wybrany, wybieramy pierwszy dostępny lub null
      if (matchInfo && matchInfo.matchId === matchId) {
        if (updatedMatches.length > 0) {
          setMatchInfo(updatedMatches[0]);
        } else {
          setMatchInfo(null);
        }
      }
      
      // Usuwamy z Firebase w tle, jeśli nie jesteśmy w trybie offline
      if (!isOfflineMode) {
        try {
          const docRef = doc(getDB(), "matches", matchId);
          await deleteDoc(docRef);
  
          notifyUser("Mecz został usunięty", "success");
        } catch (firebaseError) {
          console.error('❌ Błąd podczas usuwania meczu z Firebase:', firebaseError);
          
          // Obsługa błędu Firebase
          await handleFirestoreError(firebaseError, getDB());
          
          const errorMessage = `Mecz usunięty lokalnie, ale wystąpił błąd synchronizacji z bazą danych: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`;
          setError(errorMessage);
          notifyUser(errorMessage, "error");
          
          // Mimo błędu Firebase, dane są usunięte lokalnie
        }
      } else {
        // W trybie offline potwierdzamy tylko lokalną operację
        notifyUser("Mecz usunięty lokalnie", "success");
      }
      

      return true;
      
    } catch (error) {
      console.error('❌ Błąd podczas usuwania meczu:', error);
      
      const errorMessage = `Nie udało się usunąć meczu: ${error instanceof Error ? error.message : String(error)}`;
      setError(errorMessage);
      notifyUser(errorMessage, "error");
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [allMatches, isOfflineMode, matchInfo, notifyUser]);

  // Funkcja do wyboru meczu
  const handleSelectMatch = useCallback((match: TeamInfo | null) => {
    setMatchInfo(match);
  }, []);

  // Funkcja do zapisywania minut zawodników w meczu
  const handleSavePlayerMinutes = useCallback(async (match: TeamInfo, playerMinutes: PlayerMinutes[]) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!match.matchId) {
        throw new Error("Brak ID meczu");
      }
      
  
      
      if (isOfflineMode) {
        console.warn("❌ Próba aktualizacji minut zawodników w trybie offline");
        notifyUser("Zmiany zostaną zapisane lokalnie. Synchronizacja z bazą danych nastąpi po przywróceniu połączenia.", "info");
      }
      
      // Aktualizacja lokalnego cache
      const updatedMatch = {
        ...match,
        playerMinutes,
        lastUpdated: new Date().toISOString()
      };
      
      // Aktualizacja cache
      const updatedCacheData = localCacheRef.current.data.map(m => 
        m.matchId === match.matchId ? updatedMatch : m
      );
      localCacheRef.current = {
        ...localCacheRef.current, 
        data: updatedCacheData,
        timestamp: new Date().getTime()
      };
      saveLocalCache();
      
      // Aktualizacja stanu UI
      setAllMatches(prev => 
        prev.map(m => 
          m.matchId === match.matchId ? updatedMatch : m
        )
      );

      // Jeśli to aktualnie wybrany mecz, zaktualizuj też matchInfo
      if (matchInfo?.matchId === match.matchId) {
        setMatchInfo(updatedMatch);
      }
      
      // Asynchronicznie aktualizujemy Firebase jeśli online
      if (!isOfflineMode) {
        try {
          // Aktualizuj dane w Firebase
          const matchRef = doc(getDB(), "matches", match.matchId);
          await updateDoc(matchRef, {
            playerMinutes: playerMinutes,
            lastUpdated: new Date().toISOString()
          });
          
          // Minuty zawodników są teraz przechowywane tylko w matches - nie duplikujemy w players
          
          notifyUser("Minuty zawodników zostały zapisane", "success");
        } catch (firebaseError) {
          console.error('❌ Błąd podczas synchronizacji minut zawodników z Firebase:', firebaseError);
          
          // Obsługa błędu Firebase
          await handleFirestoreError(firebaseError, getDB());
          
          const errorMessage = `Minuty zawodników zapisane lokalnie, ale wystąpił błąd synchronizacji z bazą danych: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`;
          setError(errorMessage);
          notifyUser(errorMessage, "error");
        }
      } else {
        // W trybie offline potwierdzamy tylko lokalny zapis
        notifyUser("Minuty zawodników zapisane lokalnie", "success");
      }
      
      return true;
    } catch (error) {
      console.error("Błąd podczas zapisywania minut zawodników:", error);
      
      const errorMessage = `Nie udało się zapisać minut zawodników: ${error instanceof Error ? error.message : String(error)}`;
      setError(errorMessage);
      notifyUser(errorMessage, "error");
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isOfflineMode, matchInfo, notifyUser]);

  return {
    matchInfo,
    allMatches,
    isMatchModalOpen,
    isLoading,
    isSyncing,
    error,
    isOfflineMode,
    toggleMatchModal,
    handleSaveMatchInfo,
    handleSelectMatch,
    handleDeleteMatch,
    handleSavePlayerMinutes,
    fetchMatches,
    forceRefreshFromFirebase
  };
}
