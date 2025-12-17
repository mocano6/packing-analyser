"use client";

import { useState, useEffect, useCallback } from "react";
import { Acc8sEntry } from "@/types";
import { getDB } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const useAcc8sEntries = (matchId: string) => {
  const [acc8sEntries, setAcc8sEntries] = useState<Acc8sEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz akcje 8s ACC z Firebase
  const fetchAcc8sEntries = useCallback(async () => {
    if (!matchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const db = getDB();
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        const rawEntries = matchData.acc8sEntries || [];
        setAcc8sEntries(rawEntries);
      } else {
        setAcc8sEntries([]);
      }
    } catch (err) {
      console.error("Błąd podczas pobierania akcji 8s ACC:", err);
      setError("Nie udało się pobrać akcji 8s ACC");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  // Zapisz akcje 8s ACC do Firebase
  const saveAcc8sEntries = useCallback(async (updatedEntries: Acc8sEntry[]) => {
    if (!matchId) return false;
    
    try {
      const db = getDB();
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        acc8sEntries: updatedEntries
      });
      setAcc8sEntries(updatedEntries);
      return true;
    } catch (err) {
      console.error("Błąd podczas zapisywania akcji 8s ACC:", err);
      setError("Nie udało się zapisać akcji 8s ACC");
      return false;
    }
  }, [matchId]);

  // Dodaj nową akcję 8s ACC
  const addAcc8sEntry = useCallback(async (entryData: Omit<Acc8sEntry, "id" | "timestamp">) => {
    const newEntry: Acc8sEntry = {
      ...entryData,
      id: `acc8s_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Używamy funkcjonalnej aktualizacji stanu, aby uniknąć problemów z starym stanem
    let updatedEntries: Acc8sEntry[] = [];
    setAcc8sEntries(prevEntries => {
      updatedEntries = [...prevEntries, newEntry];
      return updatedEntries;
    });
    
    const success = await saveAcc8sEntries(updatedEntries);
    return success ? newEntry : null;
  }, [saveAcc8sEntries]);

  // Zaktualizuj akcję 8s ACC
  const updateAcc8sEntry = useCallback(async (entryId: string, entryData: Partial<Acc8sEntry>) => {
    const updatedEntries = acc8sEntries.map(entry => 
      entry.id === entryId ? { ...entry, ...entryData } : entry
    );
    return await saveAcc8sEntries(updatedEntries);
  }, [acc8sEntries, saveAcc8sEntries]);

  // Usuń akcję 8s ACC
  const deleteAcc8sEntry = useCallback(async (entryId: string) => {
    const updatedEntries = acc8sEntries.filter(entry => entry.id !== entryId);
    return await saveAcc8sEntries(updatedEntries);
  }, [acc8sEntries, saveAcc8sEntries]);

  // Pobierz akcje 8s ACC przy załadowaniu lub zmianie matchId
  useEffect(() => {
    fetchAcc8sEntries();
  }, [fetchAcc8sEntries]);

  return {
    acc8sEntries,
    isLoading,
    error,
    addAcc8sEntry,
    updateAcc8sEntry,
    deleteAcc8sEntry,
    refetch: fetchAcc8sEntries,
  };
};

