"use client";

import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { StaffPlannerState } from "@/types/staffPlanner";
import {
  DEFAULT_STAFF_TASK_CATEGORY_ID,
  STAFF_TASK_CATEGORIES,
} from "@/types/staffPlanner";
import {
  addDays,
  matchDayLabelsForColumn,
  normalizeMatchDaysArray,
  parseIsoDateLocal,
  startOfWeekMonday,
  toIsoDateLocal,
  weekdayShortPl,
} from "@/utils/matchDayLabels";
import styles from "./StaffPlannerTab.module.css";

const COACH_COLOR_PRESETS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type DragPayload =
  | { kind: "template"; templateId: string }
  | { kind: "assignment"; assignmentId: string };

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const o = JSON.parse(raw) as DragPayload;
    if (o.kind === "template" && typeof o.templateId === "string") return o;
    if (o.kind === "assignment" && typeof o.assignmentId === "string") return o;
  } catch {
    return null;
  }
  return null;
}

export interface StaffPlannerTabProps {
  state: StaffPlannerState;
  setPlannerState: React.Dispatch<React.SetStateAction<StaffPlannerState>>;
  loading: boolean;
}

export default function StaffPlannerTab({ state, setPlannerState, loading }: StaffPlannerTabProps) {
  const [weekStartIso, setWeekStartIso] = useState(() =>
    toIsoDateLocal(startOfWeekMonday(new Date()))
  );
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null);

  const [newCoachName, setNewCoachName] = useState("");
  const [newTplTitle, setNewTplTitle] = useState("");
  const [newTplRepeatable, setNewTplRepeatable] = useState(true);
  const [newTplCoachId, setNewTplCoachId] = useState<string>("");
  const [newTplCategoryId, setNewTplCategoryId] = useState<string>(
    DEFAULT_STAFF_TASK_CATEGORY_ID
  );

  const normalizedMatchDays = useMemo(
    () => normalizeMatchDaysArray(state.matchDays),
    [state.matchDays]
  );
  const firstMatchDay = normalizedMatchDays[0] ?? 5;
  const secondMatchDay = normalizedMatchDays[1] ?? null;

  const weekDates = useMemo(() => {
    const start = parseIsoDateLocal(weekStartIso);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStartIso]);

  const weekLabel = useMemo(() => {
    const a = weekDates[0];
    const b = weekDates[6];
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    return `${fmt(a)} – ${fmt(b)} · ${a.getFullYear()}`;
  }, [weekDates]);

  const assignmentsThisWeek = useMemo(
    () => state.assignments.filter((a) => a.weekStartIso === weekStartIso),
    [state.assignments, weekStartIso]
  );

  const byDay = useMemo(() => {
    const m: Record<number, typeof assignmentsThisWeek> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    assignmentsThisWeek.forEach((a) => {
      if (a.dayIndex >= 0 && a.dayIndex <= 6) m[a.dayIndex].push(a);
    });
    return m;
  }, [assignmentsThisWeek]);

  const coachById = useMemo(() => {
    const map = new Map<string, (typeof state.coaches)[0]>();
    state.coaches.forEach((c) => map.set(c.id, c));
    return map;
  }, [state.coaches]);

  const addCoach = useCallback(() => {
    const name = newCoachName.trim();
    if (!name) return;
    const color = COACH_COLOR_PRESETS[state.coaches.length % COACH_COLOR_PRESETS.length];
    const id = generateId();
    setPlannerState((prev) => ({
      ...prev,
      coaches: [...prev.coaches, { id, name, color }],
    }));
    setNewCoachName("");
  }, [newCoachName, setPlannerState]);

  const removeCoach = useCallback(
    (id: string) => {
      setPlannerState((prev) => {
        const remaining = prev.coaches.filter((c) => c.id !== id);
        const fallback = remaining[0]?.id ?? null;
        return {
          ...prev,
          coaches: remaining,
          templates: prev.templates.map((t) =>
            t.defaultCoachId === id ? { ...t, defaultCoachId: fallback } : t
          ),
          assignments: fallback
            ? prev.assignments.map((a) =>
                a.coachId === id ? { ...a, coachId: fallback } : a
              )
            : prev.assignments.filter((a) => a.coachId !== id),
        };
      });
    },
    [setPlannerState]
  );

  const addTemplate = useCallback(() => {
    const title = newTplTitle.trim();
    if (!title) return;
    const defaultCoach =
      newTplCoachId && state.coaches.some((c) => c.id === newTplCoachId)
        ? newTplCoachId
        : state.coaches[0]?.id ?? null;
    const categoryId = STAFF_TASK_CATEGORIES.some((c) => c.id === newTplCategoryId)
      ? newTplCategoryId
      : DEFAULT_STAFF_TASK_CATEGORY_ID;
    setPlannerState((prev) => ({
      ...prev,
      templates: [
        ...prev.templates,
        {
          id: generateId(),
          title,
          repeatable: newTplRepeatable,
          defaultCoachId: defaultCoach,
          categoryId,
        },
      ],
    }));
    setNewTplTitle("");
  }, [
    newTplTitle,
    newTplRepeatable,
    newTplCoachId,
    newTplCategoryId,
    state.coaches,
    setPlannerState,
  ]);

  const updateTemplateCategory = useCallback(
    (templateId: string, categoryId: string) => {
      const safe = STAFF_TASK_CATEGORIES.some((c) => c.id === categoryId)
        ? categoryId
        : DEFAULT_STAFF_TASK_CATEGORY_ID;
      setPlannerState((prev) => ({
        ...prev,
        templates: prev.templates.map((t) =>
          t.id === templateId ? { ...t, categoryId: safe } : t
        ),
      }));
    },
    [setPlannerState]
  );

  const removeTemplate = useCallback(
    (id: string) => {
      setPlannerState((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== id),
      }));
    },
    [setPlannerState]
  );

  const deleteAssignment = useCallback(
    (id: string) => {
      setPlannerState((prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => a.id !== id),
      }));
    },
    [setPlannerState]
  );

  const setAssignmentCoach = useCallback(
    (assignmentId: string, coachId: string) => {
      setPlannerState((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) => (a.id === assignmentId ? { ...a, coachId } : a)),
      }));
    },
    [setPlannerState]
  );

  const setAssignmentCategory = useCallback(
    (assignmentId: string, categoryId: string) => {
      const safe = STAFF_TASK_CATEGORIES.some((c) => c.id === categoryId)
        ? categoryId
        : DEFAULT_STAFF_TASK_CATEGORY_ID;
      setPlannerState((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.id === assignmentId ? { ...a, categoryId: safe } : a
        ),
      }));
    },
    [setPlannerState]
  );

  const setFirstMatchDay = useCallback(
    (idx: number) => {
      setPlannerState((prev) => {
        const n = normalizeMatchDaysArray(prev.matchDays);
        const curSecond = n[1];
        if (curSecond === undefined) return { ...prev, matchDays: [idx] };
        if (curSecond === idx) return { ...prev, matchDays: [idx] };
        return { ...prev, matchDays: normalizeMatchDaysArray([idx, curSecond]) };
      });
    },
    [setPlannerState]
  );

  const setSecondMatchDay = useCallback(
    (val: string) => {
      setPlannerState((prev) => {
        const n = normalizeMatchDaysArray(prev.matchDays);
        const first = n[0] ?? 5;
        if (val === "") return { ...prev, matchDays: [first] };
        const second = Number(val);
        if (second === first) return { ...prev, matchDays: [first] };
        return { ...prev, matchDays: normalizeMatchDaysArray([first, second]) };
      });
    },
    [setPlannerState]
  );

  const dropOnDay = useCallback(
    (dayIndex: number, raw: string) => {
      const payload = parseDragPayload(raw);
      if (!payload) return;

      if (payload.kind === "template") {
        const tpl = state.templates.find((t) => t.id === payload.templateId);
        if (!tpl) return;
        if (state.coaches.length === 0) {
          toast.error("Dodaj co najmniej jednego trenera w sekcji powyżej.");
          return;
        }
        const coachId =
          tpl.defaultCoachId && state.coaches.some((c) => c.id === tpl.defaultCoachId)
            ? tpl.defaultCoachId
            : state.coaches[0].id;
        const assignment = {
          id: generateId(),
          weekStartIso,
          dayIndex,
          coachId,
          title: tpl.title,
          templateId: tpl.id,
          categoryId: tpl.categoryId ?? DEFAULT_STAFF_TASK_CATEGORY_ID,
        };
        setPlannerState((prev) => ({
          ...prev,
          assignments: [...prev.assignments, assignment],
        }));
        return;
      }

      if (payload.kind === "assignment") {
        setPlannerState((prev) => ({
          ...prev,
          assignments: prev.assignments.map((a) =>
            a.id === payload.assignmentId
              ? { ...a, weekStartIso, dayIndex }
              : a
          ),
        }));
      }
    },
    [setPlannerState, state.coaches, state.templates, weekStartIso]
  );

  const handleDragStartTemplate = useCallback((e: React.DragEvent, templateId: string) => {
    setDragTemplateId(templateId);
    const p: DragPayload = { kind: "template", templateId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "copyMove";
  }, []);

  const handleDragStartAssignment = useCallback((e: React.DragEvent, assignmentId: string) => {
    setDragAssignmentId(assignmentId);
    const p: DragPayload = { kind: "assignment", assignmentId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragTemplateId(null);
    setDragAssignmentId(null);
    setDragOverDay(null);
  }, []);

  const goPrevWeek = useCallback(() => {
    const d = parseIsoDateLocal(weekStartIso);
    d.setDate(d.getDate() - 7);
    setWeekStartIso(toIsoDateLocal(d));
  }, [weekStartIso]);

  const goNextWeek = useCallback(() => {
    const d = parseIsoDateLocal(weekStartIso);
    d.setDate(d.getDate() + 7);
    setWeekStartIso(toIsoDateLocal(d));
  }, [weekStartIso]);

  const goThisWeek = useCallback(() => {
    setWeekStartIso(toIsoDateLocal(startOfWeekMonday(new Date())));
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie planu sztabu…
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Tydzień</span>
          <div className={styles.weekNav}>
            <button type="button" className={styles.navButton} onClick={goPrevWeek}>
              ← Poprzedni
            </button>
            <p className={styles.weekTitle}>{weekLabel}</p>
            <button type="button" className={styles.navButton} onClick={goNextWeek}>
              Następny →
            </button>
            <button type="button" className={styles.navButton} onClick={goThisWeek}>
              Dziś
            </button>
          </div>
        </div>
        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Mecze w tygodniu (MD)</span>
          <div className={styles.matchDayRow}>
            <label className={styles.srOnly} htmlFor="match-day-1">
              Dzień pierwszego meczu w tygodniu
            </label>
            <select
              id="match-day-1"
              className={styles.select}
              value={firstMatchDay}
              onChange={(e) => setFirstMatchDay(Number(e.target.value))}
              aria-label="Dzień pierwszego meczu (wcześniejszy w tygodniu)"
            >
              {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label, idx) => (
                <option key={label} value={idx}>
                  Mecz 1: {label}
                </option>
              ))}
            </select>
            <label className={styles.srOnly} htmlFor="match-day-2">
              Opcjonalny drugi mecz w tym samym tygodniu
            </label>
            <select
              id="match-day-2"
              className={styles.select}
              value={secondMatchDay === null ? "" : String(secondMatchDay)}
              onChange={(e) => setSecondMatchDay(e.target.value)}
              aria-label="Opcjonalny drugi mecz w tygodniu"
            >
              <option value="">Brak drugiego meczu</option>
              {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label, idx) => (
                <option key={`2-${label}`} value={idx} disabled={idx === firstMatchDay}>
                  Mecz 2: {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section className={styles.coachesSection} aria-labelledby="coaches-heading">
        <h2 id="coaches-heading" className={styles.sectionTitle}>
          Trenerzy (kolory zadań)
        </h2>
        <div className={styles.coachRow}>
          {state.coaches.map((c) => (
            <div key={c.id} className={styles.coachChip}>
              <span className={styles.coachDot} style={{ background: c.color }} aria-hidden />
              <span>{c.name}</span>
              <button
                type="button"
                className={styles.removeMini}
                onClick={() => removeCoach(c.id)}
                aria-label={`Usuń trenera ${c.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={styles.coachRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Imię trenera"
            value={newCoachName}
            onChange={(e) => setNewCoachName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCoach()}
            aria-label="Imię nowego trenera"
          />
          <button type="button" className={styles.addCoachBtn} onClick={addCoach}>
            Dodaj trenera
          </button>
        </div>
      </section>

      <section className={styles.library} aria-labelledby="library-heading">
        <h2 id="library-heading" className={styles.sectionTitle}>
          Biblioteka zadań
        </h2>
        <p className={styles.libraryHint}>
          Zdefiniuj zadania powtarzalne lub jednorazowe, wybierz kategorię (motoryka, taktyka itd.),
          przypisz domyślnego trenera, potem przeciągnij wpis na wybrany dzień w siatce poniżej.
        </p>
        <div className={styles.templateList}>
          {state.templates.length === 0 && (
            <p className={styles.libraryHint}>Brak szablonów — dodaj pierwszy poniżej.</p>
          )}
          {state.templates.map((t) => (
            <div
              key={t.id}
              className={`${styles.templateItem} ${dragTemplateId === t.id ? styles.templateItemDragging : ""}`}
              draggable
              onDragStart={(e) => handleDragStartTemplate(e, t.id)}
              onDragEnd={handleDragEnd}
            >
              <span className={t.repeatable ? styles.badge : styles.badgeOnce}>
                {t.repeatable ? "Powtarzalne" : "Jednorazowe"}
              </span>
              <span>{t.title}</span>
              <select
                className={styles.categorySelect}
                value={t.categoryId}
                onChange={(e) => updateTemplateCategory(t.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Kategoria szablonu: ${t.title}`}
              >
                {STAFF_TASK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.removeMini}
                onClick={() => removeTemplate(t.id)}
                aria-label={`Usuń szablon ${t.title}`}
              >
                Usuń
              </button>
            </div>
          ))}
        </div>
        <div className={styles.addTemplateRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Tytuł zadania"
            value={newTplTitle}
            onChange={(e) => setNewTplTitle(e.target.value)}
            aria-label="Tytuł nowego zadania"
          />
          <label className={styles.libraryHint} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={newTplRepeatable}
              onChange={(e) => setNewTplRepeatable(e.target.checked)}
            />
            Powtarzalne
          </label>
          <select
            className={styles.select}
            value={newTplCategoryId}
            onChange={(e) => setNewTplCategoryId(e.target.value)}
            aria-label="Kategoria nowego zadania"
          >
            {STAFF_TASK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={newTplCoachId}
            onChange={(e) => setNewTplCoachId(e.target.value)}
            aria-label="Domyślny trener dla szablonu"
          >
            <option value="">Domyślny trener (pierwszy na liście)</option>
            {state.coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={addTemplate}
            disabled={!newTplTitle.trim()}
          >
            Dodaj do biblioteki
          </button>
        </div>
      </section>

      <section aria-label="Tygodniowa siatka zadań">
        <h2 className={styles.sectionTitle}>Plan tygodnia</h2>
        <div className={styles.gridWrap}>
          <div className={styles.weekGrid} role="grid" aria-label="Dni tygodnia i zadania">
            {weekDates.map((d, dayIndex) => {
              const mdLines = matchDayLabelsForColumn(dayIndex, state.matchDays);
              const list = byDay[dayIndex] ?? [];
              return (
                <div
                  key={dayIndex}
                  className={`${styles.dayColumn} ${dragOverDay === dayIndex ? styles.dayColumnDrag : ""}`}
                  role="gridcell"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverDay(dayIndex);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDay(null);
                    const raw = e.dataTransfer.getData("application/json");
                    if (raw) dropOnDay(dayIndex, raw);
                  }}
                >
                  <div className={styles.dayHeader}>
                    <span className={styles.dayName}>{weekdayShortPl(dayIndex)}</span>
                    <span className={styles.dayMdInline} aria-label="Etykiety względem dnia meczu">
                      {mdLines.length <= 1 ? (
                        <span className={styles.dayMdPart}>{mdLines[0] ?? ""}</span>
                      ) : (
                        mdLines.map((lbl, mi) => (
                          <span key={mi} className={styles.dayMdPart}>
                            <span className={styles.dayMdPrefix}>M{mi + 1}</span>
                            {lbl}
                          </span>
                        ))
                      )}
                    </span>
                    <span className={styles.dayDate}>
                      {d.getDate().toString().padStart(2, "0")}.
                      {(d.getMonth() + 1).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className={styles.dayBody}>
                    {list.length === 0 && (
                      <p className={styles.emptyCell}>Upuść zadanie tutaj</p>
                    )}
                    {list.map((a) => {
                      const coach = coachById.get(a.coachId);
                      const accent = coach?.color ?? "#94a3b8";
                      return (
                        <div
                          key={a.id}
                          className={`${styles.assignCard} ${dragAssignmentId === a.id ? styles.assignCardDragging : ""}`}
                          draggable
                          onDragStart={(e) => handleDragStartAssignment(e, a.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <span className={styles.assignAccent} style={{ background: accent }} aria-hidden />
                          <p className={styles.assignTitle}>{a.title}</p>
                          <div className={styles.assignMeta}>
                            <select
                              className={styles.categorySelect}
                              value={a.categoryId}
                              onChange={(e) => setAssignmentCategory(a.id, e.target.value)}
                              aria-label={`Kategoria: ${a.title}`}
                            >
                              {STAFF_TASK_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className={styles.coachSelect}
                              value={a.coachId}
                              onChange={(e) => setAssignmentCoach(a.id, e.target.value)}
                              aria-label={`Trener dla: ${a.title}`}
                            >
                              {state.coaches.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={styles.deleteAssign}
                              onClick={() => deleteAssignment(a.id)}
                            >
                              Usuń
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
