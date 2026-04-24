"use client";

import { useState, useEffect, useCallback } from "react";
import { Acc8sEntry } from "@/types";
import { getDB } from "@/lib/firebase";
import { commitMatchArrayFieldUpdate, syncPendingMatchArrayField } from "@/lib/matchArrayFieldWrite";
import { getMatchDocumentFromCache, getOrLoadMatchDocument } from "@/lib/matchDocumentCache";
import { getPendingField } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";
import { applyAcc8sBulkFlagsUpdate } from "@/lib/matchDocumentArrayUpdaters";

export const useAcc8sEntries = (matchId: string) => {
  const [acc8sEntries, setAcc8sEntries] = useState<Acc8sEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAcc8sEntries = useCallback(async () => {
    if (!matchId) return;

    setIsLoading(true);
    setError(null);

    try {
      const matchData = await getOrLoadMatchDocument(matchId);
      if (matchData) {
        const pendingEntries = getPendingField<Acc8sEntry[]>(matchId, "acc8sEntries");
        const serverEntries = matchData.acc8sEntries || [];
        const rawEntries =
          pendingEntries === null
            ? serverEntries
            : mergeByIdPreferPending(serverEntries, pendingEntries);
        setAcc8sEntries(rawEntries);
      } else {
        setAcc8sEntries([]);
      }
    } catch (err) {
      const pendingEntries = getPendingField<Acc8sEntry[]>(matchId, "acc8sEntries");
      const cachedMatch = getMatchDocumentFromCache(matchId);
      const cachedEntries = cachedMatch?.acc8sEntries || [];
      if (pendingEntries !== null) {
        setAcc8sEntries(mergeByIdPreferPending(cachedEntries as Acc8sEntry[], pendingEntries));
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

  const cleanEntries = (entries: Acc8sEntry[]): Acc8sEntry[] =>
    entries.map((entry) => {
      const cleaned: Record<string, unknown> = {};
      Object.keys(entry).forEach((key) => {
        if (entry[key as keyof Acc8sEntry] !== undefined) {
          cleaned[key] = entry[key as keyof Acc8sEntry];
        }
      });
      return cleaned as unknown as Acc8sEntry;
    });

  const saveAcc8sEntries = useCallback(
    async (updater: (prev: Acc8sEntry[]) => Acc8sEntry[]) => {
      if (!matchId) {
        console.error("saveAcc8sEntries - brak matchId");
        return false;
      }
      let db;
      try {
        db = getDB();
      } catch {
        console.error("saveAcc8sEntries - brak Firestore");
        return false;
      }

      const result = await commitMatchArrayFieldUpdate<Acc8sEntry>({
        db,
        matchId,
        field: "acc8sEntries",
        updater,
        cleanForFirestore: (arr) => cleanEntries(arr),
      });

      if (result.ok) {
        setAcc8sEntries(result.next);
        return true;
      }
      setError("Nie udało się zapisać akcji 8s ACC");
      return false;
    },
    [matchId]
  );

  const syncPendingAcc8sEntries = useCallback(async () => {
    if (!matchId) return;
    let db;
    try {
      db = getDB();
    } catch {
      return;
    }
    const merged = await syncPendingMatchArrayField<Acc8sEntry>({
      db,
      matchId,
      field: "acc8sEntries",
      cleanForFirestore: (arr) => cleanEntries(arr),
    });
    if (merged) {
      setAcc8sEntries(merged);
    }
  }, [matchId]);

  useEffect(() => {
    syncPendingAcc8sEntries();
    const handleOnline = () => syncPendingAcc8sEntries();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingAcc8sEntries]);

  const addAcc8sEntry = useCallback(
    async (entryData: Omit<Acc8sEntry, "id" | "timestamp">) => {
      if (!matchId) {
        console.error("addAcc8sEntry - brak matchId");
        return null;
      }

      const newEntry: Acc8sEntry = {
        ...entryData,
        id: `acc8s_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };

      try {
        const success = await saveAcc8sEntries((prevEntries) => [...prevEntries, newEntry]);
        return success ? newEntry : null;
      } catch (err) {
        console.error("Błąd podczas dodawania akcji 8s ACC:", err);
        setError("Nie udało się dodać akcji 8s ACC");
        return null;
      }
    },
    [matchId, saveAcc8sEntries]
  );

  const updateAcc8sEntry = useCallback(
    async (entryId: string, entryData: Partial<Acc8sEntry>) => {
      if (!matchId) {
        console.error("updateAcc8sEntry - brak matchId");
        return false;
      }

      try {
        return await saveAcc8sEntries((prevEntries) =>
          prevEntries.map((entry) => (entry.id === entryId ? { ...entry, ...entryData } : entry))
        );
      } catch (err) {
        console.error("Błąd podczas aktualizacji akcji 8s ACC:", err);
        setError("Nie udało się zaktualizować akcji 8s ACC");
        return false;
      }
    },
    [matchId, saveAcc8sEntries]
  );

  const deleteAcc8sEntry = useCallback(
    async (entryId: string) => {
      if (!matchId) {
        console.error("deleteAcc8sEntry - brak matchId");
        return false;
      }

      try {
        return await saveAcc8sEntries((prevEntries) => prevEntries.filter((entry) => entry.id !== entryId));
      } catch (err) {
        console.error("Błąd podczas usuwania akcji 8s ACC:", err);
        setError("Nie udało się usunąć akcji 8s ACC");
        return false;
      }
    },
    [matchId, saveAcc8sEntries]
  );

  const bulkUpdateAcc8sEntries = useCallback(
    async (updates: Array<{ id: string; isShotUnder8s: boolean; isPKEntryUnder8s: boolean }>) => {
      if (!matchId || updates.length === 0) return false;
      try {
               return await saveAcc8sEntries((prevEntries) => applyAcc8sBulkFlagsUpdate(prevEntries, updates));
      } catch (err) {
        console.error("Błąd podczas zbiorczej aktualizacji akcji 8s ACC:", err);
        setError("Nie udało się zaktualizować akcji 8s ACC");
        return false;
      }
    },
    [matchId, saveAcc8sEntries]
  );

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
    bulkUpdateAcc8sEntries,
    refetch: fetchAcc8sEntries,
  };
};
