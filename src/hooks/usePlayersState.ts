// src/hooks/usePlayersState.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { Player } from "../types";
import { db } from "../lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, query, where, writeBatch, setDoc, getDoc 
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
  const [isLoading, setIsLoading] = useState(true);

  // Pobierz zawodników z Firebase podczas inicjalizacji
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Pobieranie zawodników z Firebase...');
        
        // Sprawdź czy Firebase jest dostępne
        if (!db) {
          console.warn('⚠️ Firebase nie jest zainicjalizowane - używam localStorage');
          // Sprawdź localStorage jako fallback
          if (typeof window !== "undefined") {
            try {
              const savedPlayers = localStorage.getItem("players");
              if (savedPlayers) {
                const localPlayers = JSON.parse(savedPlayers) as Player[];
                console.log('📦 Załadowano zawodników z localStorage:', localPlayers.length);
                setPlayers(localPlayers);
              } else {
                console.log('📭 Brak zawodników w localStorage');
                setPlayers([]);
              }
            } catch (error) {
              console.error("❌ Błąd odczytu z localStorage:", error);
              setPlayers([]);
            }
          }
          return;
        }
        
        const playersCollection = collection(db, "players");
        const playersSnapshot = await getDocs(playersCollection);
        
        if (!playersSnapshot.empty) {
          const playersList = playersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Player[];
          
          console.log('✅ Zawodnicy pobrani z Firebase:', playersList.length);
          setPlayers(playersList);
        } else {
          console.log('📋 Brak zawodników w Firebase - sprawdzam localStorage');
          
          // Sprawdź dane w localStorage jako fallback
          if (typeof window !== "undefined") {
            try {
              const savedPlayers = localStorage.getItem("players");
              if (savedPlayers) {
                const localPlayers = JSON.parse(savedPlayers) as Player[];
                console.log('📦 Znaleziono zawodników w localStorage:', localPlayers.length);
                setPlayers(localPlayers);
                
                // Opcjonalnie zapisz dane z localStorage do Firebase
                if (localPlayers.length > 0 && db) {
                  console.log('⬆️ Synchronizuję zawodników z localStorage do Firebase...');
                  const batch = writeBatch(db);
                  
                  localPlayers.forEach(player => {
                    const playerRef = doc(collection(db!, "players"));
                    batch.set(playerRef, {
                      name: player.name,
                      number: player.number,
                      position: player.position || "",
                      birthYear: player.birthYear,
                      imageUrl: player.imageUrl || "",
                      teams: player.teams || []
                    });
                  });
                  
                  await batch.commit();
                  console.log('✅ Zawodnicy z localStorage zapisani do Firebase');
                  
                  // Odśwież dane z Firebase po synchronizacji
                  const updatedSnapshot = await getDocs(playersCollection);
                  const updatedPlayersList = updatedSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as Player[];
                  setPlayers(updatedPlayersList);
                }
              } else {
                console.log('📭 Brak zawodników zarówno w Firebase jak i localStorage');
                setPlayers([]);
              }
            } catch (error) {
              console.error("❌ Błąd odczytu z localStorage:", error);
              setPlayers([]);
            }
          }
        }
      } catch (error) {
        console.error('❌ Błąd pobierania zawodników z Firebase:', error);
        
        // Sprawdź localStorage jako fallback przy błędzie Firebase
        if (typeof window !== "undefined") {
          try {
            const savedPlayers = localStorage.getItem("players");
            if (savedPlayers) {
              const localPlayers = JSON.parse(savedPlayers) as Player[];
              console.log('🆘 Używam danych z localStorage jako fallback:', localPlayers.length);
              setPlayers(localPlayers);
            }
          } catch (localError) {
            console.error("❌ Błąd fallback z localStorage:", localError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  // Backup do localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && players.length > 0) {
      try {
        localStorage.setItem("players", JSON.stringify(players));
        console.log('💾 Zawodnicy zapisani do localStorage');
      } catch (error) {
        console.error("❌ Błąd zapisu do localStorage:", error);
      }
    }
  }, [players]);

  // Usuwanie zawodnika
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    console.log('🗑️ Próba usunięcia zawodnika:', playerId);
    
    // Znajdź zawodnika w lokalnym stanie
    const playerToDelete = players.find(p => p.id === playerId);
    console.log('👤 Zawodnik do usunięcia:', playerToDelete?.name || 'Nieznany');
    
    if (
      typeof window !== "undefined" &&
      window.confirm(`Czy na pewno chcesz usunąć zawodnika ${playerToDelete?.name || playerId}?`)
    ) {
      try {
        setIsLoading(true);
        console.log('⏳ Usuwanie zawodnika z Firebase...');
        
        // Sprawdź czy Firebase jest dostępne
        if (!db) {
          throw new Error("Firebase nie jest zainicjalizowane - dane zapisywane tylko lokalnie");
        }
        
        // Dodatkowe logowanie stanu Firebase
        console.log('🔗 Stan połączenia Firebase:', {
          dbAvailable: !!db,
          windowDefined: typeof window !== 'undefined',
          playersInState: players.length
        });
        
        // Usuwanie z Firebase
        await deleteDoc(doc(db, "players", playerId));
        console.log('✅ Zawodnik usunięty z Firebase');
        
        // Aktualizacja lokalnego stanu
        setPlayers((prev) => {
          const updated = prev.filter((p) => p.id !== playerId);
          console.log('🔄 Zaktualizowano lokalny stan:', {
            bylo: prev.length,
            jest: updated.length,
            usunieto: prev.length - updated.length
          });
          return updated;
        });
        
        console.log('✅ Zawodnik usunięty pomyślnie');
        return true;
      } catch (error) {
        console.error('❌ Błąd usuwania zawodnika:', error);
        console.error('🔍 Szczegóły błędu:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
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
    }
    
    console.log('🚫 Usuwanie anulowane przez użytkownika');
    return false;
  }, [players]);

  // Dodawanie/edycja zawodnika
  const handleSavePlayer = useCallback(
    async (playerData: Omit<Player, "id">) => {
      console.log('💾 Próba zapisania zawodnika:', playerData);
      console.log('🔧 Tryb edycji:', editingPlayerId ? `Edycja ID: ${editingPlayerId}` : 'Nowy zawodnik');
      
      try {
        setIsLoading(true);
        
        // Sprawdź czy Firebase jest dostępne
        if (!db) {
          throw new Error("Firebase nie jest zainicjalizowane - dane zapisywane tylko lokalnie");
        }
        
        // Walidacja danych
        if (!playerData.name || !playerData.name.trim()) {
          throw new Error("Imię i nazwisko są wymagane");
        }
        
        // Dodatkowe logowanie stanu Firebase
        console.log('🔗 Stan połączenia Firebase:', {
          dbAvailable: !!db,
          windowDefined: typeof window !== 'undefined'
        });
        
        if (editingPlayerId) {
          console.log('✏️ Aktualizacja istniejącego zawodnika:', editingPlayerId);
          
          // Aktualizacja istniejącego zawodnika
          const playerRef = doc(db, "players", editingPlayerId);
          
          // Przygotuj dane do aktualizacji (usuń undefined values)
          const updateData = Object.fromEntries(
            Object.entries(playerData).filter(([_, value]) => value !== undefined)
          );
          
          console.log('📝 Dane do aktualizacji:', updateData);
          
          await updateDoc(playerRef, updateData);
          console.log('✅ Zawodnik zaktualizowany w Firebase');
          
          // Aktualizacja lokalnego stanu
          setPlayers((prev) => {
            const updated = prev.map((player) =>
              player.id === editingPlayerId
                ? { ...player, ...playerData, id: editingPlayerId }
                : player
            );
            console.log('🔄 Zaktualizowano lokalny stan zawodnika, łącznie zawodników:', updated.length);
            return updated;
          });
        } else {
          console.log('➕ Dodawanie nowego zawodnika');
          
          // Przygotuj dane do dodania (usuń undefined values)
          const addData = Object.fromEntries(
            Object.entries(playerData).filter(([_, value]) => value !== undefined)
          );
          
          console.log('📝 Dane do dodania:', addData);
          
          // Dodawanie nowego zawodnika
          const newPlayerRef = await addDoc(collection(db, "players"), addData);
          console.log('✅ Nowy zawodnik dodany do Firebase z ID:', newPlayerRef.id);
          
          // Aktualizacja lokalnego stanu
          const newPlayer: Player = {
            id: newPlayerRef.id,
            ...playerData,
          };
          setPlayers((prev) => {
            const updated = [...prev, newPlayer];
            console.log('🔄 Dodano zawodnika do lokalnego stanu, łącznie zawodników:', updated.length);
            return updated;
          });
        }
        
        // Zamknij modal i resetuj stan edycji
        setIsModalOpen(false);
        setEditingPlayerId(null);
        console.log('✅ Zawodnik zapisany pomyślnie - modal zamknięty');
        
      } catch (error) {
        console.error('❌ Błąd zapisywania zawodnika:', error);
        console.error('🔍 Szczegóły błędu:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Sprawdź typ błędu i pokaż odpowiedni komunikat
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
      }
    },
    [editingPlayerId]
  );

  const handleEditPlayer = useCallback((playerId: string) => {
    console.log('✏️ Rozpoczęcie edycji zawodnika:', playerId);
    setEditingPlayerId(playerId);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    console.log('❌ Zamykanie modalu edycji zawodnika');
    setIsModalOpen(false);
    setEditingPlayerId(null);
  }, []);

  // Funkcja pomocnicza do pobrania edytowanego gracza
  const getEditingPlayer = useCallback(() => {
    if (!editingPlayerId) return null;
    return players.find((p) => p.id === editingPlayerId) || null;
  }, [players, editingPlayerId]);

  // Funkcja diagnostyczna do sprawdzania połączenia z Firebase
  const testConnection = useCallback(async () => {
    console.log('🔧 Testowanie połączenia z Firebase...');
    
    try {
      console.log('🔗 Stan środowiska:', {
        window: typeof window !== 'undefined',
        db: !!db,
        firebaseConfig: {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Ustawiony' : '❌ Brak',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Ustawiony' : '❌ Brak',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Ustawiony' : '❌ Brak',
        }
      });

      // Sprawdź czy Firebase jest dostępne
      if (!db) {
        throw new Error("Firebase nie jest zainicjalizowane");
      }

      // Sprawdź podstawowe operacje na Firebase
      const testDoc = doc(collection(db, "permission_tests"));
      
      console.log('📝 Test zapisu do Firebase...');
      await setDoc(testDoc, {
        timestamp: new Date().toISOString(),
        test: 'connection_test',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
      });
      console.log('✅ Test zapisu zakończony sukcesem');
      
      console.log('📖 Test odczytu z Firebase...');
      const testRead = await getDoc(testDoc);
      if (testRead.exists()) {
        console.log('✅ Test odczytu zakończony sukcesem:', testRead.data());
      } else {
        console.warn('⚠️ Dokument testowy nie istnieje');
      }
      
      console.log('🗑️ Test usuwania z Firebase...');
      await deleteDoc(testDoc);
      console.log('✅ Test usuwania zakończony sukcesem');
      
      return { success: true, message: 'Wszystkie testy Firebase zakończone sukcesem' };
      
    } catch (error) {
      console.error('❌ Błąd podczas testowania Firebase:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? {
          name: error.name,
          stack: error.stack
        } : undefined
      };
    }
  }, []);

  return {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer: getEditingPlayer(),
    isLoading,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    testConnection,
  };
}
