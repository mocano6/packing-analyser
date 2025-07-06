"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

  // Pobierz zawodników z nowej struktury teams/{teamId}/members/
  const fetchPlayersFromNewStructure = async (): Promise<Player[]> => {
    try {
      console.log('🔍 Próbuję pobrać z nowej struktury teams/{teamId}/members/...');
      
      // 1. Pobierz wszystkie zespoły
      const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
      
      if (teamsSnapshot.empty) {
        console.log('📭 Brak zespołów w bazie danych');
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
                    console.warn(`Nieprawidłowe dane membership dla dokumentu ${memberDoc.id} w zespole ${teamId}`);
                    return;
                  }
                  
                  const playerDoc = await getDoc(doc(getDB(), "players", membership.playerId));
                  
                  if (!playerDoc.exists()) {
                    console.warn(`Nie znaleziono zawodnika ${membership.playerId} w kolekcji players`);
                    return;
                  }
                  
                  const playerData = playerDoc.data();
                  
                  // Sprawdź czy playerData ma wymagane pola
                  if (!playerData || !playerData.firstName || !playerData.position) {
                    console.warn(`Nieprawidłowe dane zawodnika ${membership.playerId}:`, playerData);
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
                    position: playerData.position || 'CB',
                    number: membership.number,
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
      console.log(`✅ Pobrano ${playersList.length} zawodników z nowej struktury`);
      return playersList;
      
    } catch (error) {
      console.error('❌ Błąd pobierania z nowej struktury:', error);
      return [];
    }
  };

  // Pobierz zawodników ze starej struktury players.teams[]
  const fetchPlayersFromOldStructure = async (): Promise<Player[]> => {
    try {
      console.log('🔍 Próbuję pobrać ze starej struktury players.teams[]...');
      
      const playersSnapshot = await getDocs(collection(getDB(), "players"));
      
      if (playersSnapshot.empty) {
        console.log('📭 Brak zawodników w starej strukturze');
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

      console.log(`✅ Pobrano ${playersList.length} zawodników ze starej struktury`);
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
        console.warn('⚠️ Firebase nie jest zainicjalizowane');
        setPlayers([]);
        return;
      }

      // 1. Najpierw spróbuj nową strukturę
      let playersList = await fetchPlayersFromNewStructure();
      
      // 2. Jeśli nowa struktura jest pusta, użyj starej
      if (playersList.length === 0) {
        console.log('🔄 Nowa struktura pusta, używam starej struktury jako fallback');
        playersList = await fetchPlayersFromOldStructure();
      }
      
      setPlayers(playersList);
      playersRef.current = playersList;
      
      console.log(`✅ Łącznie pobrano ${playersList.length} zawodników`);
      
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
  }, [fetchAllPlayers]);

  // Funkcja do ponownego pobrania danych
  const refetchPlayers = useCallback(async () => {
    if (isRefetching) return;
    
    try {
      setIsRefetching(true);
      await fetchAllPlayers();
    } finally {
      setIsRefetching(false);
    }
  }, [fetchAllPlayers, isRefetching]);

  // Usuwanie zawodnika (obsługuje obie struktury)
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    console.log('🗑️ Próba usunięcia zawodnika:', playerId);
    
    const playerToDelete = players.find(p => p.id === playerId);
    console.log('👤 Zawodnik do usunięcia:', playerToDelete ? getPlayerFullName(playerToDelete) : 'Nieznany');
    
    try {
      setIsLoading(true);
      
      if (!getDB()) {
        throw new Error("Firebase nie jest zainicjalizowane");
      }
      
      // 1. Usuń z nowej struktury teams/{teamId}/members/
      try {
        const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
        
        await Promise.all(
          teamsSnapshot.docs.map(async (teamDoc) => {
            const teamId = teamDoc.id;
            try {
              const memberDoc = doc(getDB(), "teams", teamId, "members", playerId);
              const memberSnapshot = await getDoc(memberDoc);
              
              if (memberSnapshot.exists()) {
                await deleteDoc(memberDoc);
                console.log(`✅ Usunięto zawodnika z zespołu ${teamId} (nowa struktura)`);
              }
            } catch (error) {
              console.error(`Błąd usuwania z zespołu ${teamId}:`, error);
            }
          })
        );
      } catch (error) {
        console.log('ℹ️ Błąd usuwania z nowej struktury (prawdopodobnie nie istnieje):', error);
      }
      
      // 2. Usuń ze starej struktury players
      try {
        await deleteDoc(doc(getDB(), "players", playerId));
        console.log('✅ Usunięto zawodnika ze starej struktury');
      } catch (error) {
        console.error('❌ Błąd usuwania ze starej struktury:', error);
      }
      
      // 3. Aktualizuj lokalny stan
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      
      console.log('✅ Zawodnik usunięty pomyślnie');
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
        
        // Sprawdź czy istnieje nowa struktura (czy są jakieś zespoły)
        const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
        const hasNewStructure = !teamsSnapshot.empty;
        
        if (hasNewStructure) {
          console.log('💾 Zapisuję do nowej struktury');
          
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
          console.log('💾 Zapisuję do starej struktury');
          
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
        
        console.log('✅ Zawodnik zapisany pomyślnie');
        
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
    refetchPlayers
  };
} 