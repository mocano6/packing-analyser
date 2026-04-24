"use client";

import { useState, useEffect, useCallback } from "react";
import { PKEntry } from "@/types";
import { getDB } from "@/lib/firebase";
import { commitMatchArrayFieldUpdate, syncPendingMatchArrayField } from "@/lib/matchArrayFieldWrite";
import { getMatchDocumentFromCache, setMatchDocumentInCache, getOrLoadMatchDocument } from "@/lib/matchDocumentCache";
import { getPendingField } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";

export const usePKEntries = (matchId: string) => {
  const [pkEntries, setPkEntries] = useState<PKEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPKEntries = useCallback(async () => {
    if (!matchId) return;

    setIsLoading(true);
    setError(null);

    try {
      const matchData = await getOrLoadMatchDocument(matchId);
      if (matchData) {
        const pendingEntries = getPendingField<PKEntry[]>(matchId, "pkEntries");
        const serverEntries = matchData.pkEntries || [];
        const rawEntries =
          pendingEntries === null
            ? serverEntries
            : mergeByIdPreferPending(serverEntries, pendingEntries);
        setPkEntries(rawEntries);
      } else {
        setPkEntries([]);
      }
    } catch (err) {
      const pendingEntries = getPendingField<PKEntry[]>(matchId, "pkEntries");
      const cachedMatch = getMatchDocumentFromCache(matchId);
      const cachedEntries = cachedMatch?.pkEntries || [];
      if (pendingEntries !== null) {
        setPkEntries(mergeByIdPreferPending(cachedEntries as PKEntry[], pendingEntries));
      } else if (cachedEntries.length > 0) {
        setPkEntries(cachedEntries as PKEntry[]);
      } else {
        setPkEntries([]);
      }
      console.error("Błąd podczas pobierania wejść PK:", err);
      setError("Nie udało się pobrać wejść PK");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  const removeUndefinedFields = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => removeUndefinedFields(item));
    }

    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
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

  const persistPkEntries = useCallback(
    async (updater: (prev: PKEntry[]) => PKEntry[]) => {
      if (!matchId) {
        return false;
      }
      let db;
      try {
        db = getDB();
      } catch {
        return false;
      }

      const result = await commitMatchArrayFieldUpdate<PKEntry>({
        db,
        matchId,
        field: "pkEntries",
        updater,
        cleanForFirestore: (arr) => removeUndefinedFields(arr),
      });

      if (result.ok) {
        setPkEntries(result.next);
        return true;
      }
      setError("Nie udało się zapisać wejść PK");
      return false;
    },
    [matchId]
  );

  const syncPendingPkEntries = useCallback(async () => {
    if (!matchId) return;
    let db;
    try {
      db = getDB();
    } catch {
      return;
    }
    const merged = await syncPendingMatchArrayField<PKEntry>({
      db,
      matchId,
      field: "pkEntries",
      cleanForFirestore: (arr) => removeUndefinedFields(arr),
    });
    if (merged) {
      setPkEntries(merged);
    }
  }, [matchId]);

  useEffect(() => {
    syncPendingPkEntries();
    const handleOnline = () => syncPendingPkEntries();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingPkEntries]);

  const addPKEntry = useCallback(
    async (entryData: Omit<PKEntry, "id" | "timestamp">) => {
      const newEntry: PKEntry = {
        ...entryData,
        id: `pk_entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };

      const ok = await persistPkEntries((prev) => [...prev, newEntry]);
      return ok ? newEntry : null;
    },
    [persistPkEntries]
  );

  const updatePKEntry = useCallback(
    async (entryId: string, entryData: Partial<PKEntry>) => {
      return await persistPkEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, ...entryData } : entry))
      );
    },
    [persistPkEntries]
  );

  const deletePKEntry = useCallback(
    async (entryId: string) => {
      return await persistPkEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    },
    [persistPkEntries]
  );

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
