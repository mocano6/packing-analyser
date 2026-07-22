"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { PositionSystemState } from "@/types/positionSystem";
import {
  POSITION_SYSTEM_TASKS_DOC_ID,
  POSITION_SYSTEM_VERSION,
} from "@/types/positionSystem";
import {
  buildPositionSystemTaskDocument,
  migratePositionSystemFromFirestore,
} from "@/lib/positionSystemFirestore";
import { teamStaffStateDocRef, userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function defaultState(): PositionSystemState {
  return { nodes: [] };
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === POSITION_SYSTEM_VERSION || n === 1 || n === 2;
}

export function usePositionSystem(teamId: string | null, uid: string | null) {
  const [state, setState] = useState<PositionSystemState>(defaultState);
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
        const teamRef = teamStaffStateDocRef(teamId, POSITION_SYSTEM_TASKS_DOC_ID);
        const teamSnap = await getDoc(teamRef);
        if (cancelled) return;

        const applyLoaded = (raw: Record<string, unknown>, persistToTeam = false) => {
          const migrated = migratePositionSystemFromFirestore(raw);
          skipSaveOnce.current = true;
          setState(migrated);
          if (persistToTeam) {
            return setDoc(teamRef, buildPositionSystemTaskDocument(migrated, Date.now()));
          }
          return Promise.resolve();
        };

        if (teamSnap.exists()) {
          const d = teamSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              await applyLoaded(d, false);
            } catch (parseErr) {
              console.error("Parsowanie systemu pozycji:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultState());
          }
          return;
        }

        const legacySnap = await getDoc(
          userLegacyTasksDocRef(uid, POSITION_SYSTEM_TASKS_DOC_ID)
        );
        if (cancelled) return;

        if (legacySnap.exists()) {
          const d = legacySnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              await applyLoaded(d, true);
            } catch (parseErr) {
              console.error("Migracja systemu pozycji z konta użytkownika:", parseErr);
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
  }, [teamId, uid]);

  useEffect(() => {
    if (!teamId || !uid || loading) return;
    if (skipSaveOnce.current) {
      skipSaveOnce.current = false;
      return;
    }
    const t = setTimeout(() => {
      const payload = buildPositionSystemTaskDocument(state, Date.now());
      setDoc(teamStaffStateDocRef(teamId, POSITION_SYSTEM_TASKS_DOC_ID), payload).catch(
        (e: unknown) => {
          console.error("Zapis systemu pozycji:", e);
          toast.error("Nie udało się zapisać systemu pozycji.", {
            id: "position-system-save-error",
            duration: 6000,
          });
        }
      );
    }, 450);
    return () => clearTimeout(t);
  }, [state, teamId, uid, loading]);

  const setPositionSystemState = useCallback(
    (updater: PositionSystemState | ((prev: PositionSystemState) => PositionSystemState)) => {
      setState(updater);
    },
    []
  );

  return { state, setPositionSystemState, loading };
}
