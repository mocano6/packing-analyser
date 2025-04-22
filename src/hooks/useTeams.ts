import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, query, orderBy 
} from "firebase/firestore";

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
      const teamsCollection = collection(db, "teams");
      const q = query(teamsCollection, orderBy("name"));
      const teamsSnapshot = await getDocs(q);
      
      if (!teamsSnapshot.empty) {
        const teamsList = teamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Team[];
        
        setTeams(teamsList);
      } else {
        setTeams([]);
      }
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
