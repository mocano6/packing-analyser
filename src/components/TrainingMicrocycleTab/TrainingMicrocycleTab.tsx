"use client";

import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  GameModelPhaseId,
  GameModelRuleLevel,
  GameModelState,
} from "@/types/gameModel";
import {
  GAME_MODEL_LEVEL_LABELS,
  GAME_MODEL_PHASES,
  GAME_MODEL_PRIORITY_LABELS,
} from "@/types/gameModel";
import type {
  MicrocycleDayAssignment,
  MicrocycleDayPlan,
  MicrocycleDaySchedule,
  MicrocycleMatch,
  TrainingDayTitleTemplatesState,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import {
  MICROCYCLE_MATCH_COMPETITION_LABELS,
  MICROCYCLE_MATCH_VENUE_LABELS,
} from "@/types/trainingMicrocycle";
import {
  collectDescendantTemplatesForDrop,
  filterTemplatesByPhase,
  groupTemplatesByLevel,
  templatePhaseIds,
  templatesToAssignOnMicrocycleDrop,
  type GameModelLibraryPhaseFilter,
} from "@/utils/gameModelTree";
import {
  addDays,
  matchDayLabelsForColumn,
  parseIsoDateLocal,
  startOfWeekMonday,
  toIsoDateLocal,
  weekdayShortPl,
} from "@/utils/matchDayLabels";
import {
  applyTrainingCountDelta,
  assignmentsForMicrocycle,
  dayPlansForMicrocycle,
  defaultSeasonName,
  generateMicrocycleId,
  microcyclesForSeason,
  nextMicrocycleNumber,
  sortSeasons,
} from "@/utils/trainingMicrocycle";
import {
  createDefaultMicrocycleMatch,
  matchDaysFromMatches,
  setSecondMicrocycleMatch,
  updateMicrocycleMatchAt,
} from "@/utils/microcycleMatches";
import {
  getDayScheduleForDay,
  updateMicrocycleDaySchedule,
} from "@/utils/microcycleDaySchedules";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import type { Team } from "@/constants/teamsLoader";
import type { UserTeamAccess } from "@/lib/teamsForUserAccess";

function MicrocycleDayMatchCard({
  match,
  mdLabel,
  matchIndex,
}: {
  match: MicrocycleMatch;
  mdLabel: string;
  matchIndex: number;
}) {
  return (
    <div className={styles.dayMatchCard} aria-label={`Mecz ${matchIndex + 1} — ${mdLabel}`}>
      <div className={styles.dayMatchCardHead}>
        <span className={styles.dayMatchMd}>{mdLabel}</span>
        {matchIndex > 0 && (
          <span className={styles.dayMatchIndex}>M{matchIndex + 1}</span>
        )}
      </div>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Godzina</span>
        <span>{match.kickoffTime || "—"}</span>
      </p>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Przeciwnik</span>
        <span>{match.opponent.trim() || "—"}</span>
      </p>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Miejsce</span>
        <span>{MICROCYCLE_MATCH_VENUE_LABELS[match.venue]}</span>
      </p>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Rozgrywki</span>
        <span>{MICROCYCLE_MATCH_COMPETITION_LABELS[match.competition]}</span>
      </p>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Adres</span>
        <span className={styles.dayMatchAddress}>{match.venueAddress.trim() || "—"}</span>
      </p>
    </div>
  );
}
import styles from "./TrainingMicrocycleTab.module.css";

const LIBRARY_LEVELS: GameModelRuleLevel[] = [0, 1, 2];

const DAY_LEVEL_SHORT: Record<GameModelRuleLevel, string> = {
  0: "Zasada",
  1: "Sub-zasada",
  2: "Sub-sub-zasada",
};

function groupAssignmentsByLevel(
  list: MicrocycleDayAssignment[]
): { level: GameModelRuleLevel; items: MicrocycleDayAssignment[] }[] {
  const groups: Record<GameModelRuleLevel, MicrocycleDayAssignment[]> = { 0: [], 1: [], 2: [] };
  for (const a of list) {
    if (a.level >= 0 && a.level <= 2) groups[a.level].push(a);
  }
  return LIBRARY_LEVELS.filter((level) => groups[level].length > 0).map((level) => ({
    level,
    items: groups[level],
  }));
}

type DragPayload =
  | { kind: "gameModelTemplate"; templateId: string }
  | { kind: "microcycleAssignment"; assignmentId: string }
  | { kind: "dayTitleTemplate"; templateId: string }
  | { kind: "dayTitlePlan"; planId: string };

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const o = JSON.parse(raw) as DragPayload;
    if (o.kind === "gameModelTemplate" && typeof o.templateId === "string") return o;
    if (o.kind === "microcycleAssignment" && typeof o.assignmentId === "string") return o;
    if (o.kind === "dayTitleTemplate" && typeof o.templateId === "string") return o;
    if (o.kind === "dayTitlePlan" && typeof o.planId === "string") return o;
  } catch {
    return null;
  }
  return null;
}

function isDayTitleDrag(payload: DragPayload | null): boolean {
  return payload?.kind === "dayTitleTemplate" || payload?.kind === "dayTitlePlan";
}

