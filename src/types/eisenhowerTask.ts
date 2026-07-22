/**
 * Zadania Eisenhowera + backlog produktu (Scrum / Trello).
 * Macierz = zadania aktualne; backlog = Product Backlog.
 * `order` — kolejność w kolumnie (mniejsza = wyżej = wyższy priorytet).
 */

export type QuadrantId =
  | "urgent-important"
  | "important-not-urgent"
  | "urgent-not-important"
  | "not-urgent-not-important";

/** Gdzie leży zadanie: macierz (aktualne) vs backlog produktu. */
export type TaskLane = "matrix" | "backlog";

export interface EisenhowerTask {
  id: string;
  text: string;
  /** Priorytet Eisenhowera — zachowywany też w backlogu (kolor / etykieta). */
  quadrant: QuadrantId;
  /** Macierz = aktualne; backlog = Product Backlog. */
  lane: TaskLane;
  /**
   * Kolejność w kolumnie (jak w Trello / Product Backlog).
   * Mniejsza wartość = wyżej na liście = wyższy priorytet.
   */
  order: number;
  completed: boolean;
  createdAt: number;
}

/** Identyfikator kolumny tablicy (Trello-like). */
export type BoardColumnId = "backlog" | QuadrantId;

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

/** Kolumny tablicy: backlog na początku (Scrum), potem kwadranty Eisenhowera. */
export const BOARD_COLUMNS: {
  id: BoardColumnId;
  title: string;
  subtitle: string;
  lane: TaskLane;
  quadrant: QuadrantId | null;
}[] = [
  {
    id: "backlog",
    title: "Backlog produktu",
    subtitle: "Góra = najwyższy priorytet",
    lane: "backlog",
    quadrant: null,
  },
  ...QUADRANT_META.map((q) => ({
    id: q.id as BoardColumnId,
    title: q.title,
    subtitle: q.subtitle,
    lane: "matrix" as TaskLane,
    quadrant: q.id,
  })),
];

export const DEFAULT_QUADRANT: QuadrantId = "urgent-important";
export const DEFAULT_TASK_LANE: TaskLane = "matrix";
/** Odstęp między kolejnymi `order` — stabilna renumeracja kolumny. */
export const ORDER_GAP = 1000;

const QUADRANT_IDS = new Set<string>(QUADRANT_META.map((q) => q.id));

export function isQuadrantId(value: unknown): value is QuadrantId {
  return typeof value === "string" && QUADRANT_IDS.has(value);
}

export function isTaskLane(value: unknown): value is TaskLane {
  return value === "matrix" || value === "backlog";
}

export function quadrantShortLabel(quadrant: QuadrantId): string {
  return QUADRANT_META.find((q) => q.id === quadrant)?.shortLabel ?? quadrant;
}

export function taskColumnId(task: Pick<EisenhowerTask, "lane" | "quadrant">): BoardColumnId {
  return task.lane === "backlog" ? "backlog" : task.quadrant;
}

export function columnPlacement(columnId: BoardColumnId): {
  lane: TaskLane;
  /** Kwadrant kolumny macierzy; dla backlogu — domyślny (nadpisywany zachowaniem koloru). */
  quadrant: QuadrantId;
} {
  if (columnId === "backlog") {
    return { lane: "backlog", quadrant: DEFAULT_QUADRANT };
  }
  return { lane: "matrix", quadrant: columnId };
}

/**
 * Normalizacja dokumentu Firestore → EisenhowerTask.
 * Brak `lane` = macierz; brak `order` = createdAt (kompatybilność wsteczna).
 */
export function normalizeEisenhowerTask(
  id: string,
  data: Record<string, unknown>
): EisenhowerTask {
  const quadrant = isQuadrantId(data.quadrant) ? data.quadrant : DEFAULT_QUADRANT;
  const lane = isTaskLane(data.lane) ? data.lane : DEFAULT_TASK_LANE;
  const createdAt = typeof data.createdAt === "number" ? data.createdAt : 0;
  const order =
    typeof data.order === "number" && Number.isFinite(data.order) ? data.order : createdAt;
  return {
    id,
    text: typeof data.text === "string" ? data.text : "",
    quadrant,
    lane,
    order,
    completed: !!data.completed,
    createdAt,
  };
}

/** Payload do zapisu w Firestore (tylko pola modelu). */
export function buildEisenhowerTaskDocument(task: EisenhowerTask): {
  text: string;
  quadrant: QuadrantId;
  lane: TaskLane;
  order: number;
  completed: boolean;
  createdAt: number;
} {
  return {
    text: task.text,
    quadrant: task.quadrant,
    lane: task.lane,
    order: task.order,
    completed: task.completed,
    createdAt: task.createdAt,
  };
}

/** Sortowanie kolumny: aktywne nad ukończonymi, potem `order`, potem createdAt. */
export function sortEisenhowerTasks(a: EisenhowerTask, b: EisenhowerTask): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
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
    "urgent-important": [],
    "important-not-urgent": [],
    "urgent-not-important": [],
    "not-urgent-not-important": [],
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

/**
 * Składa listę kolumny po dropie: aktywne i ukończone osobno.
 * Ukończone zawsze na dole (best practice Done / completed).
 */
export function buildColumnOrderAfterMove(
  othersSorted: EisenhowerTask[],
  dragged: EisenhowerTask,
  insertIndex: number
): EisenhowerTask[] {
  const active = othersSorted.filter((t) => !t.completed);
  const completed = othersSorted.filter((t) => t.completed);

  if (dragged.completed) {
    const idx = Math.max(0, Math.min(insertIndex - active.length, completed.length));
    const nextCompleted = [...completed];
    nextCompleted.splice(idx, 0, dragged);
    return [...active, ...nextCompleted];
  }

  const idx = Math.max(0, Math.min(insertIndex, active.length));
  const nextActive = [...active];
  nextActive.splice(idx, 0, dragged);
  return [...nextActive, ...completed];
}

/**
 * Przenosi zadanie do kolumny na pozycję `insertIndex` i renumeruje `order`.
 * Zwraca pełną listę oraz zadania, których dokumenty trzeba zapisać.
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

  // Przy przeciąganiu w tej samej kolumnie indeks dropu jest względem listy z elementem —
  // po usunięciu przeciąganego trzeba skorygować, inaczej karta „przeskoczy” o 1.
  let adjustedIndex = insertIndex;
  if (sourceColumn === targetColumn && fromIndex >= 0 && insertIndex > fromIndex) {
    adjustedIndex = insertIndex - 1;
  }
  if (sourceColumn === targetColumn && fromIndex >= 0 && adjustedIndex === fromIndex) {
    return { tasks: allTasks, changed: [] };
  }

  const placement = columnPlacement(targetColumn);
  const nextQuadrant =
    targetColumn === "backlog" ? dragged.quadrant : placement.quadrant;

  const relocated: EisenhowerTask = {
    ...dragged,
    lane: placement.lane,
    quadrant: nextQuadrant,
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
    if (
      !orig ||
      orig.order !== t.order ||
      orig.lane !== t.lane ||
      orig.quadrant !== t.quadrant
    ) {
      changed.push(t);
    }
  }

  if (changed.length === 0) return { tasks: allTasks, changed: [] };
  return { tasks, changed };
}

/** Kolejny `order` na końcu aktywnych w kolumnie. */
export function nextOrderAtEnd(columnTasks: EisenhowerTask[]): number {
  const active = columnTasks.filter((t) => !t.completed);
  if (active.length === 0) return ORDER_GAP;
  return Math.max(...active.map((t) => t.order)) + ORDER_GAP;
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
