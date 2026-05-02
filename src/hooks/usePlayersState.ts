"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Player } from "../types";
import { getAuthClient, getDB } from "../lib/firebase";
import { getPlayerFullName } from '@/utils/playerUtils';
import { 
  collection, getDocs, addDoc, updateDoc,
  doc, setDoc, getDoc
} from "@/lib/firestoreWithMetrics";
import { getCachedWithTimestamp, setCached, invalidateCache, CACHE_KEYS } from "@/lib/sessionCache";
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
const PLAYERS_CACHE_TTL_MS = 10 * 60 * 1000;

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

/** Jedno wspólne żądanie ładowania listy – deduplikacja przy Strict Mode / wielu instancjach hooka. */
let playersFetchInFlight: Promise<Player[]> | null = null;

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
  const cachedPlayersRef = useRef<{ data: Player[]; ts: number } | null>(null);

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
                  if (playerData.isDeleted === true) {
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
       }).filter(player => player.isDeleted !== true) as Player[];


      
      return playersList;
      
    } catch (error) {
      console.error('❌ Błąd pobierania ze starej struktury:', error);
      return [];
    }
  };

  // Główna funkcja pobierająca zawodników (hybrydowo)
  const fetchAllPlayers = useCallback(async () => {
    if (!getDB()) {
      setPlayers([]);
      setIsLoading(false);
      return;
    }

    const cached = getCachedWithTimestamp<Player[]>(CACHE_KEYS.PLAYERS_LIST, PLAYERS_CACHE_TTL_MS);
    // Pusta tablica jest truthy — bez tego warunku nigdy nie odczytamy zawodników z Firestore.
    if (Array.isArray(cached?.data) && cached.data.length > 0) {
      setPlayers(cached.data);
      playersRef.current = cached.data;
      setIsLoading(false);
      return;
    }

    if (playersFetchInFlight) {
      try {
        setIsLoading(true);
        const list = await playersFetchInFlight;
        setPlayers(list);
        playersRef.current = list;
      } catch {
        setPlayers([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    const doFetch = async (): Promise<Player[]> => {
      try {
        const playersFromOldStructure = await fetchPlayersFromOldStructure();
        const shouldCheckNewStructure = playersFromOldStructure.length === 0;
        const playersFromNewStructure = shouldCheckNewStructure ? await fetchPlayersFromNewStructure() : [];
        if (shouldCheckNewStructure) {
          const hasNewStructure = playersFromNewStructure.length > 0;
          const newCheck = { checkedAt: Date.now(), hasNewStructure };
          newStructureCheckRef.current = newCheck;
          writeNewStructureCheck(newCheck);
        }

        let playersList = playersFromOldStructure;

        if (playersFromNewStructure.length > 0 && playersFromOldStructure.length === 0) {
          const migrationSuccess = await migratePlayersFromTeamsToPlayers();
          if (migrationSuccess) {
            const playersAfterMigration = await fetchPlayersFromOldStructure();
            playersList = playersAfterMigration;
          } else {
            playersList = playersFromNewStructure;
          }
        } else if (playersFromNewStructure.length > 0 && playersFromOldStructure.length > 0) {
          const migrationSuccess = await migratePlayersFromTeamsToPlayers();
          if (migrationSuccess) {
            const playersAfterMigration = await fetchPlayersFromOldStructure();
            playersList = playersAfterMigration;
          } else {
            const combinedPlayers = [...playersFromOldStructure];
            playersFromNewStructure.forEach(newPlayer => {
              const existsInOld = playersFromOldStructure.some(oldPlayer => oldPlayer.id === newPlayer.id);
              if (!existsInOld) combinedPlayers.push(newPlayer);
            });
            playersList = combinedPlayers;
          }
        }

        setCached(CACHE_KEYS.PLAYERS_LIST, playersList);
        return playersList;
      } catch (error) {
        console.error('❌ Błąd pobierania zawodników:', error);
        return [];
      } finally {
        playersFetchInFlight = null;
      }
    };

    playersFetchInFlight = doFetch();
    try {
      const list = await playersFetchInFlight;
      setPlayers(list);
      playersRef.current = list;
    } catch {
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
      cachedPlayersRef.current = null;
      await fetchAllPlayers();
    } finally {
      setIsRefetching(false);
    }
  }, [isRefetching]); // eslint-disable-line react-hooks/exhaustive-deps

  // Usuwanie zawodnika — najpierw API (Admin SDK), przy braku klucza serwera fallback na zapis klienta
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    const applyLocalRemoval = () => {
      invalidateCache(CACHE_KEYS.PLAYERS_LIST);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      cachedPlayersRef.current = {
        data: playersRef.current.filter((p) => p.id !== playerId),
        ts: Date.now(),
      };
    };

    try {
      if (!getDB()) {
        throw new Error("Firebase nie jest zainicjalizowane");
      }

      const authUser = getAuthClient().currentUser;
      if (authUser) {
        try {
          const token = await authUser.getIdToken();
          const res = await fetch("/api/players-soft-delete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ playerId }),
          });
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
            success?: boolean;
          };

          if (res.ok && payload.success) {
            applyLocalRemoval();
            return true;
          }

          if (res.status === 503 && payload.code === "admin-config-missing") {
            // lokalnie bez service account — próba bezpośrednio z klienta
          } else {
            const msg =
              typeof payload.error === "string" && payload.error
                ? payload.error
                : `Nie udało się usunąć (${res.status}).`;
            alert(`${msg} Spróbuj ponownie.`);
            return false;
          }
        } catch (fetchErr) {
          console.warn("[handleDeletePlayer] API:", fetchErr);
        }
      }

      await updateDoc(doc(getDB(), "players", playerId), { isDeleted: true });
      applyLocalRemoval();
      return true;
    } catch (error) {
      console.error("❌ Błąd usuwania zawodnika:", error);

      let errorMessage = "Wystąpił błąd podczas usuwania zawodnika.";
      if (error instanceof Error) {
        if (error.message.includes("offline") || error.message.includes("network")) {
          errorMessage = "Brak połączenia z internetem. Spróbuj ponownie później.";
        } else if (
          error.message.includes("permission") ||
          error.message.includes("insufficient permissions") ||
          (typeof (error as { code?: string }).code === "string" &&
            (error as { code?: string }).code === "permission-denied")
        ) {
          errorMessage =
            "Brak uprawnień do usuwania zawodników (sprawdź reguły Firestore lub ustaw FIREBASE_SERVICE_ACCOUNT_KEY na serwerze).";
        }
      }

      alert(errorMessage + " Spróbuj ponownie.");
      return false;
    }
  }, []);

  // Przywracanie zawodnika (soft delete → aktywny)
  const handleRestorePlayer = useCallback(async (playerId: string) => {
    try {
      if (!getDB()) {
        throw new Error("Firebase nie jest zainicjalizowane");
      }
      await updateDoc(doc(getDB(), "players", playerId), { isDeleted: false });
      invalidateCache(CACHE_KEYS.PLAYERS_LIST);
      void fetchAllPlayers();
      return true;
    } catch (error) {
      console.error('❌ Błąd przywracania zawodnika:', error);
      const msg = error instanceof Error ? error.message : 'Wystąpił błąd podczas przywracania zawodnika.';
      alert(msg + ' Spróbuj ponownie.');
      return false;
    }
  }, [fetchAllPlayers]);

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
            cachedPlayersRef.current = {
              data: playersRef.current.map((p) =>
                p.id === editingPlayerId
                  ? { ...p, ...playerDataWithoutId, id: editingPlayerId }
                  : p
              ),
              ts: Date.now(),
            };
            
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
            cachedPlayersRef.current = {
              data: [...playersRef.current, newPlayer],
              ts: Date.now(),
            };
          }
          
        } else {
          // Zapisuj do starej struktury — najpierw API (Admin SDK), przy braku klucza serwera fallback na klienta
          if (isEditing) {
            const updateData = Object.fromEntries(
              Object.entries(playerData).filter(([_, value]) => value !== undefined)
            );

            let savedViaApi = false;
            let saveApiFatal: Error | null = null;
            const authUserSave = getAuthClient().currentUser;
            if (authUserSave) {
              try {
                const res = await fetch("/api/players-save", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await authUserSave.getIdToken()}`,
                  },
                  body: JSON.stringify({
                    action: "update",
                    playerId: editingPlayerId,
                    data: updateData,
                  }),
                });
                const payload = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  code?: string;
                  success?: boolean;
                };
                if (res.ok && payload.success) {
                  savedViaApi = true;
                } else if (!(res.status === 503 && payload.code === "admin-config-missing")) {
                  saveApiFatal = new Error(
                    typeof payload.error === "string" && payload.error
                      ? payload.error
                      : `Zapis nie powiódł się (${res.status}).`,
                  );
                }
              } catch (e) {
                console.warn("[handleSavePlayer] API update (np. sieć):", e);
              }
            }

            if (saveApiFatal) {
              throw saveApiFatal;
            }
            if (!savedViaApi) {
              await updateDoc(doc(getDB(), "players", editingPlayerId), updateData);
            }

            invalidateCache(CACHE_KEYS.PLAYERS_LIST);
            const { id: _, ...playerDataWithoutId } = playerData as any;
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === editingPlayerId
                  ? { ...p, ...playerDataWithoutId, id: editingPlayerId }
                  : p
              )
            );
            cachedPlayersRef.current = {
              data: playersRef.current.map((p) =>
                p.id === editingPlayerId
                  ? { ...p, ...playerDataWithoutId, id: editingPlayerId }
                  : p
              ),
              ts: Date.now(),
            };
          } else {
            const createPayload = {
              ...playerData,
              teams: Array.isArray(playerData.teams)
                ? playerData.teams
                : [playerData.teams].filter(Boolean),
            };

            let newPlayerId: string | null = null;
            let createApiFatal: Error | null = null;
            const authUserCreate = getAuthClient().currentUser;
            if (authUserCreate) {
              try {
                const res = await fetch("/api/players-save", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await authUserCreate.getIdToken()}`,
                  },
                  body: JSON.stringify({
                    action: "create",
                    data: createPayload,
                  }),
                });
                const payload = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  code?: string;
                  success?: boolean;
                  playerId?: string;
                };
                if (res.ok && payload.success && typeof payload.playerId === "string") {
                  newPlayerId = payload.playerId;
                } else if (!(res.status === 503 && payload.code === "admin-config-missing")) {
                  createApiFatal = new Error(
                    typeof payload.error === "string" && payload.error
                      ? payload.error
                      : `Zapis nie powiódł się (${res.status}).`,
                  );
                }
              } catch (e) {
                console.warn("[handleSavePlayer] API create (np. sieć):", e);
              }
            }

            if (createApiFatal) {
              throw createApiFatal;
            }
            if (newPlayerId === null) {
              const playerRef = await addDoc(collection(getDB(), "players"), createPayload);
              newPlayerId = playerRef.id;
            }

            invalidateCache(CACHE_KEYS.PLAYERS_LIST);
            const { id, ...playerDataWithoutId } = playerData as any;
            const newPlayer: Player = {
              id: newPlayerId,
              ...playerDataWithoutId,
            };

            setPlayers((prev) => [...prev, newPlayer]);
            cachedPlayersRef.current = {
              data: [...playersRef.current, newPlayer],
              ts: Date.now(),
            };
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
          } else if (
            error.message.includes('permission') ||
            error.message.includes('insufficient permissions') ||
            (typeof (error as { code?: string }).code === 'string' &&
              (error as { code?: string }).code === 'permission-denied')
          ) {
            errorMessage = 'Brak uprawnień do zapisywania zawodników. Sprawdź konfigurację Firebase.';
          } else {
            errorMessage = error.message;
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
    handleRestorePlayer,
    handleSavePlayer,
    handleEditPlayer,
    closeModal,
    refetchPlayers,
    migratePlayersFromTeamsToPlayers // Eksport funkcji migracji dla ręcznego użycia
  };
} 