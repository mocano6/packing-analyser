export interface StaffPlannerCoach {
  id: string;
  name: string;
  color: string;
}

/** Kategorie zadań sztabu — id stabilne (zapis w Firestore). */
export const STAFF_TASK_CATEGORIES = [
  { id: "motoryka", label: "Motoryka" },
  { id: "fizjoterapia", label: "Fizjoterapia" },
  { id: "technika", label: "Technika" },
  { id: "taktyka", label: "Taktyka" },
  { id: "organizacja", label: "Organizacja" },
  { id: "psychologia", label: "Psychologia" },
  { id: "inne", label: "Inne" },
] as const;

export const DEFAULT_STAFF_TASK_CATEGORY_ID = "taktyka" as const;

export function staffTaskCategoryLabel(categoryId: string): string {
  const f = STAFF_TASK_CATEGORIES.find((c) => c.id === categoryId);
  return f?.label ?? categoryId;
}

export interface StaffPlannerTaskTemplate {
  id: string;
  title: string;
  /** Szablon można wielokrotnie przeciągać na kalendarz */
  repeatable: boolean;
  defaultCoachId: string | null;
  categoryId: string;
}

export interface StaffPlannerAssignment {
  id: string;
  /** Poniedziałek tygodnia (YYYY-MM-DD) */
  weekStartIso: string;
  /** 0 = pn … 6 = nd */
  dayIndex: number;
  coachId: string;
  title: string;
  templateId: string | null;
  categoryId: string;
}

export interface StaffPlannerState {
  coaches: StaffPlannerCoach[];
  templates: StaffPlannerTaskTemplate[];
  assignments: StaffPlannerAssignment[];
  /**
   * Dni meczu w tygodniu (0 = pn … 6 = nd), posortowane rosnąco.
   * Jedna pozycja = jeden mecz; dwie = dwa mecze (np. liga + puchar).
   */
  matchDays: number[];
}

export const STAFF_PLANNER_VERSION = 2 as const;

/**
 * Dokument planu sztabu w `users/{uid}/tasks/{taskId}` — te same reguły co zadania Eisenhowera.
 * Nie pokazuj w kwadrancie (filtrowane po tym id).
 * (Bez podwójnych `__` w id — mniejsze ryzyko konfliktów z konwencjami.)
 */
export const STAFF_PLANNER_TASKS_DOC_ID = "staffPlannerState" as const;

/** Poprzednie id dokumentu — tylko odczyt migracyjny. */
export const STAFF_PLANNER_TASKS_DOC_ID_LEGACY = "__staffPlannerState__" as const;
