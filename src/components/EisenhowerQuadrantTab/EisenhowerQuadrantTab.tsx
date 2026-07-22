"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from "@/lib/firestoreWithMetrics";
import toast from "react-hot-toast";
import { GAME_MODEL_TASKS_DOC_ID } from "@/types/gameModel";
import { GAME_MODEL_PACKS_DOC_ID } from "@/types/gameModelPack";
import { POSITION_SYSTEM_TASKS_DOC_ID } from "@/types/positionSystem";
import {
  TRAINING_DAY_TITLE_TEMPLATES_DOC_ID,
  TRAINING_MICROCYCLE_TASKS_DOC_ID,
} from "@/types/trainingMicrocycle";
import {
  STAFF_PLANNER_TASKS_DOC_ID,
  STAFF_PLANNER_TASKS_DOC_ID_LEGACY,
} from "@/types/staffPlanner";
import {
  BOARD_COLUMNS,
  buildEisenhowerTaskDocument,
  DEFAULT_QUADRANT,
  DEFAULT_TASK_LANE,
  groupTasksByColumn,
  insertIndexFromPointer,
  moveTaskInBoard,
  nextOrderAtEnd,
  normalizeEisenhowerTask,
  quadrantShortLabel,
  taskColumnId,
  type BoardColumnId,
  type EisenhowerTask,
  type TaskLane,
} from "@/types/eisenhowerTask";
import styles from "@/app/admin/zadania/page.module.css";

const HIDDEN_TASK_DOC_IDS = new Set([
  STAFF_PLANNER_TASKS_DOC_ID,
  STAFF_PLANNER_TASKS_DOC_ID_LEGACY,
  GAME_MODEL_TASKS_DOC_ID,
  GAME_MODEL_PACKS_DOC_ID,
  POSITION_SYSTEM_TASKS_DOC_ID,
  TRAINING_DAY_TITLE_TEMPLATES_DOC_ID,
  TRAINING_MICROCYCLE_TASKS_DOC_ID,
]);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function tasksCollection(uid: string) {
  if (!db) throw new Error("Firestore nie jest zainicjalizowane");
  return collection(db, "users", uid, "tasks");
}

function taskDoc(uid: string, taskId: string) {
  if (!db) throw new Error("Firestore nie jest zainicjalizowane");
  return doc(db, "users", uid, "tasks", taskId);
}

export interface EisenhowerQuadrantTabProps {
  uid: string;
}

