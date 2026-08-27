"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { TrainingDaySessionTemplatesState } from "@/types/trainingMicrocycle";
import {
  TRAINING_DAY_SESSION_TEMPLATES_DOC_ID,
  TRAINING_DAY_SESSION_TEMPLATES_VERSION,
} from "@/types/trainingMicrocycle";
import {
  buildTrainingDaySessionTemplatesTaskDocument,
  defaultTrainingDaySessionTemplatesState,
  migrateTrainingDaySessionTemplatesFromFirestore,
} from "@/lib/trainingDaySessionTemplatesFirestore";
import { userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function sessionTemplatesDoc(uid: string) {
  return userLegacyTasksDocRef(uid, TRAINING_DAY_SESSION_TEMPLATES_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === TRAINING_DAY_SESSION_TEMPLATES_VERSION;
}

export function useTrainingDaySessionTemplates(uid: string | null) {
  const [state, setState] = useState<TrainingDaySessionTemplatesState>(
    defaultTrainingDaySessionTemplatesState
  );
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultTrainingDaySessionTemplatesState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(sessionTemplatesDoc(uid));
        if (cancelled) return;

        if (docSnap.exists()) {
          const d = docSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateTrainingDaySessionTemplatesFromFirestore(d);
              if (migrated.templates.length > 0) {
                skipSaveOnce.current = true;
                setState(migrated);
              } else {
                skipSaveOnce.current = false;
                setState(defaultTrainingDaySessionTemplatesState(true));
              }
            } catch (parseErr) {
              console.error("Parsowanie presetów dni MD:", parseErr);
              skipSaveOnce.current = false;
              setState(defaultTrainingDaySessionTemplatesState(true));
            }
          } else {
            skipSaveOnce.current = false;
            setState(defaultTrainingDaySessionTemplatesState(true));
          }
          return;
        }

        skipSaveOnce.current = false;
        setState(defaultTrainingDaySessionTemplatesState(true));
      } catch (e) {
        console.error("Błąd ładowania presetów dni MD:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultTrainingDaySessionTemplatesState(true));
          toast.error("Nie udało się wczytać presetów dni treningowych.");
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
      const payload = buildTrainingDaySessionTemplatesTaskDocument(state, Date.now());
      setDoc(sessionTemplatesDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis presetów dni MD:", e);
        toast.error("Nie udało się zapisać presetów dni treningowych.", {
          id: "training-day-session-templates-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setDaySessionTemplatesState = useCallback(
    (
      updater:
        | TrainingDaySessionTemplatesState
        | ((prev: TrainingDaySessionTemplatesState) => TrainingDaySessionTemplatesState)
    ) => {
      setState(updater);
    },
    []
  );

  return { state, setDaySessionTemplatesState, loading };
}
