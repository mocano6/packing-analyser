"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Player } from "../types";
import { getDB } from "../lib/firebase";
import { getPlayerFullName } from '@/utils/playerUtils';
import { 
  collection, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, setDoc, getDoc
} from "firebase/firestore";
import { NewPlayer, TeamMembership } from "@/types/migration";

// Helper do generowania ID
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const NEW_STRUCTURE_CHECK_KEY = "players_new_structure_check";
const NEW_STRUCTURE_CHECK_TTL_MS = 6 * 60 * 60 * 1000;

const readNewStructureCheck = (): { checkedAt: number; hasNewStructure: boolean } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NEW_STRUCTURE_CHECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { checkedAt?: unknown; hasNewStructure?: unknown };
    const checkedAt = typeof parsed.checkedAt === "number" ? parsed.checkedAt : NaN;
    const hasNewStructure = typeof parsed.hasNewStructure === "boolean" ? parsed.hasNewStructure : null;
    if (!Number.isFinite(checkedAt) || hasNewStructure === null) return null;
    return { checkedAt, hasNewStructure };
  } catch {
    return null;
  }
};

const writeNewStructureCheck = (value: { checkedAt: number; hasNewStructure: boolean }) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NEW_STRUCTURE_CHECK_KEY, JSON.stringify(value));
  } catch {
    // Brak możliwości zapisu cache - pomijamy bez logowania
  }
};

/**
 * Hook do zarządzania zawodnikami z hybrydowym odczytem:
 * 1. Próbuje czytać z nowej struktury teams/{teamId}/members/
 * 2. Jeśli pusta, czyta ze starej struktury players.teams[]
 */