export interface TrainingMicrocycleTabProps {
  microcycleState: TrainingMicrocycleState;
  setMicrocycleState: React.Dispatch<React.SetStateAction<TrainingMicrocycleState>>;
  microcycleLoading: boolean;
  dayTitleTemplatesState: TrainingDayTitleTemplatesState;
  setDayTitleTemplatesState: React.Dispatch<React.SetStateAction<TrainingDayTitleTemplatesState>>;
  dayTitleTemplatesLoading: boolean;
  gameModelState: GameModelState;
  gameModelLoading: boolean;
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
  teamsCatalog: Team[];
  userTeamAccess: UserTeamAccess;
}

export default function TrainingMicrocycleTab({
  microcycleState,
  setMicrocycleState,
  microcycleLoading,
  dayTitleTemplatesState,
  setDayTitleTemplatesState,
  dayTitleTemplatesLoading,
  gameModelState,
  gameModelLoading,
  selectedTeam,
  onTeamChange,
  teamsCatalog,
  userTeamAccess,
}: TrainingMicrocycleTabProps) {
  const dayTitleTemplates = dayTitleTemplatesState.templates;
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState(false);
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [cascadeHoverRootId, setCascadeHoverRootId] = useState<string | null>(null);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newDayFocus, setNewDayFocus] = useState("");
  const [newDayMoments, setNewDayMoments] = useState("");
  const [dragDayTitleTemplateId, setDragDayTitleTemplateId] = useState<string | null>(null);
  const [dragDayTitlePlanId, setDragDayTitlePlanId] = useState<string | null>(null);
  const [dragOverDayTitle, setDragOverDayTitle] = useState<number | null>(null);
  const [libraryPhaseFilter, setLibraryPhaseFilter] =
    useState<GameModelLibraryPhaseFilter>("all");

  const seasons = useMemo(
    () => sortSeasons(microcycleState.seasons),
    [microcycleState.seasons]
  );

  const activeSeasonId =
    microcycleState.activeSeasonId && seasons.some((s) => s.id === microcycleState.activeSeasonId)
      ? microcycleState.activeSeasonId
      : seasons[0]?.id ?? null;

  const seasonMicrocycles = useMemo(
    () => (activeSeasonId ? microcyclesForSeason(microcycleState.microcycles, activeSeasonId) : []),
    [microcycleState.microcycles, activeSeasonId]
  );

  const activeMicrocycleId =
    microcycleState.activeMicrocycleId &&
    seasonMicrocycles.some((m) => m.id === microcycleState.activeMicrocycleId)
      ? microcycleState.activeMicrocycleId
      : seasonMicrocycles[0]?.id ?? null;

  const activeMicrocycle = useMemo(
    () => seasonMicrocycles.find((m) => m.id === activeMicrocycleId) ?? null,
    [seasonMicrocycles, activeMicrocycleId]
  );

  const weekStartIso = activeMicrocycle?.weekStartIso ?? toIsoDateLocal(startOfWeekMonday(new Date()));
  const matches = activeMicrocycle?.matches ?? [createDefaultMicrocycleMatch(5)];
  const matchDays = matchDaysFromMatches(matches);
  const firstMatch = matches[0] ?? createDefaultMicrocycleMatch(5);
  const secondMatch = matches[1] ?? null;
  const firstMatchDay = firstMatch.dayIndex;
  const secondMatchDay = secondMatch?.dayIndex ?? null;

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

  const filteredTemplates = useMemo(
    () =>
      filterTemplatesByPhase(
        gameModelState.templates,
        gameModelState.nodes,
        libraryPhaseFilter
      ),
    [gameModelState.templates, gameModelState.nodes, libraryPhaseFilter]
  );

  const groupedTemplates = useMemo(
    () => groupTemplatesByLevel(filteredTemplates),
    [filteredTemplates]
  );

  const templatesById = useMemo(() => {
    const map = new Map(gameModelState.templates.map((t) => [t.id, t]));
    return map;
  }, [gameModelState.templates]);

  const cascadeHighlightIds = useMemo(() => {
    if (!cascadeHoverRootId) return new Set<string>();
    return new Set(
      collectDescendantTemplatesForDrop(
        gameModelState.templates,
        gameModelState.nodes,
        cascadeHoverRootId
      ).map((t) => t.id)
    );
  }, [cascadeHoverRootId, gameModelState.templates, gameModelState.nodes]);

  const assignmentsThisMicrocycle = useMemo(
    () =>
      activeMicrocycleId
        ? assignmentsForMicrocycle(microcycleState.assignments, activeMicrocycleId)
        : [],
    [microcycleState.assignments, activeMicrocycleId]
  );

  const byDay = useMemo(() => {
    const m: Record<number, typeof assignmentsThisMicrocycle> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    assignmentsThisMicrocycle.forEach((a) => {
      if (a.dayIndex >= 0 && a.dayIndex <= 6) m[a.dayIndex].push(a);
    });
    return m;
  }, [assignmentsThisMicrocycle]);

  const dayPlansThisMicrocycle = useMemo(
    () =>
      activeMicrocycleId
        ? dayPlansForMicrocycle(microcycleState.dayPlans ?? [], activeMicrocycleId)
        : [],
    [microcycleState.dayPlans, activeMicrocycleId]
  );

  const planByDay = useMemo(() => {
    const m: Record<number, MicrocycleDayPlan | null> = {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    };
    dayPlansThisMicrocycle.forEach((p) => {
      if (p.dayIndex >= 0 && p.dayIndex <= 6) m[p.dayIndex] = p;
    });
    return m;
  }, [dayPlansThisMicrocycle]);

  const selectSeason = useCallback(
    (seasonId: string) => {
      setMicrocycleState((prev) => {
        const inSeason = microcyclesForSeason(prev.microcycles, seasonId);
        return {
          ...prev,
          activeSeasonId: seasonId,
          activeMicrocycleId: inSeason[0]?.id ?? null,
        };
      });
    },
    [setMicrocycleState]
  );

  const selectMicrocycle = useCallback(
    (microcycleId: string) => {
      setMicrocycleState((prev) => ({ ...prev, activeMicrocycleId: microcycleId }));
    },
    [setMicrocycleState]
  );

  const addSeason = useCallback(() => {
    const name = (newSeasonName.trim() || defaultSeasonName()).slice(0, 80);
    const id = generateMicrocycleId();
    const microcycleId = generateMicrocycleId();
    const weekStartIsoNew = toIsoDateLocal(startOfWeekMonday(new Date()));
    setMicrocycleState((prev) => {
      const order =
        prev.seasons.length === 0 ? 0 : Math.max(...prev.seasons.map((s) => s.order)) + 1;
      return {
        ...prev,
        seasons: [...prev.seasons, { id, name, order }],
        microcycles: [
          ...prev.microcycles,
          {
            id: microcycleId,
            seasonId: id,
            number: 1,
            weekStartIso: weekStartIsoNew,
            matches: [createDefaultMicrocycleMatch(5)],
            daySchedules: [],
          },
        ],
        activeSeasonId: id,
        activeMicrocycleId: microcycleId,
      };
    });
    setNewSeasonName("");
  }, [newSeasonName, setMicrocycleState]);

  const addMicrocycle = useCallback(() => {
    if (!activeSeasonId) return;
    const id = generateMicrocycleId();
    setMicrocycleState((prev) => {
      const inSeason = microcyclesForSeason(prev.microcycles, activeSeasonId);
      const last = inSeason[inSeason.length - 1];
      const weekStartIsoNew = last
        ? toIsoDateLocal(addDays(parseIsoDateLocal(last.weekStartIso), 7))
        : toIsoDateLocal(startOfWeekMonday(new Date()));
      const number = nextMicrocycleNumber(prev.microcycles, activeSeasonId);
      return {
        ...prev,
        microcycles: [
          ...prev.microcycles,
          {
            id,
            seasonId: activeSeasonId,
            number,
            weekStartIso: weekStartIsoNew,
            matches: last?.matches?.map((m) => ({ ...m })) ?? [createDefaultMicrocycleMatch(5)],
            daySchedules: last?.daySchedules?.map((s) => ({ ...s })) ?? [],
          },
        ],
        activeMicrocycleId: id,
      };
    });
  }, [activeSeasonId, setMicrocycleState]);

  const updateActiveMicrocycle = useCallback(
    (patch: Partial<{ weekStartIso: string; matches: MicrocycleMatch[]; daySchedules: MicrocycleDaySchedule[] }>) => {
      if (!activeMicrocycleId) return;
      setMicrocycleState((prev) => ({
        ...prev,
        microcycles: prev.microcycles.map((m) =>
          m.id === activeMicrocycleId ? { ...m, ...patch } : m
        ),
      }));
    },
    [activeMicrocycleId, setMicrocycleState]
  );

  const updateMatch = useCallback(
    (index: 0 | 1, patch: Partial<MicrocycleMatch>) => {
      if (!activeMicrocycleId || !activeMicrocycle) return;
      let nextMatches = updateMicrocycleMatchAt(activeMicrocycle.matches, index, patch);
      if (index === 0 && patch.dayIndex !== undefined && nextMatches[1]?.dayIndex === patch.dayIndex) {
        nextMatches = [nextMatches[0]];
      }
      updateActiveMicrocycle({ matches: nextMatches });
    },
    [activeMicrocycleId, activeMicrocycle, updateActiveMicrocycle]
  );

  const setSecondMatchDay = useCallback(
    (val: string) => {
      if (!activeMicrocycle) return;
      const next = setSecondMicrocycleMatch(
        activeMicrocycle.matches,
        val === "" ? null : Number(val)
      );
      updateActiveMicrocycle({ matches: next });
    },
    [activeMicrocycle, updateActiveMicrocycle]
  );

  const updateDaySchedule = useCallback(
    (dayIndex: number, patch: Partial<Pick<MicrocycleDaySchedule, "startTime" | "endTime">>) => {
      if (!activeMicrocycle) return;
      const next = updateMicrocycleDaySchedule(activeMicrocycle.daySchedules ?? [], dayIndex, patch);
      updateActiveMicrocycle({ daySchedules: next });
    },
    [activeMicrocycle, updateActiveMicrocycle]
  );

  const stopHeaderInputPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const goPrevWeek = useCallback(() => {
    const d = parseIsoDateLocal(weekStartIso);
    d.setDate(d.getDate() - 7);
    updateActiveMicrocycle({ weekStartIso: toIsoDateLocal(d) });
  }, [weekStartIso, updateActiveMicrocycle]);

  const goNextWeek = useCallback(() => {
    const d = parseIsoDateLocal(weekStartIso);
    d.setDate(d.getDate() + 7);
    updateActiveMicrocycle({ weekStartIso: toIsoDateLocal(d) });
  }, [weekStartIso, updateActiveMicrocycle]);

  const goThisWeek = useCallback(() => {
    updateActiveMicrocycle({ weekStartIso: toIsoDateLocal(startOfWeekMonday(new Date())) });
  }, [updateActiveMicrocycle]);

  const dropOnDay = useCallback(
    (dayIndex: number, raw: string) => {
      if (!activeMicrocycleId) return;
      const payload = parseDragPayload(raw);
      if (!payload) return;

      if (payload.kind === "dayTitleTemplate") {
        const tpl = dayTitleTemplates.find((t) => t.id === payload.templateId);
        if (!tpl) return;
        const plan: MicrocycleDayPlan = {
          id: generateMicrocycleId(),
          microcycleId: activeMicrocycleId,
          dayIndex,
          templateId: tpl.id,
          generalFocus: tpl.generalFocus,
          gameMoments: tpl.gameMoments,
          phaseId: null,
        };
        setMicrocycleState((prev) => ({
          ...prev,
          dayPlans: [
            ...(prev.dayPlans ?? []).filter(
              (p) => !(p.microcycleId === activeMicrocycleId && p.dayIndex === dayIndex)
            ),
            plan,
          ],
        }));
        return;
      }

      if (payload.kind === "dayTitlePlan") {
        setMicrocycleState((prev) => {
          const plans = prev.dayPlans ?? [];
          const moving = plans.find((p) => p.id === payload.planId);
          if (!moving || moving.microcycleId !== activeMicrocycleId) return prev;
          const withoutTarget = plans.filter(
            (p) =>
              !(
                p.microcycleId === activeMicrocycleId &&
                (p.dayIndex === dayIndex || p.id === payload.planId)
              )
          );
          return {
            ...prev,
            dayPlans: [...withoutTarget, { ...moving, dayIndex }],
          };
        });
        return;
      }

      if (payload.kind === "gameModelTemplate") {
        const templatesToAdd = templatesToAssignOnMicrocycleDrop(
          gameModelState.templates,
          gameModelState.nodes,
          payload.templateId
        );
        if (templatesToAdd.length === 0) {
          toast.error("Nie znaleziono elementu w bibliotece modelu.");
          return;
        }
        const newAssignments = templatesToAdd.map((tpl) => ({
          id: generateMicrocycleId(),
          microcycleId: activeMicrocycleId,
          dayIndex,
          templateId: tpl.id,
          title: tpl.title,
          level: tpl.level,
        }));
        setMicrocycleState((prev) => {
          let trainingCounts = prev.trainingCounts;
          for (const tpl of templatesToAdd) {
            trainingCounts = applyTrainingCountDelta(trainingCounts, tpl.id, 1);
          }
          return {
            ...prev,
            assignments: [...prev.assignments, ...newAssignments],
            trainingCounts,
          };
        });
        return;
      }

      if (payload.kind === "microcycleAssignment") {
        setMicrocycleState((prev) => ({
          ...prev,
          assignments: prev.assignments.map((a) =>
            a.id === payload.assignmentId ? { ...a, dayIndex } : a
          ),
        }));
      }
    },
    [activeMicrocycleId, gameModelState.templates, gameModelState.nodes, dayTitleTemplates, setMicrocycleState]
  );

  const addDayTitleTemplate = useCallback(() => {
    const generalFocus = newDayFocus.trim();
    const gameMoments = newDayMoments.trim();
    if (!generalFocus) {
      toast.error("Podaj ogólny charakter dnia treningowego.");
      return;
    }
    setDayTitleTemplatesState((prev) => ({
      ...prev,
      templates: [
        ...prev.templates,
        { id: generateMicrocycleId(), generalFocus, gameMoments },
      ],
    }));
    setNewDayFocus("");
    setNewDayMoments("");
  }, [newDayFocus, newDayMoments, setDayTitleTemplatesState]);

  const removeDayTitleTemplate = useCallback(
    (templateId: string) => {
      setDayTitleTemplatesState((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== templateId),
      }));
    },
    [setDayTitleTemplatesState]
  );

  const deleteDayPlan = useCallback(
    (planId: string) => {
      setMicrocycleState((prev) => ({
        ...prev,
        dayPlans: (prev.dayPlans ?? []).filter((p) => p.id !== planId),
      }));
    },
    [setMicrocycleState]
  );

  const setDayPlanPhase = useCallback(
    (planId: string, phaseId: GameModelPhaseId | null) => {
      setMicrocycleState((prev) => ({
        ...prev,
        dayPlans: (prev.dayPlans ?? []).map((p) =>
          p.id === planId ? { ...p, phaseId } : p
        ),
      }));
      if (phaseId) setLibraryPhaseFilter(phaseId);
    },
    [setMicrocycleState]
  );

  const deleteAssignment = useCallback(
    (assignmentId: string) => {
      setMicrocycleState((prev) => {
        const target = prev.assignments.find((a) => a.id === assignmentId);
        if (!target) return prev;
        return {
          ...prev,
          assignments: prev.assignments.filter((a) => a.id !== assignmentId),
          trainingCounts: applyTrainingCountDelta(prev.trainingCounts, target.templateId, -1),
        };
      });
    },
    [setMicrocycleState]
  );

  const handleDragStartTemplate = useCallback((e: React.DragEvent, templateId: string) => {
    setDragTemplateId(templateId);
    setCascadeHoverRootId(templateId);
    const p: DragPayload = { kind: "gameModelTemplate", templateId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragStartAssignment = useCallback((e: React.DragEvent, assignmentId: string) => {
    setDragAssignmentId(assignmentId);
    const p: DragPayload = { kind: "microcycleAssignment", assignmentId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragStartDayTitleTemplate = useCallback((e: React.DragEvent, templateId: string) => {
    setDragDayTitleTemplateId(templateId);
    const p: DragPayload = { kind: "dayTitleTemplate", templateId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragStartDayTitlePlan = useCallback((e: React.DragEvent, planId: string) => {
    setDragDayTitlePlanId(planId);
    const p: DragPayload = { kind: "dayTitlePlan", planId };
    e.dataTransfer.setData("application/json", JSON.stringify(p));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragTemplateId(null);
    setDragAssignmentId(null);
    setDragDayTitleTemplateId(null);
    setDragDayTitlePlanId(null);
    setDragOverDay(null);
    setDragOverDayTitle(null);
    setCascadeHoverRootId(null);
  }, []);

  if (microcycleLoading || gameModelLoading || dayTitleTemplatesLoading) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie mikrocykli treningowych…
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <div className={styles.loadingBox} role="status">
        Wybierz zespół, aby edytować mikrocykl treningowy.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Zespół</span>
          <TeamsSelector
            selectedTeam={selectedTeam}
            onChange={onTeamChange}
            teamsCatalog={teamsCatalog}
            userTeamAccess={userTeamAccess}
            isExpanded={isTeamsSelectorExpanded}
            onToggle={() => setIsTeamsSelectorExpanded((v) => !v)}
          />
        </div>

        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Sezon</span>
          <div className={styles.seasonRow}>
            <select
              className={styles.select}
              value={activeSeasonId ?? ""}
              onChange={(e) => selectSeason(e.target.value)}
              aria-label="Aktywny sezon"
            >
              {seasons.length === 0 && <option value="">Brak sezonu</option>}
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              className={styles.input}
              placeholder={defaultSeasonName()}
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              aria-label="Nazwa nowego sezonu"
            />
            <button type="button" className={styles.addBtn} onClick={addSeason}>
              + Sezon
            </button>
          </div>
        </div>

        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Mikrocykl</span>
          <div className={styles.microcycleRow} role="tablist" aria-label="Mikrocykle w sezonie">
            {seasonMicrocycles.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={m.id === activeMicrocycleId}
                className={`${styles.microcycleTab} ${m.id === activeMicrocycleId ? styles.microcycleTabActive : ""}`}
                onClick={() => selectMicrocycle(m.id)}
              >
                {m.number}
              </button>
            ))}
            <button
              type="button"
              className={styles.smallBtn}
              onClick={addMicrocycle}
              aria-label="Dodaj mikrocykl"
              disabled={!activeSeasonId}
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Tydzień mikrocyklu</span>
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

        <div className={`${styles.toolbarGroup} ${styles.toolbarGroupWide}`}>
          <span className={styles.toolbarLabel}>Mecze w tygodniu (MD)</span>
          <div className={styles.matchPanel}>
            {[firstMatch, secondMatch].filter((m): m is MicrocycleMatch => m != null).map((match, i) => (
              <div key={i} className={styles.matchDetailRow}>
                <span className={styles.matchDetailLabel}>Mecz {i + 1}</span>
                <select
                  className={styles.select}
                  value={match.dayIndex}
                  onChange={(e) => updateMatch(i as 0 | 1, { dayIndex: Number(e.target.value) })}
                  aria-label={`Dzień meczu ${i + 1}`}
                  disabled={!activeMicrocycleId}
                >
                  {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label, idx) => (
                    <option
                      key={`${i}-${label}`}
                      value={idx}
                      disabled={i === 1 && idx === firstMatchDay}
                    >
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={match.kickoffTime}
                  onChange={(e) => updateMatch(i as 0 | 1, { kickoffTime: e.target.value })}
                  aria-label={`Godzina meczu ${i + 1}`}
                  disabled={!activeMicrocycleId}
                />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Przeciwnik"
                  value={match.opponent}
                  onChange={(e) => updateMatch(i as 0 | 1, { opponent: e.target.value })}
                  aria-label={`Przeciwnik meczu ${i + 1}`}
                  disabled={!activeMicrocycleId}
                />
                <input
                  type="text"
                  className={styles.addressInput}
                  placeholder="Adres miejsca meczu"
                  value={match.venueAddress}
                  onChange={(e) => updateMatch(i as 0 | 1, { venueAddress: e.target.value })}
                  aria-label={`Adres miejsca meczu ${i + 1}`}
                  disabled={!activeMicrocycleId}
                />
                <select
                  className={styles.select}
                  value={match.venue}
                  onChange={(e) =>
                    updateMatch(i as 0 | 1, {
                      venue: e.target.value as MicrocycleMatch["venue"],
                    })
                  }
                  aria-label={`Dom czy wyjazd — mecz ${i + 1}`}
                  disabled={!activeMicrocycleId}
                >
                  {(Object.keys(MICROCYCLE_MATCH_VENUE_LABELS) as MicrocycleMatch["venue"][]).map(
                    (id) => (
                      <option key={id} value={id}>
                        {MICROCYCLE_MATCH_VENUE_LABELS[id]}
                      </option>
                    )
                  )}
                </select>
                <select
                  className={styles.select}
                  value={match.competition}
                  onChange={(e) =>
                    updateMatch(i as 0 | 1, {
                      competition: e.target.value as MicrocycleMatch["competition"],
                    })
                  }
                  aria-label={`Typ rozgrywek — mecz ${i + 1}`}
                  disabled={!activeMicrocycleId}
                >
                  {(
                    Object.keys(MICROCYCLE_MATCH_COMPETITION_LABELS) as MicrocycleMatch["competition"][]
                  ).map((id) => (
                    <option key={id} value={id}>
                      {MICROCYCLE_MATCH_COMPETITION_LABELS[id]}
                    </option>
                  ))}
                </select>
                {i === 1 && (
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => setSecondMatchDay("")}
                    aria-label="Usuń drugi mecz"
                  >
                    Usuń
                  </button>
                )}
              </div>
            ))}
            {!secondMatch && (
              <div className={styles.matchDetailRow}>
                <span className={styles.matchDetailLabel}>Mecz 2</span>
                <select
                  className={styles.select}
                  value=""
                  onChange={(e) => setSecondMatchDay(e.target.value)}
                  aria-label="Dodaj drugi mecz w tygodniu"
                  disabled={!activeMicrocycleId}
                >
                  <option value="">Brak drugiego meczu</option>
                  {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label, idx) => (
                    <option key={`add-2-${label}`} value={idx} disabled={idx === firstMatchDay}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside
        className={styles.library}
        aria-label="Biblioteka elementów modelu gry"
        onMouseLeave={() => setCascadeHoverRootId(null)}
      >
        <h2 className={styles.sectionTitle}>Elementy modelu gry</h2>
        <p className={styles.libraryHint}>
          Niebieskie = zasady, zielone = sub-zasady, fioletowe = sub-sub-zasady. Filtr fazy pokazuje
          elementy z drzewa modelu drużyny. Przeciągnij na dzień — z potomkami z modelu. Licznik =
          ile razy trenowano.
        </p>
        <div className={styles.phaseFilter} role="toolbar" aria-label="Filtr fazy modelu">
          {(
            [
              { id: "all", label: "Wszystkie" },
              ...GAME_MODEL_PHASES.map((p) => ({ id: p.id, label: p.shortLabel })),
              { id: "unassigned", label: "Poza modelem" },
            ] as { id: GameModelLibraryPhaseFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`${styles.phaseFilterBtn} ${
                libraryPhaseFilter === opt.id ? styles.phaseFilterBtnActive : ""
              }`}
              aria-pressed={libraryPhaseFilter === opt.id}
              onClick={() => setLibraryPhaseFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {gameModelState.templates.length === 0 ? (
          <p className={styles.emptyLibrary}>
            Brak elementów — dodaj je w zakładce Model, potem wróć tutaj.
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className={styles.emptyLibrary}>
            Brak elementów w wybranym filtrze fazy — zmień filtr lub uzupełnij drzewo w Modelu.
          </p>
        ) : (
          <div className={styles.libraryGrid}>
            {LIBRARY_LEVELS.map((level) => (
              <section
                key={level}
                className={styles.libraryColumn}
                data-level={level}
                aria-label={GAME_MODEL_LEVEL_LABELS[level]}
              >
                <h3 className={styles.columnTitle}>
                  {GAME_MODEL_LEVEL_LABELS[level]} ({groupedTemplates[level].length})
                </h3>
                <div className={styles.chipList}>
                  {groupedTemplates[level].map((tpl) => {
                    const trainCount = microcycleState.trainingCounts[tpl.id] ?? 0;
                    const isCascadeRoot = cascadeHoverRootId === tpl.id;
                    const isCascadeChild = cascadeHighlightIds.has(tpl.id);
                    const phases = templatePhaseIds(gameModelState.nodes, tpl.id);
                    return (
                      <div
                        key={tpl.id}
                        className={`${styles.templateChip} ${dragTemplateId === tpl.id ? styles.templateChipDragging : ""} ${isCascadeRoot ? styles.templateChipHovered : ""} ${isCascadeChild ? styles.templateChipCascade : ""}`}
                        data-level={level}
                        draggable
                        onMouseEnter={() => setCascadeHoverRootId(tpl.id)}
                        onDragStart={(e) => handleDragStartTemplate(e, tpl.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className={styles.chipTop}>
                          <span className={styles.chipTitle}>{tpl.title}</span>
                          <span
                            className={`${styles.trainCount} ${trainCount > 0 ? styles.trainCountActive : ""}`}
                            title={`Trenowano ${trainCount}×`}
                            aria-label={`Trenowano ${trainCount} razy`}
                          >
                            {trainCount}
                          </span>
                        </div>
                        {(tpl.priority || phases.length > 0) && (
                          <div className={styles.chipBadges}>
                            {tpl.priority && (
                              <span
                                className={`${styles.chipPriority} ${
                                  tpl.priority === "key" ? styles.chipPriorityKey : ""
                                }`}
                              >
                                {GAME_MODEL_PRIORITY_LABELS[tpl.priority]}
                              </span>
                            )}
                            {phases.map((phaseId) => {
                              const phase = GAME_MODEL_PHASES.find((p) => p.id === phaseId);
                              return (
                                <span key={phaseId} className={styles.chipPhaseBadge} data-phase={phaseId}>
                                  {phase?.shortLabel ?? phaseId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {tpl.description && (
                          <p className={styles.chipDescription}>{tpl.description}</p>
                        )}
                        {tpl.trigger && (
                          <p className={styles.chipTrigger}>
                            <span aria-hidden="true">⚡ </span>
                            {tpl.trigger}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </aside>

      <section className={styles.dayTitlesSection} aria-label="Tytuły dni treningowych">
        <h2 className={styles.sectionTitle}>Tytuły dni treningowych</h2>
        <p className={styles.libraryHint}>
          Zdefiniuj szablony dnia (co trenujemy ogólnie + jakie momenty w grze), potem przeciągnij na
          nagłówek wybranego dnia w siatce poniżej.
        </p>
        <div className={styles.dayTitleList}>
          {dayTitleTemplates.length === 0 && (
            <p className={styles.emptyLibrary}>Brak szablonów — dodaj pierwszy poniżej.</p>
          )}
          {dayTitleTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className={`${styles.dayTitleChip} ${dragDayTitleTemplateId === tpl.id ? styles.dayTitleChipDragging : ""}`}
              draggable
              onDragStart={(e) => handleDragStartDayTitleTemplate(e, tpl.id)}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.dayTitleChipBody}>
                <p className={styles.dayTitleFocus}>{tpl.generalFocus}</p>
                {tpl.gameMoments.trim() && (
                  <p className={styles.dayTitleMoments}>{tpl.gameMoments}</p>
                )}
              </div>
              <button
                type="button"
                className={styles.dayTitleRemove}
                onClick={() => removeDayTitleTemplate(tpl.id)}
                aria-label={`Usuń szablon: ${tpl.generalFocus}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={styles.dayTitleAddRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Co trenujemy (ogólnie)"
            value={newDayFocus}
            onChange={(e) => setNewDayFocus(e.target.value)}
            aria-label="Ogólny charakter dnia treningowego"
          />
          <input
            type="text"
            className={styles.input}
            placeholder="Momenty w grze"
            value={newDayMoments}
            onChange={(e) => setNewDayMoments(e.target.value)}
            aria-label="Momenty w grze"
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={addDayTitleTemplate}
            disabled={!newDayFocus.trim()}
          >
            Dodaj szablon
          </button>
        </div>
      </section>

      <section aria-label="Siatka mikrocyklu">
        <h2 className={styles.sectionTitle}>
          Mikrocykl {activeMicrocycle?.number ?? "—"}
        </h2>
        <div className={styles.gridWrap}>
          <div className={styles.weekGrid} role="grid" aria-label="Dni tygodnia mikrocyklu">
            {weekDates.map((d, dayIndex) => {
              const mdLines = matchDayLabelsForColumn(dayIndex, matchDays);
              const list = byDay[dayIndex] ?? [];
              const dayPlan = planByDay[dayIndex];
              const daySchedule = getDayScheduleForDay(activeMicrocycle?.daySchedules, dayIndex);
              const matchesOnDay = matches.filter((m) => m.dayIndex === dayIndex);
              const isMatchDay = matchesOnDay.length > 0;
              return (
                <div
                  key={dayIndex}
                  className={`${styles.dayColumn} ${dragOverDay === dayIndex ? styles.dayColumnDrag : ""} ${isMatchDay ? styles.dayColumnMatch : ""}`}
                  role="gridcell"
                >
                  <div
                    className={`${styles.dayHeader} ${dragOverDayTitle === dayIndex ? styles.dayHeaderDrag : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = dragDayTitlePlanId != null ? "move" : "copy";
                      setDragOverDayTitle(dayIndex);
                    }}
                    onDragLeave={() => setDragOverDayTitle(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverDayTitle(null);
                      const raw = e.dataTransfer.getData("application/json");
                      if (raw) dropOnDay(dayIndex, raw);
                    }}
                  >
                    <div className={styles.dayHeaderTop}>
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
                    <div className={styles.dayHeaderTimes} onMouseDown={stopHeaderInputPropagation}>
                      <label className={styles.dayTimeLabel}>
                        <span className={styles.srOnly}>Godzina rozpoczęcia treningu</span>
                        <input
                          type="time"
                          className={styles.dayTimeInput}
                          value={daySchedule.startTime}
                          onChange={(e) => updateDaySchedule(dayIndex, { startTime: e.target.value })}
                          onClick={stopHeaderInputPropagation}
                          aria-label={`${weekdayShortPl(dayIndex)} — start treningu`}
                        />
                      </label>
                      <span className={styles.dayTimeSep} aria-hidden="true">
                        –
                      </span>
                      <label className={styles.dayTimeLabel}>
                        <span className={styles.srOnly}>Godzina zakończenia treningu</span>
                        <input
                          type="time"
                          className={styles.dayTimeInput}
                          value={daySchedule.endTime}
                          onChange={(e) => updateDaySchedule(dayIndex, { endTime: e.target.value })}
                          onClick={stopHeaderInputPropagation}
                          aria-label={`${weekdayShortPl(dayIndex)} — koniec treningu`}
                        />
                      </label>
                    </div>
                    {dayPlan ? (
                      <div
                        className={`${styles.dayPlanCard} ${dragDayTitlePlanId === dayPlan.id ? styles.dayPlanCardDragging : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStartDayTitlePlan(e, dayPlan.id);
                        }}
                        onDragEnd={handleDragEnd}
                      >
                        <p className={styles.dayPlanFocus}>{dayPlan.generalFocus}</p>
                        {dayPlan.gameMoments.trim() && (
                          <p className={styles.dayPlanMoments}>{dayPlan.gameMoments}</p>
                        )}
                        <label
                          className={styles.dayPlanPhaseLabel}
                          onMouseDown={stopHeaderInputPropagation}
                        >
                          <span className={styles.srOnly}>Faza modelu gry</span>
                          <select
                            className={styles.dayPlanPhaseSelect}
                            value={dayPlan.phaseId ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDayPlanPhase(
                                dayPlan.id,
                                v === "" ? null : (v as GameModelPhaseId)
                              );
                            }}
                            aria-label={`Faza modelu dla: ${dayPlan.generalFocus}`}
                          >
                            <option value="">Faza: —</option>
                            {GAME_MODEL_PHASES.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={styles.deleteAssign}
                          onClick={() => deleteDayPlan(dayPlan.id)}
                        >
                          Usuń tytuł
                        </button>
                      </div>
                    ) : (
                      <p className={styles.dayPlanPlaceholder}>Upuść tytuł dnia</p>
                    )}
                  </div>
                  <div
                    className={styles.dayBody}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = dragAssignmentId ? "move" : "copy";
                      setDragOverDay(dayIndex);
                    }}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverDay(null);
                      const raw = e.dataTransfer.getData("application/json");
                      const payload = raw ? parseDragPayload(raw) : null;
                      if (payload && !isDayTitleDrag(payload)) {
                        dropOnDay(dayIndex, raw);
                      }
                    }}
                  >
                    {isMatchDay &&
                      matchesOnDay.map((m, mi) => (
                        <MicrocycleDayMatchCard
                          key={`${m.dayIndex}-${mi}`}
                          match={m}
                          mdLabel={mdLines[mi] ?? mdLines[0] ?? "MD"}
                          matchIndex={mi}
                        />
                      ))}
                    {list.length === 0 && !isMatchDay && (
                      <p className={styles.emptyCell}>Upuść element tutaj</p>
                    )}
                    {list.length === 0 && isMatchDay && (
                      <p className={styles.emptyCellMuted}>Upuść elementy treningu poniżej meczu</p>
                    )}
                    {groupAssignmentsByLevel(list).map(({ level, items }) => (
                      <div key={level} className={styles.dayLevelGroup} data-level={level}>
                        <p className={styles.dayLevelLabel} data-level={level}>
                          {DAY_LEVEL_SHORT[level]}
                        </p>
                        {items.map((a) => {
                          const live = templatesById.get(a.templateId);
                          const title = live?.title ?? a.title;
                          const priority = live?.priority;
                          const description = live?.description;
                          const trigger = live?.trigger;
                          return (
                          <div
                            key={a.id}
                            className={`${styles.assignCard} ${dragAssignmentId === a.id ? styles.assignCardDragging : ""}`}
                            data-level={a.level}
                            draggable
                            onDragStart={(e) => handleDragStartAssignment(e, a.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className={styles.assignCardHead}>
                              <span className={styles.assignLevelTag} data-level={a.level}>
                                {DAY_LEVEL_SHORT[a.level]}
                              </span>
                              <p className={styles.assignTitle}>{title}</p>
                              {priority && (
                                <span
                                  className={`${styles.chipPriority} ${
                                    priority === "key" ? styles.chipPriorityKey : ""
                                  }`}
                                >
                                  {GAME_MODEL_PRIORITY_LABELS[priority]}
                                </span>
                              )}
                              {description && (
                                <p className={styles.assignDescription}>{description}</p>
                              )}
                              {trigger && (
                                <p className={styles.assignTrigger}>
                                  <span aria-hidden="true">⚡ </span>
                                  {trigger}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              className={styles.deleteAssign}
                              onClick={() => deleteAssignment(a.id)}
                            >
                              Usuń
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    ))}
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
