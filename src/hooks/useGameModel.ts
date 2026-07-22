"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { GameModelState } from "@/types/gameModel";
import { GAME_MODEL_TASKS_DOC_ID, GAME_MODEL_VERSION } from "@/types/gameModel";
import {
  buildGameModelTaskDocument,
  migrateGameModelFromFirestore,
} from "@/lib/gameModelFirestore";
import { teamStaffStateDocRef, userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function defaultState(): GameModelState {
  return { templates: [], nodes: [] };
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === GAME_MODEL_VERSION || n === 1;
}

export function useGameModel(teamId: string | null, uid: string | null) {
  const [state, setState] = useState<GameModelState>(defaultState);
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!teamId || !uid) {
      setState(defaultState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const teamRef = teamStaffStateDocRef(teamId, GAME_MODEL_TASKS_DOC_ID);
        const teamSnap = await getDoc(teamRef);
        if (cancelled) return;

        const applyLoaded = (raw: Record<string, unknown>, persistToTeam = false) => {
          const migrated = migrateGameModelFromFirestore(raw);
          skipSaveOnce.current = true;
          setState(migrated);
          if (persistToTeam) {
            return setDoc(teamRef, buildGameModelTaskDocument(migrated, Date.now()));
          }
          return Promise.resolve();
        };

        if (teamSnap.exists()) {
          const d = teamSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              await applyLoaded(d, false);
            } catch (parseErr) {
              console.error("Parsowanie modelu gry:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultState());
          }
          return;
        }

        const legacySnap = await getDoc(userLegacyTasksDocRef(uid, GAME_MODEL_TASKS_DOC_ID));
        if (cancelled) return;

        if (legacySnap.exists()) {
          const d = legacySnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              await applyLoaded(d, true);
            } catch (parseErr) {
              console.error("Migracja modelu gry z konta użytkownika:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultState());
          }
          return;
        }

        skipSaveOnce.current = true;
        setState(defaultState());
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
  }, [teamId, uid]);

  useEffect(() => {
    if (!teamId || !uid || loading) return;
    if (skipSaveOnce.current) {
      skipSaveOnce.current = false;
      return;
    }
    const t = setTimeout(() => {
      const payload = buildGameModelTaskDocument(state, Date.now());
      setDoc(teamStaffStateDocRef(teamId, GAME_MODEL_TASKS_DOC_ID), payload).catch(
        (e: unknown) => {
          console.error("Zapis modelu gry:", e);
          toast.error("Nie udało się zapisać modelu gry.", {
            id: "game-model-save-error",
            duration: 6000,
          });
        }
      );
    }, 450);
    return () => clearTimeout(t);
  }, [state, teamId, uid, loading]);

  const setGameModelState = useCallback(
    (updater: GameModelState | ((prev: GameModelState) => GameModelState)) => {
      setState(updater);
    },
    []
  );

  return { state, setGameModelState, loading };
}
