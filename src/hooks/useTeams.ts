import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, orderBy 
} from "@/lib/firestoreWithMetrics";
import { getCached, setCached, invalidateCache, CACHE_KEYS } from "@/lib/sessionCache";

export interface Team {
  id: string;
  name: string;
}

let teamsFetchInFlight: Promise<Team[]> | null = null;

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const cached = getCached<Team[]>(CACHE_KEYS.TEAMS_LIST, 5 * 60 * 1000);
      if (cached && cached.length >= 0) {
        setTeams(cached);
        setError(null);
        setIsLoading(false);
        return;
      }
      if (teamsFetchInFlight) {
        setIsLoading(true);
        const list = await teamsFetchInFlight;
        setTeams(list);
        setError(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const doFetch = async (): Promise<Team[]> => {
        try {
          const teamsCollection = collection(db, "teams");
          const q = query(teamsCollection, orderBy("name"));
          const teamsSnapshot = await getDocs(q);
          if (!teamsSnapshot.empty) {
            const teamsList = teamsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Team[];
            setCached(CACHE_KEYS.TEAMS_LIST, teamsList);
            return teamsList;
          }
          return [];
        } finally {
          teamsFetchInFlight = null;
        }
      };
      teamsFetchInFlight = doFetch();
      const list = await teamsFetchInFlight;
      setTeams(list);
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
      
      invalidateCache(CACHE_KEYS.TEAMS_LIST);
      setTeams(prev => [...prev, { id: teamRef.id, name }]);
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
      invalidateCache(CACHE_KEYS.TEAMS_LIST);
      // Aktualizacja zespołu lokalnie
      setTeams(prev => prev.map(team => 
        team.id === id ? { ...team, name } : team
      ));
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
      invalidateCache(CACHE_KEYS.TEAMS_LIST);
      // Usunięcie zespołu lokalnie
      setTeams(prev => prev.filter(team => team.id !== id));
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
