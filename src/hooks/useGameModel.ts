"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import type { GameModelState } from "@/types/gameModel";
import { GAME_MODEL_TASKS_DOC_ID, GAME_MODEL_VERSION } from "@/types/gameModel";
import {
  buildGameModelTaskDocument,
  migrateGameModelFromFirestore,
} from "@/lib/gameModelFirestore";
import toast from "react-hot-toast";

function defaultState(): GameModelState {
  return { templates: [], nodes: [] };
}

function gameModelStateDoc(uid: string) {
  return doc(getDB(), "users", uid, "tasks", GAME_MODEL_TASKS_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === GAME_MODEL_VERSION || n === 1;
}

export function useGameModel(uid: string | null) {
  const [state, setState] = useState<GameModelState>(defaultState);
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(gameModelStateDoc(uid));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateGameModelFromFirestore(d);
              skipSaveOnce.current = true;
              setState(migrated);
            } catch (parseErr) {
              console.error("Parsowanie modelu gry:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultState());
          }
        } else {
          skipSaveOnce.current = true;
          setState(defaultState());
        }
      } catch (e) {
        console.error("Błąd ładowania modelu gry:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultState());
          toast.error("Nie udało się wczytać modelu gry.");
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
      const payload = buildGameModelTaskDocument(state, Date.now());
      setDoc(gameModelStateDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis modelu gry:", e);
        toast.error("Nie udało się zapisać modelu gry.", {
          id: "game-model-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setGameModelState = useCallback(
    (updater: GameModelState | ((prev: GameModelState) => GameModelState)) => {
      setState(updater);
    },
    []
  );

  return { state, setGameModelState, loading };
}
