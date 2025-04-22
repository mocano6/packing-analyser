import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, where 
} from "firebase/firestore";

export interface Player {
  id: string;
  name: string;
  number?: string;
  position?: string;
  imageUrl?: string;
  birthYear?: string;
  teams?: string[];
}

export function usePlayers(teamId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    if (!teamId) {
      setPlayers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const playersCollection = collection(db, "players");
      const q = query(
        playersCollection, 
        where("teams", "array-contains", teamId)
      );
      
      const playersSnapshot = await getDocs(q);
      
      if (!playersSnapshot.empty) {
        const playersList = playersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Player[];
        
        setPlayers(playersList);
      } else {
        console.log('Brak zawodników dla zespołu w Firebase');
        setPlayers([]);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching players:", err);
      setError("Nie udało się załadować danych zawodników");
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Funkcje CRUD
  const addPlayer = async (playerData: Omit<Player, "id">) => {
    try {
      // Dodaj zawodnika do zespołu (jeśli nie podano zespołów, dodaj bieżący)
      const teams = playerData.teams || [teamId];
      if (!teams.includes(teamId)) {
        teams.push(teamId);
      }
      
      // Dodaj zawodnika do Firebase
      const playerRef = await addDoc(collection(db, "players"), {
        ...playerData,
        teams
      });
      
      // Dodaj zawodnika do lokalnego stanu
      const newPlayer = {
        id: playerRef.id,
        ...playerData,
        teams
      };
      
      setPlayers(prev => [...prev, newPlayer]);
      return true;
    } catch (err) {
      console.error("Error adding player:", err);
      return false;
    }
  };

  const updatePlayer = async (id: string, playerData: Partial<Player>) => {
    try {
      // Upewnij się, że zawodnik jest przypisany do bieżącego zespołu
      let teams = playerData.teams || [];
      if (!teams.includes(teamId)) {
        teams.push(teamId);
      }
      
      // Aktualizuj zawodnika w Firebase
      const playerRef = doc(db, "players", id);
      await updateDoc(playerRef, {
        ...playerData,
        teams
      });
      
      // Aktualizuj zawodnika w lokalnym stanie
      setPlayers(prev => 
        prev.map(player => 
          player.id === id 
            ? { ...player, ...playerData, teams } 
            : player
        )
      );
      return true;
    } catch (err) {
      console.error("Error updating player:", err);
      return false;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      // Pobierz aktualnego zawodnika
      const playerRef = doc(db, "players", id);
      const playerDoc = await getDocs(query(
        collection(db, "players"),
        where("id", "==", id)
      ));
      
      if (playerDoc.empty) {
        throw new Error("Nie znaleziono zawodnika");
      }
      
      const playerData = playerDoc.docs[0].data();
      const teams = playerData.teams || [];
      
      // Jeśli zawodnik jest przypisany do wielu zespołów, tylko usuń powiązanie
      if (teams.length > 1) {
        await updateDoc(playerRef, {
          teams: teams.filter((t: string) => t !== teamId)
        });
      } else {
        // Jeśli to jedyny zespół, usuń całego zawodnika
        await deleteDoc(playerRef);
      }
      
      // Usuń zawodnika z lokalnego stanu
      setPlayers(prev => prev.filter(player => player.id !== id));
      return true;
    } catch (err) {
      console.error("Error deleting player:", err);
      return false;
    }
  };

  return {
    players,
    isLoading,
    error,
    refetch: fetchPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
  };
}
