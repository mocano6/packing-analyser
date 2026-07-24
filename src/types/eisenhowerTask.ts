/**
 * Tablica zadań Kanban (Scrum / Agile / Lean).
 * Kolumny = status workflow; kwadrant Eisenhowera = tylko priorytet (kolor / etykieta).
 * `order` — kolejność w kolumnie (mniejsza = wyżej).
 */

export type QuadrantId =
  | "urgent-important"
  | "important-not-urgent"
  | "urgent-not-important"
  | "not-urgent-not-important";

/** Status workflow — odpowiada kolumnie tablicy. */
export type TaskStatus = "backlog" | "todo" | "in_progress" | "rework" | "done";

/** @deprecated Używaj TaskStatus — zostawione do migracji starych dokumentów. */
export type TaskLane = "matrix" | "backlog";

export interface EisenhowerTask {
  id: string;
  text: string;
  /** Priorytet Eisenhowera — kolor / etykieta na karcie (nie kolumna). */
  quadrant: QuadrantId;
  /** Kolumna tablicy (workflow). */
  status: TaskStatus;
  /**
   * Kolejność w kolumnie (jak w Trello / Product Backlog).
   * Mniejsza wartość = wyżej na liście.
   */
  order: number;
  createdAt: number;
}

/** Identyfikator kolumny tablicy = status. */
export type BoardColumnId = TaskStatus;

export const QUADRANT_META: {
  id: QuadrantId;
  title: string;
  subtitle: string;
  shortLabel: string;
}[] = [
  {
    id: "urgent-important",
    title: "Pilne i ważne",
    subtitle: "Zrób od razu",
    shortLabel: "Pilne · ważne",
  },
  {
    id: "important-not-urgent",
    title: "Ważne, niepilne",
    subtitle: "Zaplanuj",
    shortLabel: "Ważne · niepilne",
  },
  {
    id: "urgent-not-important",
    title: "Pilne, nieważne",
    subtitle: "Zdeleguj",
    shortLabel: "Pilne · nieważne",
  },
  {
    id: "not-urgent-not-important",
    title: "Nieważne, niepilne",
    subtitle: "Usuń lub odłóż",
    shortLabel: "Nieważne · niepilne",
  },
];

/** Kolumny Kanban: statusy workflow. */
export const BOARD_COLUMNS: {
  id: BoardColumnId;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "backlog",
    title: "Backlog",
    subtitle: "Góra = wyższy priorytet kolejki",
  },
  {
    id: "todo",
    title: "Do zrobienia",
    subtitle: "Gotowe do startu",
  },
  {
    id: "in_progress",
    title: "W trakcie",
    subtitle: "Aktualna praca",
  },
  {
    id: "rework",
    title: "Do poprawy",
    subtitle: "Poprawki / blokady",
  },
  {
    id: "done",
    title: "Zrobione",
    subtitle: "Ukończone",
  },
];

export const DEFAULT_QUADRANT: QuadrantId = "urgent-important";
export const DEFAULT_TASK_STATUS: TaskStatus = "todo";
/** @deprecated */
export const DEFAULT_TASK_LANE: TaskLane = "matrix";
/** Odstęp między kolejnymi `order` — stabilna renumeracja kolumny. */
export const ORDER_GAP = 1000;

const QUADRANT_IDS = new Set<string>(QUADRANT_META.map((q) => q.id));
const STATUS_IDS = new Set<string>(BOARD_COLUMNS.map((c) => c.id));

export function isQuadrantId(value: unknown): value is QuadrantId {
  return typeof value === "string" && QUADRANT_IDS.has(value);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && STATUS_IDS.has(value);
}

/** @deprecated */
export function isTaskLane(value: unknown): value is TaskLane {
  return value === "matrix" || value === "backlog";
}

export function quadrantShortLabel(quadrant: QuadrantId): string {
  return QUADRANT_META.find((q) => q.id === quadrant)?.shortLabel ?? quadrant;
}

export function taskColumnId(task: Pick<EisenhowerTask, "status">): BoardColumnId {
  return task.status;
}

/**
 * Migracja starego modelu (lane + completed + quadrant-as-column)
 * → status workflow.
 */
export function migrateLegacyStatus(data: Record<string, unknown>): TaskStatus {
  if (isTaskStatus(data.status)) return data.status;

  const completed = !!data.completed;
  if (completed) return "done";

  if (data.lane === "backlog") return "backlog";

  // Stara macierz: zadania „aktualne” → w trakcie
  if (data.lane === "matrix") return "in_progress";

  // Dokumenty tylko z quadrant (bez lane) — traktuj jak aktualne
  if (isQuadrantId(data.quadrant) && data.lane == null) return "in_progress";

  return DEFAULT_TASK_STATUS;
}

/**
 * Normalizacja dokumentu Firestore → EisenhowerTask.
 * Wspiera stare dokumenty z `lane` / `completed`.
 */
export function normalizeEisenhowerTask(
  id: string,
  data: Record<string, unknown>
): EisenhowerTask {
  const quadrant = isQuadrantId(data.quadrant) ? data.quadrant : DEFAULT_QUADRANT;
  const status = migrateLegacyStatus(data);
  const createdAt = typeof data.createdAt === "number" ? data.createdAt : 0;
  const order =
    typeof data.order === "number" && Number.isFinite(data.order) ? data.order : createdAt;
  return {
    id,
    text: typeof data.text === "string" ? data.text : "",
    quadrant,
    status,
    order,
    createdAt,
  };
}

