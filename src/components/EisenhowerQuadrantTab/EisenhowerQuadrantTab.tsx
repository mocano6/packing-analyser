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
  DEFAULT_TASK_STATUS,
  groupTasksByColumn,
  insertIndexFromPointer,
  moveTaskInBoard,
  nextOrderAtEnd,
  normalizeEisenhowerTask,
  QUADRANT_META,
  quadrantShortLabel,
  type BoardColumnId,
  type EisenhowerTask,
  type QuadrantId,
  type TaskStatus,
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
  const [newStatus, setNewStatus] = useState<TaskStatus>(DEFAULT_TASK_STATUS);
  const [newQuadrant, setNewQuadrant] = useState<QuadrantId>(DEFAULT_QUADRANT);
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
    const order = nextOrderAtEnd(byColumn[newStatus]);
    const task: EisenhowerTask = {
      id: generateId(),
      text: trimmed,
      quadrant: newQuadrant,
      status: newStatus,
      order,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    setNewText("");
    persistTask(task);
  }, [newText, newStatus, newQuadrant, uid, byColumn, persistTask]);

  const removeTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      removeTaskFromFirestore(id);
    },
    [removeTaskFromFirestore]
  );

  const setTaskQuadrant = useCallback(
    (id: string, quadrant: QuadrantId) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (!task || task.quadrant === quadrant) return prev;
        const updated = { ...task, quadrant };
        void persistTask(updated);
        return prev.map((t) => (t.id === id ? updated : t));
      });
    },
    [persistTask]
  );

  const toggleDone = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (!task) return prev;
        const targetStatus: TaskStatus = task.status === "done" ? "todo" : "done";
        const columnTasks = groupTasksByColumn(prev)[targetStatus];
        const insertIndex = columnTasks.length;
        const { tasks: next, changed } = moveTaskInBoard(prev, id, targetStatus, insertIndex);
        if (changed.length) {
          void persistMany(changed);
          return next;
        }
        return prev;
      });
    },
    [persistMany]
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

  const hasDone = useMemo(() => byColumn.done.length > 0, [byColumn]);

  const removeDone = useCallback(() => {
    const toRemove = byColumn.done;
    setTasks((prev) => prev.filter((t) => t.status !== "done"));
    toRemove.forEach((t) => removeTaskFromFirestore(t.id));
  }, [byColumn.done, removeTaskFromFirestore]);

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
          Kolumny to etapy pracy (Kanban). Priorytet Eisenhowera to tylko kolor karty — przeciąganie
          między kolumnami zmienia status, nie priorytet.
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
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
            aria-label="Status początkowy"
          >
            {BOARD_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.title}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={newQuadrant}
            onChange={(e) => setNewQuadrant(e.target.value as QuadrantId)}
            aria-label="Priorytet Eisenhowera"
          >
            {QUADRANT_META.map((q) => (
              <option key={q.id} value={q.id}>
                {q.shortLabel}
              </option>
            ))}
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

      {hasDone && (
        <div className={styles.removeRow}>
          <button type="button" className={styles.removeCompletedButton} onClick={removeDone}>
            Usuń zrobione
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
                  const isDone = task.status === "done";
                  const rankLabel = column.id === "backlog" ? `#${index + 1}` : null;
                  return (
                    <li
                      key={task.id}
                      className={`${styles.taskCard} ${
                        dragTaskId === task.id ? styles.taskCardDragging : ""
                      }`}
                      data-quadrant={task.quadrant}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, column.id, task.id)}
                      onDrop={(e) => {
                        e.stopPropagation();
                        handleDropOnColumn(e, column.id);
                      }}
                    >
                      {showIndicator && !placeAfter && (
                        <div className={styles.dropIndicator} aria-hidden />
                      )}
                      <div className={styles.taskCardInner}>
                        <span className={styles.dragHandle} aria-hidden title="Przeciągnij">
                          ⋮⋮
                        </span>
                        <div className={styles.taskLabel}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleDone(task.id)}
                            className={styles.checkbox}
                            aria-label={
                              isDone
                                ? `Przywróć do „Do zrobienia”: ${task.text}`
                                : `Oznacz jako zrobione: ${task.text}`
                            }
                          />
                          <span className={styles.taskBody}>
                            <span className={styles.taskMetaRow}>
                              {rankLabel && (
                                <span className={styles.rankBadge} title="Priorytet w backlogu">
                                  {rankLabel}
                                </span>
                              )}
                              <label className={styles.quadrantSelectWrap}>
                                <span className={styles.srOnly}>Priorytet Eisenhowera</span>
                                <select
                                  className={styles.quadrantSelect}
                                  data-quadrant={task.quadrant}
                                  value={task.quadrant}
                                  onChange={(e) =>
                                    setTaskQuadrant(task.id, e.target.value as QuadrantId)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  title={`Priorytet: ${quadrantShortLabel(task.quadrant)}`}
                                  aria-label={`Priorytet zadania: ${task.text}`}
                                >
                                  {QUADRANT_META.map((q) => (
                                    <option key={q.id} value={q.id}>
                                      {q.shortLabel}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </span>
                            <span className={isDone ? styles.taskTextCompleted : styles.taskText}>
                              {task.text}
                            </span>
                          </span>
                        </div>
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