export function usePlayersState() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerData, setEditingPlayerData] = useState<Player | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const playersRef = useRef<Player[]>([]);
  const newStructureCheckRef = useRef<{ checkedAt: number; hasNewStructure: boolean } | null>(null);

  // Funkcja migracji zawodników z teams/members do players
  const migratePlayersFromTeamsToPlayers = async (): Promise<boolean> => {
    try {
      const playersFromNewStructure = await fetchPlayersFromNewStructure();
      const playersFromOldStructure = await fetchPlayersFromOldStructure();
      
      if (playersFromNewStructure.length === 0) {
        return true;
      }
      
              for (const player of playersFromNewStructure) {
          try {
            // Sprawdź czy zawodnik już istnieje w players
            const existingPlayer = playersFromOldStructure.find(p => p.id === player.id);
            
            if (existingPlayer) {
              // Sprawdź czy istniejący zawodnik ma prawidłowe pole teams
              const hasValidTeams = Array.isArray(existingPlayer.teams) && existingPlayer.teams.length > 0;
              
              if (hasValidTeams) {
                continue;
              }
            }
          
          // Dodaj do kolekcji players
          const playerData = {
            firstName: player.firstName || '',
            lastName: player.lastName || '',
            name: player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim(),
            birthYear: player.birthYear,
            imageUrl: player.imageUrl,
            position: player.position || 'CB',
            number: player.number || 0,
            teams: player.teams || [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
                      // Zapisz z tym samym ID (używaj setDoc żeby nadpisać istniejące dane)
            await setDoc(doc(getDB(), "players", player.id), playerData);
            
        } catch (error) {
          console.error(`❌ Błąd migracji zawodnika ${player.name}:`, error);
        }
      }
      return true;
      
    } catch (error) {
      console.error('❌ Błąd podczas migracji:', error);
      return false;
    }
  };

  // Pobierz zawodników z nowej struktury teams/{teamId}/members/
  const fetchPlayersFromNewStructure = async (): Promise<Player[]> => {
    try {

      
      // 1. Pobierz wszystkie zespoły
      const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
      
              if (teamsSnapshot.empty) {
          return [];
        }

      // 2. Pobierz członków z wszystkich zespołów
      const allPlayers = new Map<string, Player>();
      
      await Promise.all(
        teamsSnapshot.docs.map(async (teamDoc) => {
          const teamId = teamDoc.id;
          
          try {
            const membersSnapshot = await getDocs(collection(getDB(), "teams", teamId, "members"));
            
            await Promise.all(
              membersSnapshot.docs.map(async (memberDoc) => {
                try {
                  const membership = memberDoc.data() as TeamMembership;
                  
                  // Sprawdź czy membership ma wymagane pola
                  if (!membership.playerId || typeof membership.number !== 'number') {
                    return;
                  }
                  
                  const playerDoc = await getDoc(doc(getDB(), "players", membership.playerId));
                  
                  if (!playerDoc.exists()) {
                    return;
                  }
                  
                  const playerData = playerDoc.data();
                  
                  // Sprawdź czy playerData ma wymagane pola (bardziej elastyczna walidacja)
                  if (!playerData) {
                    return;
                  }
                  

                  
                  // Mniej restrykcyjna walidacja - nie wymagaj position
                  if (!playerData.firstName && !playerData.name) {
                    return;
                  }
                  
                  const existingPlayer = allPlayers.get(membership.playerId);
                  
                  const player: Player = {
                    id: membership.playerId,
                    firstName: playerData.firstName || '',
                    lastName: playerData.lastName || '',
                    name: playerData.name || `${playerData.firstName || ''} ${playerData.lastName || ''}`.trim(),
                    birthYear: playerData.birthYear,
                    imageUrl: playerData.imageUrl,
                    position: playerData.position || 'CB', // Domyślna pozycja jeśli brak
                    number: membership.number || 0, // Domyślny numer
                    teams: existingPlayer 
                      ? [...(existingPlayer.teams || []), teamId]
                      : [teamId]
                  };

                  
                  allPlayers.set(membership.playerId, player);
                  
                } catch (memberError) {
                  console.error(`Błąd przetwarzania członka ${memberDoc.id} w zespole ${teamId}:`, memberError);
                }
              })
            );
          } catch (teamError) {
            console.error(`Błąd przetwarzania zespołu ${teamId}:`, teamError);
          }
        })
      );
      
      const playersList = Array.from(allPlayers.values());
      
      return playersList;
      
    } catch (error) {
      console.error('❌ Błąd pobierania z nowej struktury:', error);
      return [];
    }
  };

  // Pobierz zawodników ze starej struktury players.teams[]
      const fetchPlayersFromOldStructure = async (): Promise<Player[]> => {
      try {
      
      const playersSnapshot = await getDocs(collection(getDB(), "players"));
      

      
              if (playersSnapshot.empty) {
          return [];
        }

             const playersList = playersSnapshot.docs.map(doc => {
         const data = doc.data() as Player;
         const { id, ...dataWithoutId } = data;
         const player = {
           id: doc.id,
           ...dataWithoutId
         };



         // Napraw format teams - upewnij się że teams to zawsze tablica
         if (typeof player.teams === 'string') {
           player.teams = [player.teams];
         } else if (!Array.isArray(player.teams)) {
           player.teams = [];
         }
         
         return player;
       }) as Player[];


      
      return playersList;
      
    } catch (error) {
      console.error('❌ Błąd pobierania ze starej struktury:', error);
      return [];
    }
  };

  // Główna funkcja pobierająca zawodników (hybrydowo)
  const fetchAllPlayers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!getDB()) {
        setPlayers([]);
        return;
      }

      // Sprawdź ile zawodników jest w każdej strukturze
      const playersFromOldStructure = await fetchPlayersFromOldStructure();
      const cachedCheck = newStructureCheckRef.current ?? readNewStructureCheck();
      const isRecentCheck = cachedCheck && (Date.now() - cachedCheck.checkedAt < NEW_STRUCTURE_CHECK_TTL_MS);
      const shouldCheckNewStructure = playersFromOldStructure.length === 0 || !isRecentCheck || cachedCheck?.hasNewStructure;
      const playersFromNewStructure = shouldCheckNewStructure ? await fetchPlayersFromNewStructure() : [];
      if (shouldCheckNewStructure) {
        const hasNewStructure = playersFromNewStructure.length > 0;
        const newCheck = { checkedAt: Date.now(), hasNewStructure };
        newStructureCheckRef.current = newCheck;
        writeNewStructureCheck(newCheck);
      }
      
      // Użyj starej struktury, ale pokaż informacje o nowej
      let playersList = playersFromOldStructure;
      
      if (playersFromNewStructure.length > 0 && playersFromOldStructure.length === 0) {
        // Automatyczna migracja
        const migrationSuccess = await migratePlayersFromTeamsToPlayers();
        
        if (migrationSuccess) {
          // Po migracji pobierz ponownie ze starej struktury
          const playersAfterMigration = await fetchPlayersFromOldStructure();
          playersList = playersAfterMigration;
        } else {
          // Jeśli migracja się nie udała, użyj tymczasowo nowej struktury
          playersList = playersFromNewStructure;
        }
      } else if (playersFromNewStructure.length > 0 && playersFromOldStructure.length > 0) {
        // Automatyczna migracja pozostałych zawodników z teams/members
        const migrationSuccess = await migratePlayersFromTeamsToPlayers();
        
        if (migrationSuccess) {
          // Po migracji pobierz ponownie ze starej struktury (teraz powinni być wszyscy)
          const playersAfterMigration = await fetchPlayersFromOldStructure();
          playersList = playersAfterMigration;
        } else {
          // Jeśli migracja się nie udała, scal ręcznie (bez duplikatów)
          const combinedPlayers = [...playersFromOldStructure];
          
          // Dodaj zawodników z nowej struktury którzy nie istnieją w starej
          playersFromNewStructure.forEach(newPlayer => {
            const existsInOld = playersFromOldStructure.some(oldPlayer => oldPlayer.id === newPlayer.id);
            if (!existsInOld) {
              combinedPlayers.push(newPlayer);
            }
          });
          
          playersList = combinedPlayers;
        }
      }
      

      
      setPlayers(playersList);
      playersRef.current = playersList;
      
    } catch (error) {
      console.error('❌ Błąd pobierania zawodników:', error);
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pobierz dane podczas inicjalizacji
  useEffect(() => {
    fetchAllPlayers();
  }, []);

  // Funkcja do ponownego pobrania danych
  const refetchPlayers = useCallback(async () => {
    if (isRefetching) return;
    
    try {
      setIsRefetching(true);
      await fetchAllPlayers();
    } finally {
      setIsRefetching(false);
    }
  }, [isRefetching]); // eslint-disable-line react-hooks/exhaustive-deps

  // Usuwanie zawodnika (obsługuje obie struktury)
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    const playerToDelete = players.find(p => p.id === playerId);
    
    try {
      setIsLoading(true);
      
      if (!getDB()) {
        throw new Error("Firebase nie jest zainicjalizowane");
      }
      
      // Usuń tylko ze starej struktury players (z polem teams)
        await deleteDoc(doc(getDB(), "players", playerId));
      
              // Aktualizuj lokalny stan
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      return true;
      
    } catch (error) {
      console.error('❌ Błąd usuwania zawodnika:', error);
      
      let errorMessage = 'Wystąpił błąd podczas usuwania zawodnika.';
      if (error instanceof Error) {
        if (error.message.includes('offline') || error.message.includes('network')) {
          errorMessage = 'Brak połączenia z internetem. Spróbuj ponownie później.';
        } else if (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions')) {
          errorMessage = 'Brak uprawnień do usuwania zawodników. Sprawdź konfigurację Firebase.';
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

  // Dodawanie/edycja zawodnika (zapisuje do nowej struktury jeśli istnieje, inaczej do starej)
  const handleSavePlayer = useCallback(
    async (playerData: Omit<Player, "id">) => {
      if (isSaving) return;
      
      try {
        setIsSaving(true);
        setIsLoading(true);
        
        if (!getDB()) {
          throw new Error("Firebase nie jest zainicjalizowane");
        }
        
        // Walidacja danych
        if (!playerData.name || !playerData.name.trim()) {
          throw new Error("Imię i nazwisko są wymagane");
        }
        
        const isEditing = editingPlayerId !== null && editingPlayerId !== undefined;
        const now = new Date();
        
        // ZAWSZE używaj starej struktury (players z polem teams)
        const hasNewStructure = false; // Wymuś użycie starej struktury
        
        if (hasNewStructure) {
          // Ten kod nie będzie wykonywany - pozostawiam dla dokumentacji
          
          if (isEditing) {
            // EDYCJA w nowej strukturze
            const updatedPlayerData = {
              firstName: playerData.firstName || playerData.name.split(' ')[0],
              lastName: playerData.lastName || playerData.name.split(' ').slice(1).join(' '),
              name: playerData.name,
              birthYear: playerData.birthYear,
              imageUrl: playerData.imageUrl,
              position: playerData.position,
              updatedAt: now
            };
            
            await updateDoc(doc(getDB(), "players", editingPlayerId), updatedPlayerData);
            
            const teams = Array.isArray(playerData.teams) ? playerData.teams : [playerData.teams].filter(Boolean);
            
            if (teams.length > 0 && playerData.number) {
              await Promise.all(
                teams.map(async (teamId) => {
                  try {
                    const memberDoc = doc(getDB(), "teams", teamId, "members", editingPlayerId);
                    const memberSnapshot = await getDoc(memberDoc);
                    
                    if (memberSnapshot.exists()) {
                      await updateDoc(memberDoc, {
                        number: playerData.number,
                        notes: `Zaktualizowano ${now.toISOString()}`
                      });
                    } else {
                      const newMembership: TeamMembership = {
                        playerId: editingPlayerId,
                        number: playerData.number,
                        joinDate: now,
                        status: 'active',
                        notes: `Dodano do zespołu ${now.toISOString()}`
                      };
                      
                      await setDoc(memberDoc, newMembership);
                    }
                  } catch (error) {
                    console.error(`Błąd aktualizacji membership w zespole ${teamId}:`, error);
                  }
                })
              );
            }
            
            const { id: _, ...playerDataWithoutId } = playerData as any;
            
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === editingPlayerId
                  ? {
                      ...p,
                      ...playerDataWithoutId,
                      id: editingPlayerId
                    }
                  : p
              )
            );
            
          } else {
            // DODAWANIE w nowej strukturze
            const newPlayerData = {
              firstName: playerData.firstName || playerData.name.split(' ')[0],
              lastName: playerData.lastName || playerData.name.split(' ').slice(1).join(' '),
              name: playerData.name,
              birthYear: playerData.birthYear,
              imageUrl: playerData.imageUrl,
              position: playerData.position,
              createdAt: now,
              updatedAt: now
            };
            
            const playerRef = await addDoc(collection(getDB(), "players"), newPlayerData);
            const newPlayerId = playerRef.id;
            
            const teams = Array.isArray(playerData.teams) ? playerData.teams : [playerData.teams].filter(Boolean);
            
            if (teams.length > 0 && playerData.number) {
              await Promise.all(
                teams.map(async (teamId) => {
                  try {
                    const newMembership: TeamMembership = {
                      playerId: newPlayerId,
                      number: playerData.number,
                      joinDate: now,
                      status: 'active',
                      notes: `Dodano ${now.toISOString()}`
                    };
                    
                    await setDoc(doc(getDB(), "teams", teamId, "members", newPlayerId), newMembership);
                  } catch (error) {
                    console.error(`Błąd dodawania membership w zespole ${teamId}:`, error);
                  }
                })
              );
            }
            
                                     const { id: _, ...playerDataWithoutId } = playerData as any;
            const newPlayer: Player = {
              id: newPlayerId,
              ...playerDataWithoutId,
            };
            
            setPlayers((prev) => [...prev, newPlayer]);
          }
          
        } else {
          // Zapisuj do starej struktury
          
          // STARA STRUKTURA - zapisz bezpośrednio do players
          if (isEditing) {
            const updateData = Object.fromEntries(
              Object.entries(playerData).filter(([_, value]) => value !== undefined)
            );
            
            await updateDoc(doc(getDB(), "players", editingPlayerId), updateData);
            
            const { id: _, ...playerDataWithoutId } = playerData as any;
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === editingPlayerId
                  ? { ...p, ...playerDataWithoutId, id: editingPlayerId }
                  : p
              )
            );
          } else {
            const playerRef = await addDoc(collection(getDB(), "players"), {
              ...playerData,
              teams: Array.isArray(playerData.teams) ? playerData.teams : [playerData.teams].filter(Boolean),
            });
            
                         const { id, ...playerDataWithoutId } = playerData as any;
             const newPlayer: Player = {
               id: playerRef.id,
               ...playerDataWithoutId,
             };
            
            setPlayers((prev) => [...prev, newPlayer]);
          }
        }
        
        // Zamknij modal
        setIsModalOpen(false);
        setEditingPlayerId(null);
        setEditingPlayerData(null);
        

        
      } catch (error) {
        console.error('❌ Błąd zapisywania zawodnika:', error);
        
        let errorMessage = 'Wystąpił błąd podczas zapisywania zawodnika.';
        if (error instanceof Error) {
          if (error.message.includes('wymagane')) {
            errorMessage = error.message;
          } else if (error.message.includes('offline') || error.message.includes('network')) {
            errorMessage = 'Brak połączenia z internetem. Spróbuj ponownie później.';
          } else if (error.message.includes('permission')) {
            errorMessage = 'Brak uprawnień do zapisywania zawodników. Sprawdź konfigurację Firebase.';
          }
        }
        
        alert(errorMessage + ' Spróbuj ponownie.');
      } finally {
        setIsSaving(false);
        setIsLoading(false);
      }
    },
    [editingPlayerId, isSaving]
  );

  // Funkcja do edycji zawodnika
  const handleEditPlayer = useCallback(async (playerId: string) => {
    setEditingPlayerId(playerId);
    
    try {
      // Pobierz dane z aktualnego stanu (już znormalizowane)
      const existingPlayer = players.find(p => p.id === playerId);
      
      if (existingPlayer) {
        setEditingPlayerData(existingPlayer);
      } else {
        // Fallback - pobierz bezpośrednio z Firebase
        const playerDoc = await getDoc(doc(getDB(), "players", playerId));
        if (playerDoc.exists()) {
          const playerData = playerDoc.data() as Player;
          const { id: _, ...playerDataWithoutId } = playerData as any;
          const editingPlayer: Player = {
            id: playerId,
            ...playerDataWithoutId,
            teams: Array.isArray(playerData.teams) ? playerData.teams : [playerData.teams].filter(Boolean)
          };
          
          setEditingPlayerData(editingPlayer);
        }
      }
    } catch (error) {
      console.error('❌ Błąd pobierania danych zawodnika do edycji:', error);
    }
    
    setIsModalOpen(true);
  }, [players]);

  // Zamknij modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingPlayerId(null);
    setEditingPlayerData(null);
  }, []);

  return {
    players,
    isModalOpen,
    editingPlayerId,
    editingPlayer: editingPlayerData,
    isLoading,
    setIsModalOpen,
    handleDeletePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    refetchPlayers,
    migratePlayersFromTeamsToPlayers // Eksport funkcji migracji dla ręcznego użycia
  };
} 