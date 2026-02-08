import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { addDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";
import { getTeamsArray, clearTeamsCache } from "@/constants/teamsLoader";

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
      const teamsList = await getTeamsArray();
      const sorted = teamsList.sort((a, b) =>
        a.name.localeCompare(b.name, "pl", { sensitivity: "base" })
      );
      setTeams(sorted);
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
      // Dodanie zespołu do Firebase
      const teamRef = await addDoc(collection(db, "teams"), { name });
      
      // Dodanie zespołu lokalnie
      setTeams(prev => [...prev, { id: teamRef.id, name }]);
      clearTeamsCache();
      return true;
    } catch (err) {
      console.error("Error adding team:", err);
      return false;
    }
  };

  const updateTeam = async (id: string, name: string) => {
    try {
      // Aktualizacja zespołu w Firebase
      const teamRef = doc(db, "teams", id);
      await updateDoc(teamRef, { name });
      
      // Aktualizacja zespołu lokalnie
      setTeams(prev => prev.map(team => 
        team.id === id ? { ...team, name } : team
      ));
      clearTeamsCache();
      return true;
    } catch (err) {
      console.error("Error updating team:", err);
      return false;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      // Usunięcie zespołu z Firebase
      await deleteDoc(doc(db, "teams", id));
      
      // Usunięcie zespołu lokalnie
      setTeams(prev => prev.filter(team => team.id !== id));
      clearTeamsCache();
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
