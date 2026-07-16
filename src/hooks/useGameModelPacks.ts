"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { GameModelPacksState } from "@/types/gameModelPack";
import { GAME_MODEL_PACKS_DOC_ID, GAME_MODEL_PACKS_VERSION } from "@/types/gameModelPack";
import {
  buildGameModelPacksTaskDocument,
  migrateGameModelPacksFromFirestore,
} from "@/lib/gameModelPacksFirestore";
import { userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import { defaultGameModelPacksState } from "@/utils/gameModelPacks";
import toast from "react-hot-toast";

function packsDoc(uid: string) {
  return userLegacyTasksDocRef(uid, GAME_MODEL_PACKS_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === GAME_MODEL_PACKS_VERSION;
}

export function useGameModelPacks(uid: string | null) {
  const [state, setState] = useState<GameModelPacksState>(defaultGameModelPacksState);
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultGameModelPacksState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(packsDoc(uid));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateGameModelPacksFromFirestore(d);
              skipSaveOnce.current = true;
              setState(migrated);
            } catch (parseErr) {
              console.error("Parsowanie szablonów modelu:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultGameModelPacksState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultGameModelPacksState());
          }
        } else {
          skipSaveOnce.current = true;
          setState(defaultGameModelPacksState());
        }
      } catch (e) {
        console.error("Błąd ładowania szablonów modelu:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultGameModelPacksState());
          toast.error("Nie udało się wczytać szablonów modelu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || loading) return;
    if (skipSaveOnce.current) {
      skipSaveOnce.current = false;
      return;
    }
    const t = setTimeout(() => {
      const payload = buildGameModelPacksTaskDocument(state, Date.now());
      setDoc(packsDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis szablonów modelu:", e);
        toast.error("Nie udało się zapisać szablonów modelu.", {
          id: "game-model-packs-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setPacksState = useCallback(
    (updater: GameModelPacksState | ((prev: GameModelPacksState) => GameModelPacksState)) => {
      setState(updater);
    },
    []
  );

  return { state, setPacksState, loading };
}
