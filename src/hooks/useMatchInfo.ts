// src/hooks/useMatchInfo.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TeamInfo, PlayerMinutes } from "@/types";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where, orderBy, writeBatch, getDoc, setDoc
} from "firebase/firestore";
import { handleFirestoreError, resetFirestoreConnection } from "@/utils/firestoreErrorHandler";
import { v4 as uuidv4 } from 'uuid';

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
      console.log("🌐 Aplikacja jest online");
      setIsOfflineMode(false);
    };

    const handleOffline = () => {
      console.log("📴 Aplikacja jest offline");
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
        console.log('💾 Cache zapisany do localStorage, elementów:', localCacheRef.current.data.length);
      } catch (err) {
        console.error('❌ Błąd podczas zapisywania cache do localStorage:', err);
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
          console.log('📂 Wczytano cache z localStorage, elementów:', parsedCache.data.length);
          return parsedCache;
        }
      } catch (err) {
        console.error('❌ Błąd podczas wczytywania cache z localStorage:', err);
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
    console.log(`toggleMatchModal wywoływany z isOpen=${isOpen}, isNewMatch=${isNewMatch}`);
    
    // Zawsze aktualizujemy stan modalu - najpierw ustawiamy stan
    if (isOpen === false) {
      console.log("Zamykanie modalu meczu - ustawiam stan na FALSE");
      setIsMatchModalOpen(false);
    } else {
      console.log("Otwieranie modalu meczu - ustawiam stan na TRUE");
      setIsMatchModalOpen(true);
    }
    
    // Jeśli otwieramy modal dla nowego meczu, resetujemy dane meczu
    if (isOpen && isNewMatch) {
      // Opóźnienie jest potrzebne, aby zmiany stanu nastąpiły w odpowiedniej kolejności
      console.log("Resetowanie danych meczu dla nowego meczu");
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
        console.log("📴 W trybie offline, używamy tylko lokalnego cache");
        
        // Zwracamy dane z cache zamiast rzucać wyjątek
        const cachedMatches = localCacheRef.current.data;
        const filteredMatches = teamId 
          ? cachedMatches.filter(match => match.team === teamId)
          : cachedMatches;
          
        console.log('🚑 Używam cache w trybie offline, elementów:', filteredMatches.length);
        
        return filteredMatches;
      }
      
      // Dodajemy opóźnienie przed próbą pobrania danych
      await new Promise(res => setTimeout(res, 300));
      
      console.log("🔄 Próba synchronizacji danych z Firebase dla zespołu:", teamId || "wszystkie");
      
      // Używamy kolejki operacji i mechanizmu ponownych prób
      const matchesData = await firebaseQueue.add(async () => {
        return withRetry(async () => {
          try {
      const matchesCollection = collection(db, "matches");
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
              console.log('❌ Brak meczów w Firebase');
              return [];
            }
          } catch (err) {
            console.error("⚠️ Błąd przy pobieraniu meczów z Firebase:", err);
            // W przypadku błędu uprawnień, przełączamy się na tryb offline
            if (String(err).includes("permission") || String(err).includes("Missing or insufficient permissions")) {
              console.warn("🔒 Problem z uprawnieniami Firebase, przełączam na tryb offline");
              setIsOfflineMode(true);
              setError("Brak uprawnień do synchronizacji danych z bazą. Działamy w trybie offline.");
              
              // Zwracamy dane z cache zamiast rzucać wyjątek
              const cachedMatches = localCacheRef.current.data;
              const filteredMatches = teamId 
                ? cachedMatches.filter(match => match.team === teamId)
                : cachedMatches;
                
              console.log('🚑 Używam cache z powodu problemów z uprawnieniami, elementów:', filteredMatches.length);
              
              return filteredMatches;
            }
            throw err;
          }
        }, 2, 2000); // Mniejsze parametry ponownych prób
      });
      
      console.log('🏆 Pobrane mecze z Firebase:', matchesData.length, 'elementów');
      
      // Aktualizacja cache'u i stanu
      updateLocalCache(matchesData, teamId);
        setAllMatches(matchesData);
      
      return matchesData;
    } catch (err) {
      console.error("❌ Błąd podczas pobierania meczów z Firebase:", err);
      
      // W przypadku błędu, używamy danych z cache
      const cachedMatches = localCacheRef.current.data;
      const filteredMatches = teamId 
        ? cachedMatches.filter(match => match.team === teamId)
        : cachedMatches;
        
      console.log('🚑 Używam cache jako źródła awaryjnego, elementów:', filteredMatches.length);
      
      return filteredMatches;
    } finally {
      setIsSyncing(false);
      
      // Dodajemy opóźnienie przed kolejnymi operacjami
      await new Promise(res => setTimeout(res, 300));
    }
  };

  // Funkcja do pobierania meczów (z cache'u, próbuje z Firebase w tle jeśli online)
  const fetchMatches = useCallback(async (teamId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("🔍 fetchMatches: Rozpoczynam pobieranie meczów dla zespołu:", teamId || "wszystkie");
      
      // 1. Najpierw sprawdzamy cache
      const cachedMatches = localCacheRef.current.data;
      console.log(`📂 Cache zawiera ${cachedMatches.length} meczów`);
      
      // 2. Filtrujemy dane z cache'u (jeśli jest teamId)
      let filteredMatches = cachedMatches;
      if (teamId) {
        filteredMatches = cachedMatches.filter(match => match.team === teamId);
        console.log(`🔍 Po filtrowaniu cache'u: ${filteredMatches.length} meczów dla zespołu ${teamId}`);
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
        fetchFromFirebase(teamId).then(firebaseMatches => {
          if (teamId) {
            const teamMatches = firebaseMatches.filter(match => match.team === teamId);
            console.log(`🔄 Odświeżono dane z Firebase: ${teamMatches.length} meczów dla zespołu ${teamId}`);
            
            if (teamMatches.length !== filteredMatches.length) {
              console.log('📊 Wykryto różnicę między cache a Firebase, aktualizuję stan');
              setAllMatches(teamMatches);
              
              // Aktualizacja wybranego meczu
              if (matchInfo?.matchId) {
                const selectedMatch = teamMatches.find(m => m.matchId === matchInfo.matchId);
                if (selectedMatch) {
                  setMatchInfo(selectedMatch);
                } else if (teamMatches.length > 0) {
                  setMatchInfo(teamMatches[0]);
                } else {
                  setMatchInfo(null);
                }
              } else if (teamMatches.length > 0) {
                setMatchInfo(teamMatches[0]);
              } else {
                setMatchInfo(null);
              }
            }
          }
        }).catch(err => {
          console.warn("Błąd synchronizacji w tle:", err);
          // Ignorujemy błędy synchronizacji w tle
          
          // Sprawdzenie czy to błąd wewnętrznego stanu Firestore
          const isInternalAssertionFailure = 
            err && 
            typeof err.message === 'string' && 
            err.message.includes("INTERNAL ASSERTION FAILED");
            
          if (isInternalAssertionFailure) {
            console.warn("🚨 Wykryto błąd wewnętrznego stanu Firestore podczas synchronizacji w tle");
            
            // Obsługa błędu wewnętrznego stanu
            handleFirestoreError(err, db).catch(e => {
              console.error("Problem podczas obsługi błędu Firestore:", e);
            });
            setError("Wystąpił problem z połączeniem do bazy danych. Odśwież stronę, aby rozwiązać problem.");
          }
        });
      }
      
      return filteredMatches;
    } catch (error) {
      console.error("Błąd podczas pobierania meczów:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      // Używamy danych z cache jako zapasowego źródła
      const cachedMatches = localCacheRef.current.data;
      const filteredMatches = teamId 
        ? cachedMatches.filter(match => match.team === teamId)
        : cachedMatches;
        
      console.log("🚑 Używam danych z cache po błędzie:", filteredMatches.length, "meczów");
      setAllMatches(filteredMatches);
      
      // Ustawiamy komunikat o błędzie
      setError(`Wystąpił problem przy pobieraniu danych: ${error instanceof Error ? error.message : String(error)}`);
      
      return filteredMatches;
    } finally {
      setIsLoading(false);
    }
  }, [matchInfo, isOfflineMode]);

  // Funkcja do pełnego odświeżenia danych z Firebase (ignoruje cache)
  const forceRefreshFromFirebase = async (teamId?: string) => {
    try {
      console.log("🔄 Wymuszam pełne odświeżenie danych z Firebase");
      setIsLoading(true);
      
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
      console.log('💾 handleSaveMatchInfo - rozpoczęcie zapisu meczu');
      console.log('📋 handleSaveMatchInfo - przekazane info:', info);
      
      // Przygotuj dane meczu do zapisania
      const matchData = {
        team: info.team,
        opponent: info.opponent,
        isHome: info.isHome,
        competition: info.competition,
        date: info.date,
        playerMinutes: info.playerMinutes || []
      };
      
      console.log('🧾 handleSaveMatchInfo - dane meczu do zapisania:', matchData);
      
      let savedMatch: TeamInfo;
      let isNewMatch = !info.matchId;
      let localId = isNewMatch ? generateId() : info.matchId!;
      
      // 1. Najpierw aktualizujemy lokalny cache
      if (info.matchId) {
        // Update istniejącego meczu
        savedMatch = {
          matchId: info.matchId,
          ...matchData
        };
        
        // Aktualizacja cache'u
        const updatedMatches = localCacheRef.current.data.map(match => 
          match.matchId === info.matchId ? savedMatch : match
        );
        updateLocalCache(updatedMatches, info.team);
        
        // Aktualizacja stanu
        setAllMatches(prev => prev.map(match => 
          match.matchId === info.matchId ? savedMatch : match
        ));
      } else {
        // Dodanie nowego meczu
        savedMatch = {
          matchId: localId,
          ...matchData
        };
        
        // Aktualizacja cache'u
        const updatedMatches = [...localCacheRef.current.data, savedMatch];
        updateLocalCache(updatedMatches, info.team);
        
        // Aktualizacja stanu
        setAllMatches(prev => [...prev, savedMatch]);
      }
      
      // Aktualizacja wybranego meczu
      setMatchInfo(savedMatch);
      
      // 2. Asynchronicznie próbujemy zaktualizować Firebase, jeśli jesteśmy online
      if (!isOfflineMode) {
        setTimeout(async () => {
          try {
            // Używamy kolejki operacji Firebase i mechanizmu ponownych prób
            if (info.matchId) {
              // Aktualizacja istniejącego meczu w Firebase
              console.log('✏️ Próba aktualizacji meczu w Firebase:', info.matchId);
              
              await firebaseQueue.add(async () => {
                return withRetry(async () => {
                  try {
                    const matchRef = doc(db, "matches", info.matchId!);
                    await updateDoc(matchRef, matchData);
                    return true;
                  } catch (err) {
                    // W przypadku błędu uprawnień, przełączamy się na tryb offline
                    if (String(err).includes("permission") || String(err).includes("Missing or insufficient permissions")) {
                      console.warn("⚠️ Przełączam na tryb offline z powodu błędów uprawnień");
                      setIsOfflineMode(true);
                    }
                    console.error("⚠️ Błąd przy aktualizacji meczu:", err);
                    throw err;
                  }
                }, 2);
              }).then(() => {
                console.log('✅ Mecz zaktualizowany w Firebase:', info.matchId);
                
                // Po udanym zapisie odświeżamy dane z Firebase
                setTimeout(async () => {
                  console.log("♻️ Odświeżam dane po edycji meczu");
                  await forceRefreshFromFirebase(info.team);
                }, 500);
              }).catch(err => {
                console.error('❌ Nie udało się zaktualizować meczu w Firebase:', err);
              });
            } else {
              // Dodanie nowego meczu do Firebase
              console.log('➕ Próba dodania meczu do Firebase');
              
              firebaseQueue.add(async () => {
                return withRetry(async () => {
                  try {
                    const matchRef = await addDoc(collection(db, "matches"), matchData);
                    return matchRef.id;
                  } catch (err) {
                    // W przypadku błędu uprawnień, przełączamy się na tryb offline
                    if (String(err).includes("permission") || String(err).includes("Missing or insufficient permissions")) {
                      console.warn("⚠️ Przełączam na tryb offline z powodu błędów uprawnień");
                      setIsOfflineMode(true);
                    }
                    console.error("⚠️ Błąd przy dodawaniu meczu:", err);
                    throw err;
                  }
                }, 2);
              }).then((newId) => {
                console.log('✅ Nowy mecz dodany do Firebase, ID:', newId);
                
                // Aktualizacja ID w cache'u
                savedMatch.matchId = newId as string;
                const updatedMatches = localCacheRef.current.data.map(match => 
                  match.matchId === localId ? savedMatch : match
                );
                updateLocalCache(updatedMatches, info.team);
                
                // Aktualizacja stanu
                setAllMatches(prev => prev.map(match => 
                  match.matchId === localId ? savedMatch : match
                ));
                setMatchInfo(savedMatch);
                
                // Po udanym zapisie odświeżamy dane z Firebase
                setTimeout(async () => {
                  console.log("♻️ Odświeżam dane po dodaniu nowego meczu");
                  await forceRefreshFromFirebase(info.team);
                }, 500);
              }).catch(err => {
                console.error('❌ Nie udało się dodać meczu do Firebase:', err);
              });
            }
            
            // Wysyłamy zdarzenie odświeżenia listy
            setTimeout(() => {
              if (typeof document !== "undefined") {
                const eventId = `${info.team}_${Date.now()}`;
                if (!window._lastRefreshEventId || window._lastRefreshEventId !== eventId) {
                  window._lastRefreshEventId = eventId;
                  
                  setTimeout(() => {
                    if (window._lastRefreshEventId === eventId) {
                      const refreshEvent = new CustomEvent('matchesListRefresh', { 
                        detail: { 
                          teamId: info.team,
                          timestamp: Date.now()
                        } 
                      });
                      window._lastRefreshEventId = "";
                      document.dispatchEvent(refreshEvent);
                    }
                  }, 300);
                }
              }
            }, 800);
          } catch (error) {
            console.error('❌ Błąd podczas synchronizacji z Firebase:', error);
          }
        }, 1500);
      } else {
        // W trybie offline wysyłamy tylko zdarzenie odświeżenia lokalnej listy
        setTimeout(() => {
          if (typeof document !== "undefined") {
            const refreshEvent = new CustomEvent('matchesListRefresh', { 
              detail: { 
                teamId: info.team,
                timestamp: Date.now()
              } 
            });
            document.dispatchEvent(refreshEvent);
          }
        }, 800);
      }
      
      console.log('✅ handleSaveMatchInfo - zakończenie zapisu meczu, zwracam:', savedMatch);
      
      return savedMatch;
    } catch (error) {
      console.error("Błąd podczas zapisywania informacji o meczu:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchMatches]);

  // Funkcja do zapisywania minut zawodników w meczu
  const handleSavePlayerMinutes = useCallback(async (match: TeamInfo, playerMinutes: PlayerMinutes[]) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!match.matchId) {
        throw new Error("Brak ID meczu");
      }
      
      // 1. Aktualizacja lokalnego cache'u
      const updatedMatch = {
        ...match,
        playerMinutes
      };
      
      // Aktualizacja cache'u
      const updatedMatches = localCacheRef.current.data.map(m => 
        m.matchId === match.matchId ? updatedMatch : m
      );
      updateLocalCache(updatedMatches, match.team);
      
      // Aktualizacja stanu
      setAllMatches(prev => 
        prev.map(m => 
          m.matchId === match.matchId ? updatedMatch : m
        )
      );

      // Jeśli to aktualnie wybrany mecz, zaktualizuj też matchInfo
      if (matchInfo?.matchId === match.matchId) {
        setMatchInfo(updatedMatch);
      }
      
      // 2. Asynchronicznie aktualizujemy Firebase jeśli online
      if (!isOfflineMode) {
        setTimeout(async () => {
          try {
            // Aktualizuj dane w Firebase
            const matchRef = doc(db, "matches", match.matchId!);
            await updateDoc(matchRef, {
              playerMinutes: playerMinutes
            });
            
            console.log('✅ Minuty zawodników zaktualizowane w Firebase');
            
            // Po udanym zapisie odświeżamy dane z Firebase
            setTimeout(async () => {
              console.log("♻️ Odświeżam dane po zmianie minut zawodników");
              await forceRefreshFromFirebase(match.team);
            }, 500);
          } catch (error) {
            console.error('❌ Błąd podczas synchronizacji minut zawodników z Firebase:', error);
            
            // W przypadku błędu uprawnień, przełączamy się na tryb offline
            if (String(error).includes("permission") || String(error).includes("Missing or insufficient permissions")) {
              console.warn("⚠️ Przełączam na tryb offline z powodu błędów uprawnień");
              setIsOfflineMode(true);
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania minut zawodników:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchMatches]);

  const handleSelectMatch = (match: TeamInfo | null) => {
    setMatchInfo(match);
  };

  // Modyfikujemy funkcję usuwania, aby również działała offline
  const handleDeleteMatch = useCallback(async (matchId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        
      console.log("🗑️ Rozpoczynam usuwanie meczu:", matchId);
      
      // Dodajemy opóźnienie przed rozpoczęciem operacji
      await new Promise(res => setTimeout(res, 300));
      
      // Znajdź mecz w cache'u
      const matchToDelete = localCacheRef.current.data.find(match => match.matchId === matchId);
      if (!matchToDelete) {
        console.error('❌ Nie znaleziono meczu do usunięcia w cache:', matchId);
        return false;
      }
      
      const deletedMatchTeamId = matchToDelete.team;
      console.log(`🏆 Usuwany mecz należy do zespołu: ${deletedMatchTeamId || 'nieznany'}`);
      
      // 1. Najpierw aktualizujemy lokalny cache
      const updatedMatches = localCacheRef.current.data.filter(match => match.matchId !== matchId);
      updateLocalCache(updatedMatches, deletedMatchTeamId);
      
      // Aktualizacja stanu
      setAllMatches(prev => {
        const updated = prev.filter(match => match.matchId !== matchId);
        console.log(`📊 Po usunięciu pozostało ${updated.length} meczów`);
          
          // Jeśli usunięto aktualnie wybrany mecz, wybierz inny
          if (matchInfo?.matchId === matchId) {
          if (updated.length > 0) {
            console.log(`🔄 Wybrany mecz został usunięty, wybieramy nowy z ${updated.length} dostępnych`);
            // Jeśli to możliwe, wybierz mecz tego samego zespołu
            const sameTeamMatches = updated.filter(match => match.team === deletedMatchTeamId);
            if (sameTeamMatches.length > 0) {
              setMatchInfo(sameTeamMatches[0]);
            } else {
              setMatchInfo(updated[0]);
            }
          } else {
            console.log(`❗ Brak meczów po usunięciu, resetujemy wybrany mecz`);
            setMatchInfo(null);
          }
        }
        
        return updated;
      });
      
      // 2. Asynchronicznie próbujemy zaktualizować Firebase, jeśli jesteśmy online
      if (!isOfflineMode) {
        setTimeout(async () => {
          try {
            // Używamy kolejki operacji Firebase
            await firebaseQueue.add(async () => {
              return withRetry(async () => {
                try {
                  // Próbujemy usunąć sam mecz - nie usuwamy już akcji, bo to może powodować problemy z uprawnieniami
                  await deleteDoc(doc(db, "matches", matchId));
                  return true;
                } catch (err) {
                  // W przypadku błędu uprawnień, przełączamy się na tryb offline
                  if (String(err).includes("permission") || String(err).includes("Missing or insufficient permissions")) {
                    console.warn("⚠️ Przełączam na tryb offline z powodu błędów uprawnień");
                    setIsOfflineMode(true);
                  }
                  console.error("⚠️ Błąd przy usuwaniu meczu z Firebase:", err);
                  throw err;
                }
              }, 2);
            });
            
            console.log(`✅ Usunięto mecz ${matchId} z Firebase`);
            
            // Po udanym usunięciu odświeżamy dane z Firebase
            setTimeout(async () => {
              console.log("♻️ Odświeżam dane po usunięciu meczu");
              await forceRefreshFromFirebase(deletedMatchTeamId);
            }, 500);
          } catch (error) {
            console.error('❌ Błąd podczas synchronizacji usunięcia meczu z Firebase:', error);
          }
        }, 1000);
      }
      
      // Wysyłamy zdarzenie odświeżenia listy po usunięciu (niezależnie od trybu)
      setTimeout(() => {
        if (typeof document !== "undefined") {
          const eventId = `${deletedMatchTeamId}_${Date.now()}`;
          if (!window._lastRefreshEventId || window._lastRefreshEventId !== eventId) {
            window._lastRefreshEventId = eventId;
            
            setTimeout(() => {
              if (window._lastRefreshEventId === eventId) {
                const refreshEvent = new CustomEvent('matchesListRefresh', { 
                  detail: { 
                    teamId: deletedMatchTeamId,
                    timestamp: Date.now()
                  } 
                });
                window._lastRefreshEventId = "";
                document.dispatchEvent(refreshEvent);
              }
            }, 400);
          }
        }
      }, 1000);
      
      return true;
    } catch (error) {
      console.error("Błąd podczas usuwania meczu:", error);
      
      // Obsługa błędu wewnętrznego stanu Firestore
      await handleFirestoreError(error, db);
      
      return false;
      } finally {
        setIsLoading(false);
      }
  }, [fetchMatches]);

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
