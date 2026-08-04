"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { TrainingProceduralTaskTemplatesState } from "@/types/trainingMicrocycle";
import {
  TRAINING_PROCEDURAL_TASK_TEMPLATES_DOC_ID,
  TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION,
} from "@/types/trainingMicrocycle";
import {
  buildTrainingProceduralTaskTemplatesTaskDocument,
  defaultTrainingProceduralTaskTemplatesState,
  migrateTrainingProceduralTaskTemplatesFromFirestore,
} from "@/lib/trainingProceduralTaskTemplatesFirestore";
import { userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function proceduralTemplatesDoc(uid: string) {
  return userLegacyTasksDocRef(uid, TRAINING_PROCEDURAL_TASK_TEMPLATES_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION;
}

export function useTrainingProceduralTaskTemplates(uid: string | null) {
  const [state, setState] = useState<TrainingProceduralTaskTemplatesState>(
    defaultTrainingProceduralTaskTemplatesState
  );
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultTrainingProceduralTaskTemplatesState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(proceduralTemplatesDoc(uid));
        if (cancelled) return;

        if (docSnap.exists()) {
          const d = docSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateTrainingProceduralTaskTemplatesFromFirestore(d);
              if (migrated.templates.length > 0) {
                skipSaveOnce.current = true;
                setState(migrated);
              } else {
                // Pusty dokument = pierwsze wejście → seed + zapis
                skipSaveOnce.current = false;
                setState(defaultTrainingProceduralTaskTemplatesState(true));
              }
            } catch (parseErr) {
              console.error("Parsowanie szablonów zadań procesowych:", parseErr);
              skipSaveOnce.current = false;
              setState(defaultTrainingProceduralTaskTemplatesState(true));
            }
          } else {
            skipSaveOnce.current = false;
            setState(defaultTrainingProceduralTaskTemplatesState(true));
          }
          return;
        }

        // Brak dokumentu — seed startowy i zapis przy następnym efekcie
        skipSaveOnce.current = false;
        setState(defaultTrainingProceduralTaskTemplatesState(true));
      } catch (e) {
        console.error("Błąd ładowania szablonów zadań procesowych:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultTrainingProceduralTaskTemplatesState(true));
          toast.error("Nie udało się wczytać szablonów zadań procesowych.");
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
      const payload = buildTrainingProceduralTaskTemplatesTaskDocument(state, Date.now());
      setDoc(proceduralTemplatesDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis szablonów zadań procesowych:", e);
        toast.error("Nie udało się zapisać szablonów zadań procesowych.", {
          id: "training-procedural-task-templates-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setProceduralTaskTemplatesState = useCallback(
    (
      updater:
        | TrainingProceduralTaskTemplatesState
        | ((prev: TrainingProceduralTaskTemplatesState) => TrainingProceduralTaskTemplatesState)
    ) => {
      setState(updater);
    },
    []
  );

  return { state, setProceduralTaskTemplatesState, loading };
}
