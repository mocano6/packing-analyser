"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { TrainingExerciseTemplatesState } from "@/types/trainingMicrocycle";
import {
  TRAINING_EXERCISE_TEMPLATES_DOC_ID,
  TRAINING_EXERCISE_TEMPLATES_VERSION,
} from "@/types/trainingMicrocycle";
import {
  buildTrainingExerciseTemplatesTaskDocument,
  defaultTrainingExerciseTemplatesState,
  migrateTrainingExerciseTemplatesFromFirestore,
} from "@/lib/trainingExerciseTemplatesFirestore";
import { userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function exerciseTemplatesDoc(uid: string) {
  return userLegacyTasksDocRef(uid, TRAINING_EXERCISE_TEMPLATES_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === TRAINING_EXERCISE_TEMPLATES_VERSION;
}

export function useTrainingExerciseTemplates(uid: string | null) {
  const [state, setState] = useState<TrainingExerciseTemplatesState>(
    defaultTrainingExerciseTemplatesState
  );
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultTrainingExerciseTemplatesState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(exerciseTemplatesDoc(uid));
        if (cancelled) return;

        if (docSnap.exists()) {
          const d = docSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateTrainingExerciseTemplatesFromFirestore(d);
              if (migrated.templates.length > 0) {
                skipSaveOnce.current = true;
                setState(migrated);
              } else {
                skipSaveOnce.current = false;
                setState(defaultTrainingExerciseTemplatesState(true));
              }
            } catch (parseErr) {
              console.error("Parsowanie presetów ćwiczeń:", parseErr);
              skipSaveOnce.current = false;
              setState(defaultTrainingExerciseTemplatesState(true));
            }
          } else {
            skipSaveOnce.current = false;
            setState(defaultTrainingExerciseTemplatesState(true));
          }
          return;
        }

        skipSaveOnce.current = false;
        setState(defaultTrainingExerciseTemplatesState(true));
      } catch (e) {
        console.error("Błąd ładowania presetów ćwiczeń:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultTrainingExerciseTemplatesState(true));
          toast.error("Nie udało się wczytać presetów ćwiczeń.");
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
      const payload = buildTrainingExerciseTemplatesTaskDocument(state, Date.now());
      setDoc(exerciseTemplatesDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis presetów ćwiczeń:", e);
        toast.error("Nie udało się zapisać presetów ćwiczeń.", {
          id: "training-exercise-templates-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setExerciseTemplatesState = useCallback(
    (
      updater:
        | TrainingExerciseTemplatesState
        | ((prev: TrainingExerciseTemplatesState) => TrainingExerciseTemplatesState)
    ) => {
      setState(updater);
    },
    []
  );

  return { state, setExerciseTemplatesState, loading };
}
