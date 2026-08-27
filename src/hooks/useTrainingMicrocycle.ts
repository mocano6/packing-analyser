"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type {
  TrainingDayTitleTemplate,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import {
  TRAINING_MICROCYCLE_TASKS_DOC_ID,
  TRAINING_MICROCYCLE_VERSION,
} from "@/types/trainingMicrocycle";
import {
  buildTrainingMicrocycleTaskDocument,
  extractDayTitleTemplatesFromMicrocycleRaw,
  migrateTrainingMicrocycleFromFirestore,
} from "@/lib/trainingMicrocycleFirestore";
import { teamStaffStateDocRef, userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import { createDefaultTrainingMicrocycleState } from "@/utils/trainingMicrocycle";
import toast from "react-hot-toast";

function defaultState(): TrainingMicrocycleState {
  return createDefaultTrainingMicrocycleState();
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return (
    n === TRAINING_MICROCYCLE_VERSION ||
    n === 10 ||
    n === 9 ||
    n === 8 ||
    n === 7 ||
    n === 6 ||
    n === 5 ||
    n === 4 ||
    n === 3 ||
    n === 2 ||
    n === 1
  );
}

function innerFromRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  return jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;
}

export function useTrainingMicrocycle(teamId: string | null, uid: string | null) {
  const [state, setState] = useState<TrainingMicrocycleState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [embeddedDayTitleTemplates, setEmbeddedDayTitleTemplates] = useState<
    TrainingDayTitleTemplate[]
  >([]);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!teamId || !uid) {
      setState(defaultState());
      setEmbeddedDayTitleTemplates([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEmbeddedDayTitleTemplates([]);
      try {
        const teamRef = teamStaffStateDocRef(teamId, TRAINING_MICROCYCLE_TASKS_DOC_ID);
        const teamSnap = await getDoc(teamRef);
        if (cancelled) return;

        const applyLoaded = (raw: Record<string, unknown>, persistToTeam = false) => {
          const inner = innerFromRaw(raw);
          const embedded = extractDayTitleTemplatesFromMicrocycleRaw(inner);
          if (embedded.length > 0) {
            setEmbeddedDayTitleTemplates(embedded);
          }
          const migrated = migrateTrainingMicrocycleFromFirestore(raw);
          skipSaveOnce.current = true;
          setState(migrated);
          if (persistToTeam) {
            return setDoc(
              teamRef,
              buildTrainingMicrocycleTaskDocument(migrated, Date.now())
            );
          }
          return Promise.resolve();
        };

        if (teamSnap.exists()) {
          const d = teamSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const inner = innerFromRaw(d);
              const hadEmbeddedTemplates =
                extractDayTitleTemplatesFromMicrocycleRaw(inner).length > 0;
              await applyLoaded(d, hadEmbeddedTemplates);
            } catch (parseErr) {
              console.error("Parsowanie mikrocykli:", parseErr);
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
          userLegacyTasksDocRef(uid, TRAINING_MICROCYCLE_TASKS_DOC_ID)
        );
        if (cancelled) return;

        if (legacySnap.exists()) {
          const d = legacySnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              await applyLoaded(d, true);
            } catch (parseErr) {
              console.error("Migracja mikrocykli z konta użytkownika:", parseErr);
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
        console.error("Błąd ładowania mikrocykli:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultState());
          toast.error("Nie udało się wczytać mikrocykli treningowych.");
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
      const payload = buildTrainingMicrocycleTaskDocument(state, Date.now());
      setDoc(teamStaffStateDocRef(teamId, TRAINING_MICROCYCLE_TASKS_DOC_ID), payload).catch(
        (e: unknown) => {
          console.error("Zapis mikrocykli:", e);
          toast.error("Nie udało się zapisać mikrocykli treningowych.", {
            id: "training-microcycle-save-error",
            duration: 6000,
          });
        }
      );
    }, 450);
    return () => clearTimeout(t);
  }, [state, teamId, uid, loading]);

  const setMicrocycleState = useCallback(
    (updater: TrainingMicrocycleState | ((prev: TrainingMicrocycleState) => TrainingMicrocycleState)) => {
      setState(updater);
    },
    []
  );

  const clearEmbeddedDayTitleTemplates = useCallback(() => {
    setEmbeddedDayTitleTemplates([]);
  }, []);

  return {
    state,
    setMicrocycleState,
    loading,
    embeddedDayTitleTemplates,
    clearEmbeddedDayTitleTemplates,
  };
}
