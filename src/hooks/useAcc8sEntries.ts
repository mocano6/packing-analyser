"use client";

import { useState, useEffect, useCallback } from "react";
import { Acc8sEntry } from "@/types";
import { getDB } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "@/lib/firestoreWithMetrics";
import { getMatchDocumentFromCache, setMatchDocumentInCache } from "@/lib/matchDocumentCache";
import { clearPendingMatchUpdate, getPendingField, setPendingMatchUpdate } from "@/lib/offlineMatchPending";

export const useAcc8sEntries = (matchId: string) => {
  const [acc8sEntries, setAcc8sEntries] = useState<Acc8sEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOfflineError = (err: unknown) => {
    const msg = String(err);
    return (
      msg.includes("offline") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("unavailable")
    );
  };

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
        const pendingEntries = getPendingField<Acc8sEntry[]>(matchId, "acc8sEntries");
        const rawEntries = pendingEntries ?? (matchData.acc8sEntries || []);
        setAcc8sEntries(rawEntries);
      } else {
        setAcc8sEntries([]);
      }
    } catch (err) {
      const pendingEntries = getPendingField<Acc8sEntry[]>(matchId, "acc8sEntries");
      const cachedMatch = getMatchDocumentFromCache(matchId);
      const cachedEntries = cachedMatch?.acc8sEntries || [];
      if (pendingEntries) {
        setAcc8sEntries(pendingEntries);
      } else if (cachedEntries.length > 0) {
        setAcc8sEntries(cachedEntries as Acc8sEntry[]);
      } else {
        setAcc8sEntries([]);
      }
      console.error("Błąd podczas pobierania akcji 8s ACC:", err);
      setError("Nie udało się pobrać akcji 8s ACC");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  // Zapisz akcje 8s ACC do Firebase
  const saveAcc8sEntries = useCallback(async (updatedEntries: Acc8sEntry[] | ((prev: Acc8sEntry[]) => Acc8sEntry[])) => {
    if (!matchId) {
      console.error('saveAcc8sEntries - brak matchId');
      return false;
    }
    
    try {
      // Jeśli updatedEntries jest funkcją, użyj funkcjonalnej aktualizacji stanu
      const entriesToSave = typeof updatedEntries === 'function' 
        ? updatedEntries(acc8sEntries)
        : updatedEntries;
      
      // Usuń wartości undefined z wpisów przed zapisem
      const cleanedEntries = entriesToSave.map(entry => {
        const cleaned: any = {};
        Object.keys(entry).forEach(key => {
          if (entry[key as keyof Acc8sEntry] !== undefined) {
            cleaned[key] = entry[key as keyof Acc8sEntry];
          }
        });
        return cleaned;
      });
      
      const db = getDB();
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        acc8sEntries: cleanedEntries
      });
      clearPendingMatchUpdate(matchId, "acc8sEntries");
      setAcc8sEntries(entriesToSave);
      const cached = getMatchDocumentFromCache(matchId);
      if (cached) {
        setMatchDocumentInCache(matchId, { ...cached, acc8sEntries: cleanedEntries });
      }
      return true;
    } catch (err) {
      console.error("Błąd podczas zapisywania akcji 8s ACC:", err);
      if (isOfflineError(err)) {
        // Jeśli updatedEntries jest funkcją, policz wartosc na podstawie obecnego stanu
        const entriesToSave = typeof updatedEntries === 'function'
          ? updatedEntries(acc8sEntries)
          : updatedEntries;
        const cleanedEntries = entriesToSave.map(entry => {
          const cleaned: any = {};
          Object.keys(entry).forEach(key => {
            if (entry[key as keyof Acc8sEntry] !== undefined) {
              cleaned[key] = entry[key as keyof Acc8sEntry];
            }
          });
          return cleaned;
        });
        setPendingMatchUpdate(matchId, "acc8sEntries", cleanedEntries);
        setAcc8sEntries(entriesToSave);
        const cached = getMatchDocumentFromCache(matchId);
        if (cached) {
          setMatchDocumentInCache(matchId, { ...cached, acc8sEntries: cleanedEntries });
        }
        return true;
      }
      setError("Nie udało się zapisać akcji 8s ACC");
      return false;
    }
  }, [matchId, acc8sEntries]);

  const syncPendingAcc8sEntries = useCallback(async () => {
    if (!matchId) return;
    const pending = getPendingField<Acc8sEntry[]>(matchId, "acc8sEntries");
    if (!pending) return;
    try {
      const db = getDB();
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, { acc8sEntries: pending });
      clearPendingMatchUpdate(matchId, "acc8sEntries");
      const cached = getMatchDocumentFromCache(matchId);
      if (cached) {
        setMatchDocumentInCache(matchId, { ...cached, acc8sEntries: pending });
      }
      setAcc8sEntries(pending);
    } catch {
      // nadal offline lub błąd — zostawiamy pending
    }
  }, [matchId]);

  useEffect(() => {
    syncPendingAcc8sEntries();
    const handleOnline = () => syncPendingAcc8sEntries();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingAcc8sEntries]);

  // Dodaj nową akcję 8s ACC
  const addAcc8sEntry = useCallback(async (entryData: Omit<Acc8sEntry, "id" | "timestamp">) => {
    if (!matchId) {
      console.error('addAcc8sEntry - brak matchId');
      return null;
    }

    const newEntry: Acc8sEntry = {
      ...entryData,
      id: `acc8s_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    try {
      const success = await saveAcc8sEntries(prevEntries => [...prevEntries, newEntry]);
      return success ? newEntry : null;
    } catch (err) {
      console.error("Błąd podczas dodawania akcji 8s ACC:", err);
      setError("Nie udało się dodać akcji 8s ACC");
      return null;
    }
  }, [matchId, saveAcc8sEntries]);

  // Zaktualizuj akcję 8s ACC
  const updateAcc8sEntry = useCallback(async (entryId: string, entryData: Partial<Acc8sEntry>) => {
    if (!matchId) {
      console.error('updateAcc8sEntry - brak matchId');
      return false;
    }
    
    try {
      return await saveAcc8sEntries(prevEntries =>
        prevEntries.map(entry => entry.id === entryId ? { ...entry, ...entryData } : entry)
      );
    } catch (err) {
      console.error("Błąd podczas aktualizacji akcji 8s ACC:", err);
      setError("Nie udało się zaktualizować akcji 8s ACC");
      return false;
    }
  }, [matchId, saveAcc8sEntries]);

  // Usuń akcję 8s ACC
  const deleteAcc8sEntry = useCallback(async (entryId: string) => {
    if (!matchId) {
      console.error('deleteAcc8sEntry - brak matchId');
      return false;
    }

    try {
      return await saveAcc8sEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
    } catch (err) {
      console.error("Błąd podczas usuwania akcji 8s ACC:", err);
      setError("Nie udało się usunąć akcji 8s ACC");
      return false;
    }
  }, [matchId, saveAcc8sEntries]);

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

