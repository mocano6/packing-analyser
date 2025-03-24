import { useState, useEffect, useCallback } from "react";

export interface Player {
  id: string;
  name: string;
  number?: string;
  position?: string;
  imageUrl?: string;
  birthYear?: string;
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
      const response = await fetch(`/api/teams/${teamId}/players`);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setPlayers(data.players);
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
      const response = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playerData),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchPlayers(); // Odśwież listę po dodaniu
      return true;
    } catch (err) {
      console.error("Error adding player:", err);
      return false;
    }
  };

  const updatePlayer = async (id: string, playerData: Partial<Player>) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/players/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playerData),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchPlayers(); // Odśwież listę po aktualizacji
      return true;
    } catch (err) {
      console.error("Error updating player:", err);
      return false;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/players/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchPlayers(); // Odśwież listę po usunięciu
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