/** Payload do zapisu w Firestore (tylko pola modelu). */
export function buildEisenhowerTaskDocument(task: EisenhowerTask): {
  text: string;
  quadrant: QuadrantId;
  status: TaskStatus;
  order: number;
  createdAt: number;
  /** Kompatybilność wsteczna — stare UI mogło czytać completed. */
  completed: boolean;
  /** Kompatybilność wsteczna — stare UI mogło czytać lane. */
  lane: TaskLane;
} {
  return {
    text: task.text,
    quadrant: task.quadrant,
    status: task.status,
    order: task.order,
    createdAt: task.createdAt,
    completed: task.status === "done",
    lane: task.status === "backlog" ? "backlog" : "matrix",
  };
}

/** Sortowanie kolumny: `order`, potem createdAt. */
export function sortEisenhowerTasks(a: EisenhowerTask, b: EisenhowerTask): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.createdAt - b.createdAt;
}

export function tasksInColumn(
  tasks: EisenhowerTask[],
  columnId: BoardColumnId
): EisenhowerTask[] {
  return tasks.filter((t) => taskColumnId(t) === columnId).sort(sortEisenhowerTasks);
}

export function groupTasksByColumn(
  tasks: EisenhowerTask[]
): Record<BoardColumnId, EisenhowerTask[]> {
  const map: Record<BoardColumnId, EisenhowerTask[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    rework: [],
    done: [],
  };
  for (const t of tasks) {
    map[taskColumnId(t)].push(t);
  }
  for (const key of Object.keys(map) as BoardColumnId[]) {
    map[key].sort(sortEisenhowerTasks);
  }
  return map;
}

/** Równomierna renumeracja `order` w kolumnie (po docelowej kolejności). */
export function renumberColumnOrders(ordered: EisenhowerTask[]): EisenhowerTask[] {
  return ordered.map((t, i) => ({
    ...t,
    order: (i + 1) * ORDER_GAP,
  }));
}

/** Składa listę kolumny po dropie. */
export function buildColumnOrderAfterMove(
  othersSorted: EisenhowerTask[],
  dragged: EisenhowerTask,
  insertIndex: number
): EisenhowerTask[] {
  const idx = Math.max(0, Math.min(insertIndex, othersSorted.length));
  const next = [...othersSorted];
  next.splice(idx, 0, dragged);
  return next;
}

/**
 * Przenosi zadanie do kolumny na pozycję `insertIndex` i renumeruje `order`.
 * Kwadrant (priorytet) nie zmienia się przy dropie.
 */
export function moveTaskInBoard(
  allTasks: EisenhowerTask[],
  taskId: string,
  targetColumn: BoardColumnId,
  insertIndex: number
): { tasks: EisenhowerTask[]; changed: EisenhowerTask[] } {
  const dragged = allTasks.find((t) => t.id === taskId);
  if (!dragged) return { tasks: allTasks, changed: [] };

  const sourceColumn = taskColumnId(dragged);
  const sourceList = tasksInColumn(allTasks, sourceColumn);
  const fromIndex = sourceList.findIndex((t) => t.id === taskId);

  let adjustedIndex = insertIndex;
  if (sourceColumn === targetColumn && fromIndex >= 0 && insertIndex > fromIndex) {
    adjustedIndex = insertIndex - 1;
  }
  if (sourceColumn === targetColumn && fromIndex >= 0 && adjustedIndex === fromIndex) {
    return { tasks: allTasks, changed: [] };
  }

  const relocated: EisenhowerTask = {
    ...dragged,
    status: targetColumn,
  };

  const others = allTasks
    .filter((t) => t.id !== taskId && taskColumnId(t) === targetColumn)
    .sort(sortEisenhowerTasks);

  const ordered = buildColumnOrderAfterMove(others, relocated, adjustedIndex);
  const renumbered = renumberColumnOrders(ordered);
  const byId = new Map(renumbered.map((t) => [t.id, t]));

  const sourceOthers =
    sourceColumn === targetColumn
      ? []
      : renumberColumnOrders(
          allTasks
            .filter((t) => t.id !== taskId && taskColumnId(t) === sourceColumn)
            .sort(sortEisenhowerTasks)
        );
  const sourceById = new Map(sourceOthers.map((t) => [t.id, t]));

  const tasks = allTasks.map((t) => byId.get(t.id) ?? sourceById.get(t.id) ?? t);

  const changed: EisenhowerTask[] = [];
  for (const t of [...renumbered, ...sourceOthers]) {
    const orig = allTasks.find((o) => o.id === t.id);
    if (!orig || orig.order !== t.order || orig.status !== t.status) {
      changed.push(t);
    }
  }

  if (changed.length === 0) return { tasks: allTasks, changed: [] };
  return { tasks, changed };
}

/** Kolejny `order` na końcu kolumny. */
export function nextOrderAtEnd(columnTasks: EisenhowerTask[]): number {
  if (columnTasks.length === 0) return ORDER_GAP;
  return Math.max(...columnTasks.map((t) => t.order)) + ORDER_GAP;
}

/** Indeks wstawienia na podstawie pozycji kursora względem karty. */
export function insertIndexFromPointer(
  columnTasks: EisenhowerTask[],
  overTaskId: string | null,
  placeAfter: boolean
): number {
  if (!overTaskId) return columnTasks.length;
  const idx = columnTasks.findIndex((t) => t.id === overTaskId);
  if (idx < 0) return columnTasks.length;
  return placeAfter ? idx + 1 : idx;
}
