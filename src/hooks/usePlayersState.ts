// src/hooks/usePlayersState.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Player } from "../types";
import { db } from "../lib/firebase";
import { getPlayerFullName } from '@/utils/playerUtils';
import { 
  collection, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, query, where, writeBatch, getDoc, setDoc, getDocsFromServer, onSnapshot
} from "firebase/firestore";

// Helper do generowania ID (alternatywa dla crypto.randomUUID())
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export function usePlayersState() {
  // Inicjalizacja stanu
  const [players, setPlayers] = useState<Player[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerData, setEditingPlayerData] = useState<Player | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref do śledzenia aktualnego stanu (bez closure)
  const playersRef = useRef<Player[]>([]);

  // Pobierz zawodników z Firebase podczas inicjalizacji
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setIsLoading(true);
        
        // Sprawdź czy Firebase jest dostępne
        if (!db) {
          console.warn('⚠️ Firebase nie jest zainicjalizowane - używam localStorage');
        if (typeof window !== "undefined") {
          try {
            const savedPlayers = localStorage.getItem("players");
            if (savedPlayers) {
                const localPlayers = JSON.parse(savedPlayers) as Player[];
                setPlayers(localPlayers);
              } else {
                setPlayers([]);
              }
            } catch (error) {
              console.error("❌ Błąd odczytu localStorage:", error);
              setPlayers([]);
            }
          }
          return;
        }
        
        // Firebase jest dostępne - używaj TYLKO Firebase
        // Wyczyść localStorage żeby uniknąć konfliktów z starymi danymi
        if (typeof window !== "undefined") {
          const oldData = localStorage.getItem("players");
          if (oldData) {
            localStorage.removeItem("players");
          }
        }
        
        const playersCollection = collection(db, "players");
        const playersSnapshot = await getDocs(playersCollection);
        
        if (!playersSnapshot.empty) {
                  const playersList = playersSnapshot.docs.map(doc => {
          const data = doc.data();
          const player = {
            id: doc.id,
            ...data
          };
          

          
          return player;
        }) as Player[];
          

          

        
        // Wykryj i usuń duplikaty w Firebase przed normalizacją
        const playersById = new Map<string, Player>();
        const duplicates: { existing: Player; duplicate: Player }[] = [];
        
        playersList.forEach(player => {
          if (playersById.has(player.id)) {
            const existing = playersById.get(player.id);
            if (existing) {
              duplicates.push({ existing: existing, duplicate: player });
            }
          } else {
            playersById.set(player.id, player);
          }
        });
        
        if (duplicates.length > 0) {
          // Dla każdego duplikatu, zachowaj najnowszą wersję (z więcej danymi)
          duplicates.forEach(({existing, duplicate}) => {
            const existingTeamsCount = Array.isArray(existing.teams) ? existing.teams.length : 0;
            const duplicateTeamsCount = Array.isArray(duplicate.teams) ? duplicate.teams.length : 0;
            
            // Wybierz wersję z większą liczbą zespołów lub LW pozycją
            const shouldKeepDuplicate = 
              duplicateTeamsCount > existingTeamsCount || 
              (duplicate.position === 'LW' && existing.position === 'LS');
              
            if (shouldKeepDuplicate) {
              playersById.set(duplicate.id, duplicate);
            }
          });
        }
        
        // Konwertuj z powrotem na tablicę (bez duplikatów)
        const cleanedPlayersList = Array.from(playersById.values());

        // Normalizuj dane i usuń duplikaty
        const uniqueMap = new Map();
        cleanedPlayersList.forEach(player => {
          // Napraw format teams - upewnij się że teams to zawsze tablica
          let normalizedPlayer = { ...player };
          
          if (typeof normalizedPlayer.teams === 'string') {
            // Jeśli teams to string, zamień na tablicę
            normalizedPlayer.teams = [normalizedPlayer.teams];
          } else if (!Array.isArray(normalizedPlayer.teams)) {
            // Jeśli teams to null/undefined, ustaw pustą tablicę
            normalizedPlayer.teams = [];
          }
          
          uniqueMap.set(player.id, normalizedPlayer); // Ostatni wpis z tym ID zostanie zachowany
        });
        
        const cleanPlayers = Array.from(uniqueMap.values());
        
        // Zastąp cały stan (nie dodawaj do istniejącego)
        setPlayers(cleanPlayers);
        playersRef.current = cleanPlayers; // Aktualizuj ref
          
        // Zapisz do localStorage jako backup
          if (typeof window !== "undefined") {
          localStorage.setItem("players", JSON.stringify(cleanPlayers));
        }
          
              } else {
              setPlayers([]);
        }
        
      } catch (error) {
        console.error('Błąd pobierania z Firebase, używam localStorage jako fallback:', error);
        
        // TYLKO W PRZYPADKU BŁĘDU Firebase - użyj localStorage
        if (typeof window !== "undefined") {
          try {
            const savedPlayers = localStorage.getItem("players");
            if (savedPlayers) {
              const localPlayers = JSON.parse(savedPlayers) as Player[];
              setPlayers(localPlayers);
            } else {
              setPlayers([]);
            }
          } catch (localError) {
            console.error("Błąd odczytu localStorage:", localError);
            setPlayers([]);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  // Funkcja do ponownego pobrania danych z Firebase (z wymuszeniem odczytu z serwera)
  const refetchPlayers = useCallback(async (forceServerFetch = false) => {
    if (!db) return;
    
    // Zabezpieczenie przed wielokrotnym wywołaniem
    if (isRefetching) {
      return;
    }
    
    try {
      setIsRefetching(true);
      
      // Wyczyść localStorage przed refetch żeby nie było konfliktów
      if (typeof window !== "undefined") {
        const oldLocalData = localStorage.getItem("players");
        if (oldLocalData) {
          localStorage.removeItem("players");
        }
      }
      
      const playersCollection = collection(db, "players");
      // Jeśli wymuszamy, użyj getDocsFromServer zamiast getDocs (pomija cache)
      const playersSnapshot = forceServerFetch 
        ? await getDocsFromServer(playersCollection)
        : await getDocs(playersCollection);
      
      if (!playersSnapshot.empty) {
        const playersList = playersSnapshot.docs.map(doc => {
          const data = doc.data();
          const player = {
            id: doc.id,
            ...data
          };
          
          return player;
        }) as Player[];
        

        
        // Wykryj i usuń duplikaty w Firebase przed normalizacją
        const playersById = new Map<string, Player>();
        const duplicates: { existing: Player; duplicate: Player }[] = [];
        
        playersList.forEach(player => {
          if (playersById.has(player.id)) {
            const existing = playersById.get(player.id);
            if (existing) {
              duplicates.push({ existing: existing, duplicate: player });
            }
          } else {
            playersById.set(player.id, player);
          }
        });
        
        if (duplicates.length > 0) {
          // Dla każdego duplikatu, zachowaj najnowszą wersję (z więcej danymi)
          duplicates.forEach(({existing, duplicate}) => {
            const existingTeamsCount = Array.isArray(existing.teams) ? existing.teams.length : 0;
            const duplicateTeamsCount = Array.isArray(duplicate.teams) ? duplicate.teams.length : 0;
            
            // Wybierz wersję z większą liczbą zespołów lub LW pozycją
            const shouldKeepDuplicate = 
              duplicateTeamsCount > existingTeamsCount || 
              (duplicate.position === 'LW' && existing.position === 'LS');
              
            if (shouldKeepDuplicate) {
              playersById.set(duplicate.id, duplicate);
            }
          });
        }
        
        // Konwertuj z powrotem na tablicę (bez duplikatów)
        const cleanedPlayersList = Array.from(playersById.values());
        
        // Normalizuj dane i usuń duplikaty - IDENTYCZNE z fetchPlayers
        const uniqueMap = new Map();
        cleanedPlayersList.forEach(player => {
          // Napraw format teams - upewnij się że teams to zawsze tablica
          let normalizedPlayer = { ...player };
          
          if (typeof normalizedPlayer.teams === 'string') {
            // Jeśli teams to string, zamień na tablicę
            normalizedPlayer.teams = [normalizedPlayer.teams];
          } else if (!Array.isArray(normalizedPlayer.teams)) {
            // Jeśli teams to null/undefined, ustaw pustą tablicę
            normalizedPlayer.teams = [];
          }
          
          uniqueMap.set(player.id, normalizedPlayer);
        });
        
        const cleanPlayers = Array.from(uniqueMap.values());
        
        // Wyczyść localStorage przed ustawieniem nowego stanu
        if (typeof window !== "undefined") {
          localStorage.removeItem("players");
        }
        
        // Zastąp cały stan danymi odświeżonymi
        setPlayers(cleanPlayers);
        playersRef.current = cleanPlayers; // Aktualizuj ref
        
        // Zapisz nowe dane do localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("players", JSON.stringify(cleanPlayers));
        }
      } else {
        console.log('📭 Brak zawodników w Firebase po odświeżeniu');
        setPlayers([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem("players");
        }
      }
    } catch (error) {
      console.error('❌ Błąd odświeżania danych:', error);
    } finally {
      setIsRefetching(false);
    }
  }, [isRefetching]);

  // Backup do localStorage tylko po zapisie (nie po każdej zmianie stanu)
  const saveToLocalStorage = useCallback((playersToSave: Player[]) => {
    if (typeof window !== "undefined" && playersToSave.length > 0) {
      try {
        localStorage.setItem("players", JSON.stringify(playersToSave));
        console.log('💾 Zapisano do localStorage jako backup');
      } catch (error) {
        console.error("❌ Błąd zapisu do localStorage:", error);
      }
    }
  }, []);

  // Usuwanie zawodnika
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    console.log('🗑️ Próba usunięcia zawodnika:', playerId);
    
    // Znajdź zawodnika w lokalnym stanie
    const playerToDelete = players.find(p => p.id === playerId);
    console.log('👤 Zawodnik do usunięcia:', playerToDelete ? getPlayerFullName(playerToDelete) : 'Nieznany');
    
    // USUNIĘTO KONFIRMACJĘ - będzie obsługiwana w komponencie
    try {
      setIsLoading(true);
      console.log('⏳ Usuwanie zawodnika z Firebase...');
      
      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        throw new Error("Firebase nie jest zainicjalizowane - dane zapisywane tylko lokalnie");
      }
      
      // Usuwanie z Firebase
      await deleteDoc(doc(db, "players", playerId));
      
      // Aktualizacja lokalnego stanu
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      return true;
    } catch (error) {
      console.error('Błąd usuwania zawodnika:', error);
      
      // Sprawdź typ błędu i pokaż odpowiedni komunikat
      let errorMessage = 'Wystąpił błąd podczas usuwania zawodnika.';
      if (error instanceof Error) {
        if (error.message.includes('offline') || error.message.includes('network')) {
          errorMessage = 'Brak połączenia z internetem. Spróbuj ponownie później.';
        } else if (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions')) {
          errorMessage = 'Brak uprawnień do usuwania zawodników. Sprawdź konfigurację Firebase.';
        } else if (error.message.includes('zainicjalizowane')) {
          errorMessage = 'Problem z inicjalizacją bazy danych. Odśwież stronę.';
        } else {
          errorMessage = `Błąd: ${error.message}`;
        }
      }
      
      alert(errorMessage + ' Spróbuj ponownie.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [players]);

  // Stan zabezpieczający przed wielokrotnym wywołaniem
  const [isSaving, setIsSaving] = useState(false);

  // Dodawanie/edycja zawodnika
  const handleSavePlayer = useCallback(
    async (playerData: Omit<Player, "id">) => {
      // Zabezpieczenie przed wielokrotnym wywołaniem
      if (isSaving) {
        return;
      }
      
      try {
        setIsSaving(true);
        setIsLoading(true);
        
        // Sprawdź czy Firebase jest dostępne
        if (!db) {
          throw new Error("Firebase nie jest zainicjalizowane");
        }
        
        // Walidacja danych
        if (!playerData.name || !playerData.name.trim()) {
          throw new Error("Imię i nazwisko są wymagane");
        }
        
        const isEditing = editingPlayerId !== null && editingPlayerId !== undefined;
        
        if (isEditing) {
          // EDYCJA - sprawdź czy dokument istnieje, jeśli nie - utwórz go
          const playerRef = doc(db, "players", editingPlayerId);
          
          // Sprawdź czy dokument istnieje
          const playerDoc = await getDoc(playerRef);
          
          // Przygotuj dane do zapisu (usuń undefined values)
                const updateData = Object.fromEntries(
                  Object.entries(playerData).filter(([_, value]) => value !== undefined)
                );
                
          if (playerDoc.exists()) {
            // Dokument istnieje - aktualizuj go
            await updateDoc(playerRef, updateData);
                  } else {
            // Dokument nie istnieje - utwórz go
            await setDoc(playerRef, updateData);
          }
          
        } else {
          // NOWY ZAWODNIK - dodaj nowego
          const addData = Object.fromEntries(
            Object.entries(playerData).filter(([_, value]) => value !== undefined)
          );
          
          // Dodaj do Firebase
          const newPlayerRef = await addDoc(collection(db, "players"), addData);
        }
        
        // Zamknij modal i resetuj stan edycji
        setIsModalOpen(false);
        setEditingPlayerId(null);
        setEditingPlayerData(null); // Wyczyść dane edytowanego zawodnika
        
        // Wyczyść localStorage przed odświeżeniem
        if (typeof window !== "undefined") {
          localStorage.removeItem("players");
        }
        
        // Po zapisie odśwież dane z serwera
        await refetchPlayers(true); // Wymuś odczyt z serwera
        
      } catch (error) {
        console.error('Błąd zapisywania zawodnika:', error);
        
        let errorMessage = 'Wystąpił błąd podczas zapisywania zawodnika.';
        if (error instanceof Error) {
          if (error.message.includes('offline') || error.message.includes('network')) {
            errorMessage = 'Brak połączenia z internetem. Spróbuj ponownie później.';
          } else if (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions')) {
            errorMessage = 'Brak uprawnień do zapisywania zawodników. Sprawdź konfigurację Firebase.';
          } else if (error.message.includes('wymagane')) {
            errorMessage = error.message;
          } else if (error.message.includes('zainicjalizowane')) {
            errorMessage = 'Problem z inicjalizacją bazy danych. Odśwież stronę.';
          } else {
            errorMessage = `Błąd: ${error.message}`;
          }
        }
        
        alert(errorMessage + ' Spróbuj ponownie.');
      } finally {
        setIsLoading(false);
        setIsSaving(false);
      }
    },
    [editingPlayerId, isSaving] // Usunięto players z dependencies żeby uniknąć niepotrzebnych re-renderów
  );

  const handleEditPlayer = useCallback(async (playerId: string) => {
    console.log('🔍 Próba edycji zawodnika z ID:', playerId);
    
    // Sprawdź czy zawodnik istnieje w lokalnym stanie
    const localPlayer = players.find(p => p.id === playerId);
    console.log('👤 Zawodnik w lokalnym stanie:', localPlayer ? 
      `${localPlayer.name} (ID: ${localPlayer.id})` : 'Nie znaleziono');
    
    try {
      // Pobierz najnowsze dane bezpośrednio z Firebase przed edycją
      if (!db) {
        console.error('Firebase nie jest dostępne');
        return;
      }
      
      console.log('🔥 Próba pobrania z Firebase ID:', playerId);
      const playerDoc = await getDoc(doc(db, "players", playerId));
      console.log('📄 Rezultat getDoc - exists():', playerDoc.exists());
      
      if (playerDoc.exists()) {
        const playerData = { id: playerDoc.id, ...playerDoc.data() } as Player;
        console.log('✅ Pobrano dane z Firebase:', playerData.name);
        
        setEditingPlayerId(playerId);
        setEditingPlayerData(playerData); // Ustaw świeże dane z Firebase
        setIsModalOpen(true);
      } else {
        console.error('❌ Zawodnik nie istnieje w Firebase - ID:', playerId);
        
        // Jeśli zawodnik istnieje lokalnie ale nie w Firebase, spróbuj go utworzyć
        if (localPlayer) {
          console.log('💾 Próba utworzenia zawodnika w Firebase z lokalnych danych');
          try {
            const { id, ...playerDataWithoutId } = localPlayer;
            await setDoc(doc(db, "players", playerId), playerDataWithoutId);
            console.log('✅ Utworzono zawodnika w Firebase');
            
            // Teraz spróbuj ponownie edytować
            setEditingPlayerId(playerId);
            setEditingPlayerData(localPlayer);
            setIsModalOpen(true);
          } catch (createError) {
            console.error('❌ Błąd tworzenia zawodnika w Firebase:', createError);
            alert('Nie można utworzyć zawodnika w bazie danych');
          }
        } else {
          alert('Zawodnik nie został znaleziony w bazie danych');
        }
      }
    } catch (error) {
      console.error('❌ Błąd pobierania zawodnika z Firebase:', error);
      alert('Błąd podczas pobierania danych zawodnika');
    }
  }, [players]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingPlayerId(null);
    setEditingPlayerData(null); // Wyczyść dane edytowanego zawodnika
  }, []);

  // Usunięto getEditingPlayer - teraz używamy editingPlayerData ze świeżymi danymi z Firebase

  return {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer: editingPlayerData, // Użyj świeżych danych z Firebase
    isLoading,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    refetchPlayers,
  };
}

