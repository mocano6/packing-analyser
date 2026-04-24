"use client";

import { useState, useEffect, useCallback } from "react";
import { Shot } from "@/types";
import { getDB } from "@/lib/firebase";
import { commitMatchArrayFieldUpdate, syncPendingMatchArrayField } from "@/lib/matchArrayFieldWrite";
import { getMatchDocumentFromCache, setMatchDocumentInCache, getOrLoadMatchDocument } from "@/lib/matchDocumentCache";
import { getPendingField } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";

export const useShots = (matchId: string) => {
  const [shots, setShots] = useState<Shot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobierz strzały z Firebase
  const fetchShots = useCallback(async () => {
    if (!matchId) return;

    setIsLoading(true);
    setError(null);

    try {
      const matchData = await getOrLoadMatchDocument(matchId);
      if (matchData) {
        const pendingShots = getPendingField<Shot[]>(matchId, "shots");
        const serverShots = matchData.shots || [];
        const rawShots =
          pendingShots === null ? serverShots : mergeByIdPreferPending(serverShots, pendingShots);

        const shotsWithDefaults = rawShots.map((shot: any) => ({
          ...shot,
          shotType: shot.shotType || "on_target",
          teamContext: shot.teamContext || "attack",
          teamId: shot.teamId || matchData.team || "",
          pkPlayersCount: shot.pkPlayersCount || 0,
          videoTimestamp: shot.videoTimestamp !== undefined ? shot.videoTimestamp : undefined,
        }));

        setShots(shotsWithDefaults);
      } else {
        setShots([]);
      }
    } catch (err) {
      const pendingShots = getPendingField<Shot[]>(matchId, "shots");
      const cachedMatch = getMatchDocumentFromCache(matchId);
      const cachedShots = cachedMatch?.shots || [];
      if (pendingShots !== null) {
        const merged = mergeByIdPreferPending(cachedShots as Shot[], pendingShots);
        const withDefaults = merged.map((shot: any) => ({
          ...shot,
          shotType: shot.shotType || "on_target",
          teamContext: shot.teamContext || "attack",
          teamId: shot.teamId || cachedMatch?.team || "",
          pkPlayersCount: shot.pkPlayersCount || 0,
          videoTimestamp: shot.videoTimestamp !== undefined ? shot.videoTimestamp : undefined,
        }));
        setShots(withDefaults);
      } else if (cachedShots.length > 0) {
        setShots(cachedShots as Shot[]);
      } else {
        setShots([]);
      }
      console.error("Błąd podczas pobierania strzałów:", err);
      setError("Nie udało się pobrać strzałów");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => removeUndefinedValues(item));
    }

    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = removeUndefinedValues(value);
          }
        }
      }
      return cleaned;
    }

    return obj;
  };

  const persistShots = useCallback(
    async (updater: (prev: Shot[]) => Shot[]) => {
      if (!matchId) {
        console.error("Brak matchId podczas zapisywania strzałów");
        return false;
      }
      let db;
      try {
        db = getDB();
      } catch {
        console.error("Firestore nie jest zainicjalizowane");
        return false;
      }

      const result = await commitMatchArrayFieldUpdate<Shot>({
        db,
        matchId,
        field: "shots",
        updater,
        cleanForFirestore: (arr) => removeUndefinedValues(arr),
      });

      if (result.ok) {
        setShots(result.next);
        return true;
      }
      setError("Nie udało się zapisać strzałów");
      return false;
    },
    [matchId]
  );

  const syncPendingShots = useCallback(async () => {
    if (!matchId) return;
    let db;
    try {
      db = getDB();
    } catch {
      return;
    }
    const merged = await syncPendingMatchArrayField<Shot>({
      db,
      matchId,
      field: "shots",
      cleanForFirestore: (arr) => removeUndefinedValues(arr),
    });
    if (merged) {
      setShots(merged);
    }
  }, [matchId]);

  useEffect(() => {
    syncPendingShots();
    const handleOnline = () => syncPendingShots();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingShots]);

  const addShot = useCallback(
    async (shotData: Omit<Shot, "id" | "timestamp">) => {
      const newShot: Shot = {
        ...shotData,
        id: `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };

      const ok = await persistShots((prev) => [...prev, newShot]);
      return ok ? newShot : null;
    },
    [persistShots]
  );

  const updateShot = useCallback(
    async (shotId: string, shotData: Partial<Shot>) => {
      return await persistShots((prev) =>
        prev.map((shot) => (shot.id === shotId ? { ...shot, ...shotData } : shot))
      );
    },
    [persistShots]
  );

  const deleteShot = useCallback(
    async (shotId: string) => {
      return await persistShots((prev) => prev.filter((shot) => shot.id !== shotId));
    },
    [persistShots]
  );

  useEffect(() => {
    fetchShots();
  }, [fetchShots]);

  return {
    shots,
    isLoading,
    error,
    addShot,
    updateShot,
    deleteShot,
    refetch: fetchShots,
  };
};
