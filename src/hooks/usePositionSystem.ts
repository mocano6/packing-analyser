"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import type { PositionSystemState } from "@/types/positionSystem";
import {
  POSITION_SYSTEM_TASKS_DOC_ID,
  POSITION_SYSTEM_VERSION,
} from "@/types/positionSystem";
import {
  buildPositionSystemTaskDocument,
  migratePositionSystemFromFirestore,
} from "@/lib/positionSystemFirestore";
import toast from "react-hot-toast";

function defaultState(): PositionSystemState {
  return { nodes: [] };
}

function positionSystemStateDoc(uid: string) {
  return doc(getDB(), "users", uid, "tasks", POSITION_SYSTEM_TASKS_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === POSITION_SYSTEM_VERSION || n === 1 || n === 2;
}

export function usePositionSystem(uid: string | null) {
  const [state, setState] = useState<PositionSystemState>(defaultState);
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
        const snap = await getDoc(positionSystemStateDoc(uid));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migratePositionSystemFromFirestore(d);
              skipSaveOnce.current = true;
              setState(migrated);
            } catch (parseErr) {
              console.error("Parsowanie systemu pozycji:", parseErr);
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
        console.error("Błąd ładowania systemu pozycji:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultState());
          toast.error("Nie udało się wczytać systemu pozycji.");
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
      const payload = buildPositionSystemTaskDocument(state, Date.now());
      setDoc(positionSystemStateDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis systemu pozycji:", e);
        toast.error("Nie udało się zapisać systemu pozycji.", {
          id: "position-system-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setPositionSystemState = useCallback(
    (updater: PositionSystemState | ((prev: PositionSystemState) => PositionSystemState)) => {
      setState(updater);
    },
    []
  );

  return { state, setPositionSystemState, loading };
}
