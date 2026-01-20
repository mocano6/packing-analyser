"use client";

import { useState, useEffect, useCallback } from "react";
import { PKEntry } from "@/types";
import { getDB } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const usePKEntries = (matchId: string) => {
  const [pkEntries, setPkEntries] = useState<PKEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz wejścia PK z Firebase
  const fetchPKEntries = useCallback(async () => {
    if (!matchId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const db = getDB();
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        const rawEntries = matchData.pkEntries || [];
        setPkEntries(rawEntries);
      } else {
        setPkEntries([]);
      }
    } catch (err) {
      console.error("Błąd podczas pobierania wejść PK:", err);
      setError("Nie udało się pobrać wejść PK");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  // Funkcja pomocnicza do usuwania pól undefined z obiektu
  const removeUndefinedFields = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedFields(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = removeUndefinedFields(value);
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  };

  // Zapisz wejścia PK do Firebase
  const savePKEntries = useCallback(async (updatedEntries: PKEntry[]) => {
    if (!matchId) {
      return false;
    }
    
    // Usuń wszystkie pola undefined przed zapisaniem
    const cleanedEntries = removeUndefinedFields(updatedEntries);
    
    try {
      const db = getDB();
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        pkEntries: cleanedEntries
      });
      setPkEntries(updatedEntries);
      return true;
    } catch (err) {
      console.error("Błąd podczas zapisywania wejść PK:", err);
      setError("Nie udało się zapisać wejść PK");
      return false;
    }
  }, [matchId]);

  // Dodaj nowe wejście PK
  const addPKEntry = useCallback(async (entryData: Omit<PKEntry, "id" | "timestamp">) => {
    const newEntry: PKEntry = {
      ...entryData,
      id: `pk_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const updatedEntries = [...pkEntries, newEntry];
    const success = await savePKEntries(updatedEntries);
    return success ? newEntry : null;
  }, [pkEntries, savePKEntries]);

  // Zaktualizuj wejście PK
  const updatePKEntry = useCallback(async (entryId: string, entryData: Partial<PKEntry>) => {
    const updatedEntries = pkEntries.map(entry => 
      entry.id === entryId ? { ...entry, ...entryData } : entry
    );
    const success = await savePKEntries(updatedEntries);
    return success;
  }, [pkEntries, savePKEntries]);

  // Usuń wejście PK
  const deletePKEntry = useCallback(async (entryId: string) => {
    const updatedEntries = pkEntries.filter(entry => entry.id !== entryId);
    const success = await savePKEntries(updatedEntries);
    return success;
  }, [pkEntries, savePKEntries]);

  // Pobierz wejścia PK przy załadowaniu lub zmianie matchId
  useEffect(() => {
    fetchPKEntries();
  }, [fetchPKEntries]);

  return {
    pkEntries,
    isLoading,
    error,
    addPKEntry,
    updatePKEntry,
    deletePKEntry,
    refetch: fetchPKEntries,
  };
};

