"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import type { StaffPlannerState } from "@/types/staffPlanner";
import {
  DEFAULT_STAFF_TASK_CATEGORY_ID,
  STAFF_PLANNER_TASKS_DOC_ID,
  STAFF_PLANNER_TASKS_DOC_ID_LEGACY,
  STAFF_PLANNER_VERSION,
} from "@/types/staffPlanner";
import { buildPlannerTaskDocument, safeDayIndex } from "@/lib/staffPlannerFirestore";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";
import toast from "react-hot-toast";

function defaultState(): StaffPlannerState {
  return {
    coaches: [],
    templates: [],
    assignments: [],
    matchDays: [5],
  };
}

/** Zapis pod `users/{uid}/tasks/` — reguły Firestore już wdrożone (jak Eisenhower). */
function plannerStateDoc(uid: string) {
  return doc(getDB(), "users", uid, "tasks", STAFF_PLANNER_TASKS_DOC_ID);
}

function plannerStateDocLegacyTasks(uid: string) {
  return doc(getDB(), "users", uid, "tasks", STAFF_PLANNER_TASKS_DOC_ID_LEGACY);
}

/** Stara ścieżka (tylko odczyt migracyjny). */
function legacyPlannerStateDoc(uid: string) {
  return doc(getDB(), "users", uid, "staffPlanner", "state");
}

function isValidCategoryId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** Firestore może zwrócić version jako number lub Long — porównujemy numerycznie. */
function isAcceptedPlannerVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === STAFF_PLANNER_VERSION || n === 1;
}

/** Odczyt z dokumentu Firestore (`stateJson` / `blob` lub spłaszczony legacy). */
function migrateFromFirestore(raw: Record<string, unknown>): StaffPlannerState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0
      ? raw.stateJson
      : typeof raw.blob === "string" && raw.blob.trim().length > 0
        ? raw.blob
        : null;
  if (jsonStr) {
    try {
      const inner = JSON.parse(jsonStr) as Record<string, unknown>;
      return migrateFlatFields(inner);
    } catch {
      // spłaszczony poniżej
    }
  }
  return migrateFlatFields(raw);
}

function migrateFlatFields(raw: Record<string, unknown>): StaffPlannerState {
  const coaches = Array.isArray(raw.coaches) ? (raw.coaches as StaffPlannerState["coaches"]) : [];

  let matchDays: number[] = [5];
  if (Array.isArray(raw.matchDays)) {
    matchDays = normalizeMatchDaysArray(raw.matchDays as number[]);
  } else if (typeof raw.matchDayIndex === "number" && raw.matchDayIndex >= 0 && raw.matchDayIndex <= 6) {
    matchDays = normalizeMatchDaysArray([raw.matchDayIndex]);
  }

  const templates: StaffPlannerState["templates"] = Array.isArray(raw.templates)
    ? (raw.templates as Record<string, unknown>[]).map((t) => ({
        id: String(t.id ?? ""),
        title: String(t.title ?? ""),
        repeatable: !!t.repeatable,
        defaultCoachId: (t.defaultCoachId as string | null) ?? null,
        categoryId: isValidCategoryId(t.categoryId)
          ? (t.categoryId as string)
          : DEFAULT_STAFF_TASK_CATEGORY_ID,
      }))
    : [];

  const assignments: StaffPlannerState["assignments"] = Array.isArray(raw.assignments)
    ? (raw.assignments as Record<string, unknown>[]).map((a) => ({
        id: String(a.id ?? ""),
        weekStartIso: String(a.weekStartIso ?? ""),
        dayIndex: safeDayIndex(a.dayIndex),
        coachId: String(a.coachId ?? ""),
        title: String(a.title ?? ""),
        templateId: (a.templateId as string | null) ?? null,
        categoryId: isValidCategoryId(a.categoryId)
          ? (a.categoryId as string)
          : DEFAULT_STAFF_TASK_CATEGORY_ID,
      }))
    : [];

  return { coaches, templates, assignments, matchDays };
}

export function useStaffPlanner(uid: string | null) {
  const [state, setState] = useState<StaffPlannerState>(defaultState);
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
        let primary = await getDoc(plannerStateDoc(uid));
        let loadedFromLegacyTasksDoc = false;
        if (!primary.exists()) {
          try {
            const oldTasks = await getDoc(plannerStateDocLegacyTasks(uid));
            if (oldTasks.exists()) {
              primary = oldTasks;
              loadedFromLegacyTasksDoc = true;
            }
          } catch {
            // brak odczytu starego id dokumentu w tasks
          }
        }
        if (cancelled) return;

        if (primary.exists()) {
          const d = primary.data() as Record<string, unknown>;
          const v = d.version;
          if (isAcceptedPlannerVersion(v)) {
            try {
              const migrated = migrateFromFirestore(d);
              skipSaveOnce.current = true;
              setState(migrated);
              if (loadedFromLegacyTasksDoc) {
                try {
                  await setDoc(plannerStateDoc(uid), buildPlannerTaskDocument(migrated, Date.now()));
                } catch (migrateErr) {
                  console.error("Migracja planu na staffPlannerState:", migrateErr);
                }
              }
            } catch (parseErr) {
              console.error("Parsowanie planu sztabu (primary):", parseErr);
              skipSaveOnce.current = true;
              setState(defaultState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(defaultState());
          }
        } else {
          /** Legacy ścieżka — na wielu projektach brak reguły odczytu → permission-denied; ignorujemy. */
          let legacyData: Record<string, unknown> | null = null;
          try {
            const legacy = await getDoc(legacyPlannerStateDoc(uid));
            if (legacy.exists()) {
              legacyData = legacy.data() as Record<string, unknown>;
            }
          } catch (legacyErr) {
            console.warn("Pominięto odczyt legacy users/.../staffPlanner/state:", legacyErr);
          }
          if (cancelled) return;

          if (legacyData) {
            const d = legacyData;
            const v = d.version;
            if (isAcceptedPlannerVersion(v)) {
              try {
                const migrated = migrateFromFirestore(d);
                skipSaveOnce.current = true;
                setState(migrated);
                try {
                  await setDoc(plannerStateDoc(uid), buildPlannerTaskDocument(migrated, Date.now()));
                } catch (migrateErr) {
                  console.error("Migracja planu sztabu do tasks/staffPlannerState:", migrateErr);
                }
              } catch (parseErr) {
                console.error("Parsowanie planu sztabu (legacy):", parseErr);
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
        }
      } catch (e) {
        console.error("Błąd ładowania planu sztabu:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(defaultState());
          toast.error("Nie udało się wczytać planu sztabu.");
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
      const payload = buildPlannerTaskDocument(state, Date.now());
      setDoc(plannerStateDoc(uid), payload).catch((e: unknown) => {
        console.error("Zapis planu sztabu:", e);
        const code =
          e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
        const hint =
          code === "invalid-argument"
            ? " Nieprawidłowe dane dokumentu."
            : "";
        toast.error(
          `Nie udało się zapisać planu sztabu.${hint || " Sprawdź połączenie."}`,
          { id: "staff-planner-save-error", duration: 6000 }
        );
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, uid, loading]);

  const setPlannerState = useCallback((updater: StaffPlannerState | ((prev: StaffPlannerState) => StaffPlannerState)) => {
    setState(updater);
  }, []);

  return { state, setPlannerState, loading };
}
