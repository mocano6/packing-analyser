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
import {
  STAFF_PLANNER_TASKS_DOC_ID,
  STAFF_PLANNER_TASKS_DOC_ID_LEGACY,
} from "@/types/staffPlanner";
import styles from "@/app/admin/zadania/page.module.css";

export type QuadrantId =
  | "urgent-important"
  | "important-not-urgent"
  | "urgent-not-important"
  | "not-urgent-not-important";

export interface EisenhowerTask {
  id: string;
  text: string;
  quadrant: QuadrantId;
  completed: boolean;
  createdAt: number;
}

const QUADRANTS: { id: QuadrantId; title: string; subtitle: string }[] = [
  { id: "urgent-important", title: "Pilne i ważne", subtitle: "Zrób od razu" },
  { id: "important-not-urgent", title: "Ważne, niepilne", subtitle: "Zaplanuj" },
  { id: "urgent-not-important", title: "Pilne, nieważne", subtitle: "Zdeleguj" },
  { id: "not-urgent-not-important", title: "Nieważne, niepilne", subtitle: "Usuń lub odłóż" },
];

const DEFAULT_QUADRANT: QuadrantId = "urgent-important";

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
  const [tasksLoading, setTasksLoading] = useState(true);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<QuadrantId | null>(null);

  const loadTasks = useCallback(async () => {
    if (!db || !uid) {
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    try {
      const snapshot = await getDocs(tasksCollection(uid));
      const loaded: EisenhowerTask[] = snapshot.docs
        .filter(
          (d) =>
            d.id !== STAFF_PLANNER_TASKS_DOC_ID &&
            d.id !== STAFF_PLANNER_TASKS_DOC_ID_LEGACY
        )
        .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text ?? "",
          quadrant: (data.quadrant as QuadrantId) ?? DEFAULT_QUADRANT,
          completed: !!data.completed,
          createdAt: data.createdAt ?? 0,
        };
      });
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
        await setDoc(taskDoc(uid, task.id), {
          text: task.text,
          quadrant: task.quadrant,
          completed: task.completed,
          createdAt: task.createdAt,
        });
      } catch (e) {
        console.error("Błąd zapisu zadania:", e);
        toast.error("Nie udało się zapisać zadania. Sprawdź konsolę i reguły Firestore.");
      }
    },
    [uid]
  );

  const removeTaskFromFirestore = useCallback(
    async (taskId: string) => {
      if (!uid || !db) return;
      try {
        await deleteDoc(taskDoc(uid, taskId));
      } catch (e) {
        console.error("Błąd usuwania zadania:", e);
      }
    },
    [uid]
  );

  const addTask = useCallback(() => {
    const trimmed = newText.trim();
    if (!trimmed || !uid) return;
    const task: EisenhowerTask = {
      id: generateId(),
      text: trimmed,
      quadrant: DEFAULT_QUADRANT,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    setNewText("");
    persistTask(task);
  }, [newText, uid, persistTask]);

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
        const next = prev.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t
        );
        const task = next.find((t) => t.id === id);
        if (task) persistTask(task);
        return next;
      });
    },
    [persistTask]
  );

  const moveTaskToQuadrant = useCallback(
    (taskId: string, quadrant: QuadrantId) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (!task || task.quadrant === quadrant) return prev;
        const updated = { ...task, quadrant };
        persistTask(updated);
        return prev.map((t) => (t.id === taskId ? updated : t));
      });
    },
    [persistTask]
  );

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragTaskId(null);
    setDragOverQuadrant(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, quadrantId: QuadrantId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverQuadrant(quadrantId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverQuadrant(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, quadrantId: QuadrantId) => {
      e.preventDefault();
      setDragOverQuadrant(null);
      const taskId = e.dataTransfer.getData("text/plain");
      if (taskId) moveTaskToQuadrant(taskId, quadrantId);
      setDragTaskId(null);
    },
    [moveTaskToQuadrant]
  );

  const tasksByQuadrant = useMemo(() => {
    const map: Record<QuadrantId, EisenhowerTask[]> = {
      "urgent-important": [],
      "important-not-urgent": [],
      "urgent-not-important": [],
      "not-urgent-not-important": [],
    };
    tasks.forEach((t) => map[t.quadrant].push(t));
    QUADRANTS.forEach((q) => {
      map[q.id].sort((a, b) =>
        a.completed === b.completed ? a.createdAt - b.createdAt : a.completed ? 1 : -1
      );
    });
    return map;
  }, [tasks]);

  const hasCompleted = useMemo(
    () => tasks.some((t) => t.completed),
    [tasks]
  );

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
          Dodaj zadanie, a następnie przeciągnij je myszą do odpowiedniego kwadrantu.
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

      <div className={styles.grid}>
        {QUADRANTS.map((quadrant) => (
          <div
            key={quadrant.id}
            className={`${styles.quadrant} ${dragOverQuadrant === quadrant.id ? styles.quadrantDragOver : ""}`}
            data-quadrant={quadrant.id}
            onDragOver={(e) => handleDragOver(e, quadrant.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, quadrant.id)}
          >
            <h3 className={styles.quadrantTitle}>{quadrant.title}</h3>
            <p className={styles.quadrantSubtitle}>{quadrant.subtitle}</p>
            <ul className={styles.taskList} role="list">
              {tasksByQuadrant[quadrant.id].map((task) => (
                <li
                  key={task.id}
                  className={`${styles.taskItem} ${dragTaskId === task.id ? styles.taskItemDragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                >
                  <label className={styles.taskLabel}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleCompleted(task.id)}
                      className={styles.checkbox}
                      aria-label={`Zaznacz jako zakończone: ${task.text}`}
                    />
                    <span
                      className={
                        task.completed ? styles.taskTextCompleted : styles.taskText
                      }
                    >
                      {task.text}
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
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
