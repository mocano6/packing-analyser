import { useState, useEffect, useCallback } from "react";

export interface Team {
  id: string;
  name: string;
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/teams`);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setTeams(data.teams);
      setError(null);
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Nie udało się załadować danych drużyn");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Funkcje CRUD
  const addTeam = async (name: string) => {
    try {
      const response = await fetch(`/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchTeams(); // Odśwież listę po dodaniu
      return true;
    } catch (err) {
      console.error("Error adding team:", err);
      return false;
    }
  };

  const updateTeam = async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchTeams(); // Odśwież listę po aktualizacji
      return true;
    } catch (err) {
      console.error("Error updating team:", err);
      return false;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const response = await fetch(`/api/teams/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      await fetchTeams(); // Odśwież listę po usunięciu
      return true;
    } catch (err) {
      console.error("Error deleting team:", err);
      return false;
    }
  };

  return {
    teams,
    isLoading,
    error,
    refetch: fetchTeams,
    addTeam,
    updateTeam,
    deleteTeam,
  };
}
