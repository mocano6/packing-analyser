"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type {
  TrainingDayTitleTemplate,
  TrainingDayTitleTemplatesState,
} from "@/types/trainingMicrocycle";
import {
  TRAINING_DAY_TITLE_TEMPLATES_DOC_ID,
  TRAINING_DAY_TITLE_TEMPLATES_VERSION,
  TRAINING_MICROCYCLE_TASKS_DOC_ID,
} from "@/types/trainingMicrocycle";
import {
  buildTrainingDayTitleTemplatesTaskDocument,
  defaultTrainingDayTitleTemplatesState,
  mergeTrainingDayTitleTemplates,
  migrateTrainingDayTitleTemplatesFromFirestore,
} from "@/lib/trainingDayTitleTemplatesFirestore";
import { userLegacyTasksDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function dayTitleTemplatesDoc(uid: string) {
  return userLegacyTasksDocRef(uid, TRAINING_DAY_TITLE_TEMPLATES_DOC_ID);
}

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === TRAINING_DAY_TITLE_TEMPLATES_VERSION;
}

export function useTrainingDayTitleTemplates(uid: string | null) {
  const [state, setState] = useState<TrainingDayTitleTemplatesState>(
    defaultTrainingDayTitleTemplatesState
  );
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!uid) {
      setState(defaultTrainingDayTitleTemplatesState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(dayTitleTemplatesDoc(uid));
        if (cancelled) return;

        if (docSnap.exists()) {
          const d = docSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              const migrated = migrateTrainingDayTitleTemplatesFromFirestore(d);
              skipSaveOnce.current = true;
              setState(migrated);
            } catch (parseErr) {
              console.error("Parsowanie szablonów tytułów dni:", parseErr);
              skipSaveOnce.current = true;
              setState(defaultTrainingDayTitleTemplatesState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultTrainingDayTitleTemplatesState());
          }
          return;
        }

        const legacyMicrocycleSnap = await getDoc(
          userLegacyTasksDocRef(uid, TRAINING_MICROCYCLE_TASKS_DOC_ID)
        );
        if (cancelled) return;

        if (legacyMicrocycleSnap.exists()) {
          const d = legacyMicrocycleSnap.data() as Record<string, unknown>;
          try {
            const migrated = migrateTrainingDayTitleTemplatesFromFirestore(d);
            skipSaveOnce.current = true;
            setState(migrated);
            if (migrated.templates.length > 0) {
              const payload = buildTrainingDayTitleTemplatesTaskDocument(migrated, Date.now());
              await setDoc(dayTitleTemplatesDoc(uid), payload);
            }
          } catch (parseErr) {
            console.error("Migracja szablonów tytułów dni:", parseErr);
            skipSaveOnce.current = true;
            setState(defaultTrainingDayTitleTemplatesState());
          }
          return;
        }

        skipSaveOnce.current = true;
        setState(defaultTrainingDayTitleTemplatesState());
      } catch (e) {
        console.error("Błąd ładowania szablonów tytułów dni:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultTrainingDayTitleTemplatesState());
          toast.error("Nie udało się wczytać szablonów tytułów dni treningowych.");
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
      const payload = buildTrainingDayTitleTemplatesTaskDocument(state, Date.now());
      setDoc(dayTitleTemplatesDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis szablonów tytułów dni:", e);
        toast.error("Nie udało się zapisać szablonów tytułów dni.", {
          id: "training-day-title-templates-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setDayTitleTemplatesState = useCallback(
    (
      updater:
        | TrainingDayTitleTemplatesState
        | ((prev: TrainingDayTitleTemplatesState) => TrainingDayTitleTemplatesState)
    ) => {
      setState(updater);
    },
    []
  );

  const mergeEmbeddedTemplates = useCallback((incoming: TrainingDayTitleTemplate[]) => {
    if (incoming.length === 0) return;
    setState((prev) => {
      const merged = mergeTrainingDayTitleTemplates(prev.templates, incoming);
      if (merged.length === prev.templates.length) {
        const unchanged = merged.every((t, i) => t.id === prev.templates[i]?.id);
        if (unchanged) return prev;
      }
      return { templates: merged };
    });
  }, []);

  return { state, setDayTitleTemplatesState, loading, mergeEmbeddedTemplates };
}