export default function EisenhowerQuadrantTab({ uid }: EisenhowerQuadrantTabProps) {
  const [tasks, setTasks] = useState<EisenhowerTask[]>([]);
  const [newText, setNewText] = useState("");
  const [newLane, setNewLane] = useState<TaskLane>(DEFAULT_TASK_LANE);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BoardColumnId | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [placeAfter, setPlaceAfter] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!db || !uid) {
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    try {
      const snapshot = await getDocs(tasksCollection(uid));
      const loaded: EisenhowerTask[] = snapshot.docs
        .filter((d) => !HIDDEN_TASK_DOC_IDS.has(d.id))
        .map((d) => normalizeEisenhowerTask(d.id, d.data() as Record<string, unknown>));
      setTasks(loaded);
    } catch (e) {
      console.error("Błąd ładowania zadań:", e);
      toast.error("Nie udało się załadować zadań. Sprawdź reguły Firestore (users/{uid}/tasks).");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }
    loadTasks();
  }, [uid, loadTasks]);

  const persistTask = useCallback(
    async (task: EisenhowerTask) => {
      if (!uid || !db) return;
      try {
        await setDoc(taskDoc(uid, task.id), buildEisenhowerTaskDocument(task));
      } catch (e) {
        console.error("Błąd zapisu zadania:", e);
        toast.error("Nie udało się zapisać zadania. Sprawdź konsolę i reguły Firestore.");
      }
    },
    [uid]
  );

  const persistMany = useCallback(
    async (list: EisenhowerTask[]) => {
      await Promise.all(list.map((t) => persistTask(t)));
    },
    [persistTask]
  );

  const removeTaskFromFirestore = useCallback(
    async (taskId: string) => {
      if (!uid || !db) return;
      try {
        await deleteDoc(taskDoc(uid, taskId));
      } catch (e) {
        console.error("Błąd usuwania zadania:", e);
        toast.error("Nie udało się usunąć zadania. Spróbuj ponownie.");
      }
    },
    [uid]
  );

  const byColumn = useMemo(() => groupTasksByColumn(tasks), [tasks]);

  const addTask = useCallback(() => {
    const trimmed = newText.trim();
    if (!trimmed || !uid) return;
    const columnId: BoardColumnId =
      newLane === "backlog" ? "backlog" : DEFAULT_QUADRANT;
    const order = nextOrderAtEnd(byColumn[columnId]);
    const task: EisenhowerTask = {
      id: generateId(),
      text: trimmed,
      quadrant: DEFAULT_QUADRANT,
      lane: newLane,
      order,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    setNewText("");
    persistTask(task);
  }, [newText, newLane, uid, byColumn, persistTask]);

  const removeTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      removeTaskFromFirestore(id);
    },
    [removeTaskFromFirestore]
  );

  const toggleCompleted = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (!task) return prev;
        const toggled = { ...task, completed: !task.completed };
        const columnId = taskColumnId(toggled);
        const list = groupTasksByColumn(prev)[columnId];
        // Ukończone → na dół; odznaczenie → na koniec aktywnych
        const insertIndex = toggled.completed
          ? list.length
          : list.filter((t) => t.id !== id && !t.completed).length;
        const withToggle = prev.map((t) => (t.id === id ? toggled : t));
        const { tasks: next, changed } = moveTaskInBoard(
          withToggle,
          id,
          columnId,
          insertIndex
        );
        if (changed.length) {
          void persistMany(changed);
          return next;
        }
        void persistTask(toggled);
        return withToggle;
      });
    },
    [persistMany, persistTask]
  );

  const applyMove = useCallback(
    (taskId: string, columnId: BoardColumnId, insertIndex: number) => {
      setTasks((prev) => {
        const { tasks: next, changed } = moveTaskInBoard(prev, taskId, columnId, insertIndex);
        if (changed.length) void persistMany(changed);
        return next;
      });
    },
    [persistMany]
  );

  const clearDragState = useCallback(() => {
    setDragTaskId(null);
    setDragOverColumn(null);
    setDragOverTaskId(null);
    setPlaceAfter(false);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, columnId: BoardColumnId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverColumn(columnId);
      // Drop na puste miejsce kolumny (nie na kartę) → na koniec
      if ((e.target as HTMLElement).closest?.(`.${styles.taskCard}`)) return;
      setDragOverTaskId(null);
      setPlaceAfter(false);
    },
    []
  );

  const handleCardDragOver = useCallback(
    (e: React.DragEvent, columnId: BoardColumnId, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (taskId === dragTaskId) return;
      setDragOverColumn(columnId);
      setDragOverTaskId(taskId);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPlaceAfter(e.clientY > rect.top + rect.height / 2);
    },
    [dragTaskId]
  );

  const handleDropOnColumn = useCallback(
    (e: React.DragEvent, columnId: BoardColumnId) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain") || dragTaskId;
      if (!taskId) {
        clearDragState();
        return;
      }
      const columnTasks = byColumn[columnId];
      const index = insertIndexFromPointer(columnTasks, dragOverTaskId, placeAfter);
      applyMove(taskId, columnId, index);
      clearDragState();
    },
    [applyMove, byColumn, clearDragState, dragOverTaskId, dragTaskId, placeAfter]
  );

  const hasCompleted = useMemo(() => tasks.some((t) => t.completed), [tasks]);

  const removeCompleted = useCallback(() => {
    const toRemove = tasks.filter((t) => t.completed);
    setTasks((prev) => prev.filter((t) => !t.completed));
    toRemove.forEach((t) => removeTaskFromFirestore(t.id));
  }, [tasks, removeTaskFromFirestore]);

  if (tasksLoading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} aria-hidden />
      </div>
    );
  }

  return (
    <>
      <section className={styles.addSection}>
        <h2 className={styles.addTitle}>Dodaj zadanie</h2>
        <p className={styles.addHint}>
          Tablica jak w Trello: przeciągaj karty między kolumnami i zmieniaj kolejność w kolumnie.
          W backlogu góra listy = najwyższy priorytet (Product Backlog).
        </p>
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Opis zadania..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            aria-label="Opis zadania"
          />
          <select
            className={styles.select}
            value={newLane}
            onChange={(e) => setNewLane(e.target.value as TaskLane)}
            aria-label="Gdzie dodać zadanie"
          >
            <option value="matrix">Aktualne — Pilne i ważne</option>
            <option value="backlog">Backlog produktu</option>
          </select>
          <button
            type="button"
            className={styles.addButton}
            onClick={addTask}
            disabled={!newText.trim()}
          >
            Dodaj
          </button>
        </div>
      </section>

      {hasCompleted && (
        <div className={styles.removeRow}>
          <button
            type="button"
            className={styles.removeCompletedButton}
            onClick={removeCompleted}
          >
            Usuń zakończone
          </button>
        </div>
      )}

      <div className={styles.trelloBoard} role="region" aria-label="Tablica zadań">
        {BOARD_COLUMNS.map((column) => {
          const columnTasks = byColumn[column.id];
          const isOver = dragOverColumn === column.id;
          return (
            <section
              key={column.id}
              className={`${styles.trelloColumn} ${isOver ? styles.trelloColumnDragOver : ""}`}
              data-column={column.id}
              aria-labelledby={`col-${column.id}`}
              onDragOver={(e) => handleColumnDragOver(e, column.id)}
              onDrop={(e) => handleDropOnColumn(e, column.id)}
            >
              <header className={styles.trelloColumnHeader}>
                <div className={styles.trelloColumnTitleRow}>
                  <h3 id={`col-${column.id}`} className={styles.trelloColumnTitle}>
                    {column.title}
                  </h3>
                  <span className={styles.trelloColumnCount} aria-label={`${columnTasks.length} zadań`}>
                    {columnTasks.length}
                  </span>
                </div>
                <p className={styles.trelloColumnSubtitle}>{column.subtitle}</p>
              </header>

              <ul className={styles.trelloCardList} role="list">
                {columnTasks.length === 0 && (
                  <li className={styles.trelloEmpty} role="status">
                    Upuść kartę tutaj
                  </li>
                )}
                {columnTasks.map((task, index) => {
                  const showIndicator =
                    dragTaskId &&
                    dragOverColumn === column.id &&
                    dragOverTaskId === task.id;
                  const rankLabel =
                    column.id === "backlog" && !task.completed ? `#${index + 1}` : null;
                  return (
                    <li
                      key={task.id}
                      className={`${styles.taskCard} ${
                        dragTaskId === task.id ? styles.taskCardDragging : ""
                      } ${column.id === "backlog" ? styles.taskCardBacklog : ""}`}
                      data-quadrant={task.quadrant}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, column.id, task.id)}
                      onDrop={(e) => handleDropOnColumn(e, column.id)}
                    >
                      {showIndicator && !placeAfter && (
                        <div className={styles.dropIndicator} aria-hidden />
                      )}
                      <div className={styles.taskCardInner}>
                        <span className={styles.dragHandle} aria-hidden title="Przeciągnij">
                          ⋮⋮
                        </span>
                        <label className={styles.taskLabel}>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleCompleted(task.id)}
                            className={styles.checkbox}
                            aria-label={`Zaznacz jako zakończone: ${task.text}`}
                          />
                          <span className={styles.taskBody}>
                            <span className={styles.taskMetaRow}>
                              {rankLabel && (
                                <span className={styles.rankBadge} title="Priorytet w backlogu">
                                  {rankLabel}
                                </span>
                              )}
                              {column.id === "backlog" && (
                                <span
                                  className={styles.quadrantBadge}
                                  data-quadrant={task.quadrant}
                                  title={`Priorytet Eisenhowera: ${quadrantShortLabel(task.quadrant)}`}
                                >
                                  {quadrantShortLabel(task.quadrant)}
                                </span>
                              )}
                            </span>
                            <span
                              className={
                                task.completed ? styles.taskTextCompleted : styles.taskText
                              }
                            >
                              {task.text}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className={styles.deleteTaskButton}
                          onClick={() => removeTask(task.id)}
                          aria-label={`Usuń zadanie: ${task.text}`}
                          title="Usuń"
                        >
                          Usuń
                        </button>
                      </div>
                      {showIndicator && placeAfter && (
                        <div className={styles.dropIndicator} aria-hidden />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
