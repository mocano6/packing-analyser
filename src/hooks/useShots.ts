"use client";

import { useState, useEffect, useCallback } from "react";
import { Shot } from "@/types";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "@/lib/firestoreWithMetrics";
import { getMatchDocumentFromCache, setMatchDocumentInCache, getOrLoadMatchDocument } from "@/lib/matchDocumentCache";
import { clearPendingMatchUpdate, getPendingField, setPendingMatchUpdate } from "@/lib/offlineMatchPending";

export const useShots = (matchId: string) => {
  const [shots, setShots] = useState<Shot[]>([]);
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

  // Pobierz strzały z Firebase
  const fetchShots = useCallback(async () => {
    if (!matchId || !db) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const matchData = await getOrLoadMatchDocument(matchId);
      if (matchData) {
        const pendingShots = getPendingField<Shot[]>(matchId, "shots");
        const rawShots = pendingShots ?? (matchData.shots || []);
        
        // Dodaj domyślne wartości dla nowych pól w istniejących strzałach
        const shotsWithDefaults = rawShots.map((shot: any) => ({
          ...shot,
          shotType: shot.shotType || 'on_target',
          teamContext: shot.teamContext || 'attack',
          teamId: shot.teamId || matchData.team || '',
          pkPlayersCount: shot.pkPlayersCount || 0,
          // Zachowaj videoTimestamp jeśli istnieje
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
      if (pendingShots) {
        setShots(pendingShots);
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

  // Funkcja do usuwania wartości undefined z obiektu (Firestore nie akceptuje undefined)
  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
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

  // Zapisz strzały do Firebase
  const saveShots = useCallback(async (updatedShots: Shot[]) => {
    if (!matchId || !db) {
      console.error("Brak matchId lub db podczas zapisywania strzałów");
      return false;
    }
    
    try {
      // Usuń wszystkie wartości undefined przed zapisem
      const cleanedShots = removeUndefinedValues(updatedShots);
      
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        shots: cleanedShots
      });
      clearPendingMatchUpdate(matchId, "shots");
      setShots(updatedShots);
      const cached = getMatchDocumentFromCache(matchId);
      if (cached) {
        setMatchDocumentInCache(matchId, { ...cached, shots: cleanedShots });
      }
      return true;
    } catch (err) {
      console.error("Błąd podczas zapisywania strzałów:", err);
      if (isOfflineError(err)) {
        const cleanedShots = removeUndefinedValues(updatedShots);
        setPendingMatchUpdate(matchId, "shots", cleanedShots);
        setShots(updatedShots);
        const cached = getMatchDocumentFromCache(matchId);
        if (cached) {
          setMatchDocumentInCache(matchId, { ...cached, shots: cleanedShots });
        }
        return true;
      }
      setError("Nie udało się zapisać strzałów");
      return false;
    }
  }, [matchId]);

  const syncPendingShots = useCallback(async () => {
    if (!matchId || !db) return;
    const pending = getPendingField<Shot[]>(matchId, "shots");
    if (!pending) return;
    try {
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, { shots: pending });
      clearPendingMatchUpdate(matchId, "shots");
      const cached = getMatchDocumentFromCache(matchId);
      if (cached) {
        setMatchDocumentInCache(matchId, { ...cached, shots: pending });
      }
      setShots(pending);
    } catch (err) {
      // nadal offline lub błąd — zostawiamy pending
    }
  }, [matchId]);

  useEffect(() => {
    syncPendingShots();
    const handleOnline = () => syncPendingShots();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingShots]);

  // Dodaj nowy strzał
  const addShot = useCallback(async (shotData: Omit<Shot, "id" | "timestamp">) => {
    const newShot: Shot = {
      ...shotData,
      id: `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const updatedShots = [...shots, newShot];
    const success = await saveShots(updatedShots);
    return success ? newShot : null;
  }, [shots, saveShots]);

  // Zaktualizuj strzał
  const updateShot = useCallback(async (shotId: string, shotData: Partial<Shot>) => {
    const updatedShots = shots.map(shot => 
      shot.id === shotId ? { ...shot, ...shotData } : shot
    );
    return await saveShots(updatedShots);
  }, [shots, saveShots]);

  // Usuń strzał
  const deleteShot = useCallback(async (shotId: string) => {
    const updatedShots = shots.filter(shot => shot.id !== shotId);
    return await saveShots(updatedShots);
  }, [shots, saveShots]);

  // Pobierz strzały przy załadowaniu lub zmianie matchId
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

