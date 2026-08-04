"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type {
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
  MicrocycleTrainingBlock,
  TrainingDayTitleTemplatesState,
  TrainingMicrocycle,
  TrainingMicrocycleState,
  TrainingProceduralTaskTemplatesState,
} from "@/types/trainingMicrocycle";
import {
  MICROCYCLE_MATCH_COMPETITION_LABELS,
  MICROCYCLE_MATCH_SURFACE_LABELS,
  MICROCYCLE_MATCH_VENUE_LABELS,
  MICROCYCLE_WEATHER_CONDITION_LABELS,
} from "@/types/trainingMicrocycle";
import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
} from "@/types/microcycleMotor";
import { evaluateMicrocycleRules } from "@/lib/microcycle/microcycleRules";
import {
  resolveWeekLoads,
  summarizeWeeklyLoad,
} from "@/utils/microcycleLoad";
import {
  applyFormatToBlock,
  blocksForDay,
  blocksForMicrocycle,
  createEmptyBlock,
  presetBlocksForDay,
  safeBlockMinutes,
  setDayLoadOverride,
} from "@/utils/microcycleTrainingBlocks";
import MicrocycleDayMotorPanel from "./MicrocycleDayMotorPanel";
import MicrocycleRulesBar from "./MicrocycleRulesBar";
import MicrocycleMethodologyPanel from "./MicrocycleMethodologyPanel";
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
  formatMatchDayLabel,
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
  formatMatchSurfaceLabel,
  formatMatchWeatherLabel,
  matchDaysFromMatches,
  setSecondMicrocycleMatch,
  updateMicrocycleMatchAt,
} from "@/utils/microcycleMatches";
import {
  mergeDefaultProceduralTasksIntoState,
  proceduralTasksForDay,
  setProceduralTemplateDefaultMatchDayOffset,
} from "@/utils/proceduralTaskDefaults";
import {
  getDayScheduleForDay,
  updateMicrocycleDaySchedule,
} from "@/utils/microcycleDaySchedules";
import {
  applyFixtureToActiveMicrocycle,
  formatFixtureLabel,
  mergeLaczyFixtures,
  removeMicrocycleFromState,
  sortFixturesForDisplay,
  upsertMicrocyclesFromFixtures,
  fixturesInWeekByDay,
  type LaczyTeamFixture,
} from "@/utils/microcycleFixtures";
import {
  DAY_TITLE_ASSIGNABLE_MD_OFFSETS,
  DAY_TITLE_DEFAULT_MD_OFFSETS,
  formatDefaultMdLabel,
  matchDayOffsetFromDayIndex,
  mergeDefaultDayPlansIntoState,
  resolveDayTitleDisplay,
  setTemplateDefaultMatchDayOffset,
} from "@/utils/dayTitleDefaults";
import { parseLaczyTeamIdFromUrl } from "@/utils/laczyTeamUrl";
import {
  applyWeatherResultsToState,
  collectWeatherQueries,
  syncFixtureDetailsOntoMicrocycles,
} from "@/utils/enrichMicrocycleWeather";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import type { Team } from "@/constants/teamsLoader";
import type { UserTeamAccess } from "@/lib/teamsForUserAccess";

const lnpUrlStorageKey = (teamId: string) => `microcycle_lnp_team_url_${teamId}`;
const lnpWatchUrlStorageKey = (teamId: string) => `microcycle_lnp_watch_url_${teamId}`;

type GridViewDays = 1 | 3 | 7;

const GRID_VIEW_STORAGE_KEY = "microcycle_view_days";

const GRID_VIEW_OPTIONS: { days: GridViewDays; label: string }[] = [
  { days: 1, label: "Dzień" },
  { days: 3, label: "3 dni" },
  { days: 7, label: "Tydzień" },
];

/** Widoczne dni — zakres przycięty do tygodnia aktywnego mikrocyklu. */
function visibleDayIndexes(anchor: number, days: GridViewDays): number[] {
  if (days === 7) return [0, 1, 2, 3, 4, 5, 6];
  const start = Math.min(Math.max(0, anchor), 7 - days);
  return Array.from({ length: days }, (_, i) => start + i);
}

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
      {match.venue === "away" && (
        <p className={styles.dayMatchRow}>
          <span className={styles.dayMatchLabel}>Wyjazd</span>
          <span>{match.departureTime || "—"}</span>
        </p>
      )}
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
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Nawierzchnia</span>
        <span>{formatMatchSurfaceLabel(match.surface)}</span>
      </p>
      <p className={styles.dayMatchRow}>
        <span className={styles.dayMatchLabel}>Pogoda</span>
        <span>{formatMatchWeatherLabel(match)}</span>
      </p>
    </div>
  );
}
import styles from "./TrainingMicrocycleTab.module.css";

type DaySectionKind = "zadania" | "trening" | "cele";

function sectionStorageKey(kind: DaySectionKind): string {
  return `microcycle_section_${kind}_open`;
}

function readSectionPref(kind: DaySectionKind): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(sectionStorageKey(kind));
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSectionPref(kind: DaySectionKind, open: boolean): void {
  try {
    window.localStorage.setItem(sectionStorageKey(kind), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function DayColumnSection({
  kind,
  dayIndex,
  title,
  badge,
  open,
  onToggle,
  /** Gdy true — body zawsze widoczne (np. skrót treningu przy zwinięciu). */
  keepBodyVisible = false,
  children,
}: {
  kind: DaySectionKind;
  dayIndex: number;
  title: string;
  badge: string;
  open: boolean;
  onToggle: () => void;
  keepBodyVisible?: boolean;
  children: React.ReactNode;
}) {
  const panelId = `day-${dayIndex}-section-${kind}-panel`;
  const toggleId = `day-${dayIndex}-section-${kind}-toggle`;
  const bodyHidden = keepBodyVisible ? false : !open;
  return (
    <div className={styles.daySection} data-kind={kind} data-open={open ? "1" : "0"}>
      <button
        type="button"
        id={toggleId}
        className={styles.daySectionToggle}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className={styles.daySectionChevron} aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className={styles.daySectionTitle}>{title}</span>
        <span className={styles.daySectionBadge}>{badge}</span>
      </button>
      <div
        id={panelId}
        className={styles.daySectionBody}
        hidden={bodyHidden}
        role="region"
        aria-labelledby={toggleId}
      >
        {children}
      </div>
    </div>
  );
}

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
  | { kind: "dayTitlePlan"; planId: string }
  | { kind: "proceduralTaskTemplate"; templateId: string };

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const o = JSON.parse(raw) as DragPayload;
    if (o.kind === "gameModelTemplate" && typeof o.templateId === "string") return o;
    if (o.kind === "microcycleAssignment" && typeof o.assignmentId === "string") return o;
    if (o.kind === "dayTitleTemplate" && typeof o.templateId === "string") return o;
    if (o.kind === "dayTitlePlan" && typeof o.planId === "string") return o;
    if (o.kind === "proceduralTaskTemplate" && typeof o.templateId === "string") return o;
  } catch {
    return null;
  }
  return null;
}

function isDayHeaderDrag(payload: DragPayload | null): boolean {
  return (
    payload?.kind === "dayTitleTemplate" ||
    payload?.kind === "dayTitlePlan" ||
    payload?.kind === "proceduralTaskTemplate"
  );
}

export interface TrainingMicrocycleTabProps {
  microcycleState: TrainingMicrocycleState;
  setMicrocycleState: React.Dispatch<React.SetStateAction<TrainingMicrocycleState>>;
  microcycleLoading: boolean;
  dayTitleTemplatesState: TrainingDayTitleTemplatesState;
  setDayTitleTemplatesState: React.Dispatch<React.SetStateAction<TrainingDayTitleTemplatesState>>;
  dayTitleTemplatesLoading: boolean;
  proceduralTaskTemplatesState: TrainingProceduralTaskTemplatesState;
  setProceduralTaskTemplatesState: React.Dispatch<
    React.SetStateAction<TrainingProceduralTaskTemplatesState>
  >;
  proceduralTaskTemplatesLoading: boolean;
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
  proceduralTaskTemplatesState,
  setProceduralTaskTemplatesState,
  proceduralTaskTemplatesLoading,
  gameModelState,
  gameModelLoading,
  selectedTeam,
  onTeamChange,
  teamsCatalog,
  userTeamAccess,
}: TrainingMicrocycleTabProps) {
  const dayTitleTemplates = dayTitleTemplatesState.templates;
  const proceduralTemplates = proceduralTaskTemplatesState.templates;
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState(false);
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [cascadeHoverRootId, setCascadeHoverRootId] = useState<string | null>(null);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newDayFocus, setNewDayFocus] = useState("");
  const [newDayMoments, setNewDayMoments] = useState("");
  const [newProceduralTitle, setNewProceduralTitle] = useState("");
  const [newProceduralNotes, setNewProceduralNotes] = useState("");
  const [dragDayTitleTemplateId, setDragDayTitleTemplateId] = useState<string | null>(null);
  const [dragDayTitlePlanId, setDragDayTitlePlanId] = useState<string | null>(null);
  const [dragProceduralTemplateId, setDragProceduralTemplateId] = useState<string | null>(null);
  const [dragOverDayTitle, setDragOverDayTitle] = useState<number | null>(null);
  const didApplyProceduralDefaultsRef = useRef(false);
  const [libraryPhaseFilter, setLibraryPhaseFilter] =
    useState<GameModelLibraryPhaseFilter>("all");
  const [lnpTeamUrl, setLnpTeamUrl] = useState("");
  const [lnpWatchTeamUrl, setLnpWatchTeamUrl] = useState("");
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [watchFixturesLoading, setWatchFixturesLoading] = useState(false);
  const [viewDays, setViewDays] = useState<GridViewDays>(() => {
    if (typeof window === "undefined") return 7;
    try {
      const raw = Number(window.localStorage.getItem(GRID_VIEW_STORAGE_KEY));
      return raw === 1 || raw === 3 ? raw : 7;
    } catch {
      return 7;
    }
  });
  const [anchorDayIndex, setAnchorDayIndex] = useState(0);
  const [dayTitlesOpen, setDayTitlesOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("microcycle_dayTitles_open") !== "0";
    } catch {
      return true;
    }
  });
  const [proceduralOpen, setProceduralOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("microcycle_procedural_open") !== "0";
    } catch {
      return true;
    }
  });
  const [sectionPrefs, setSectionPrefs] = useState<{
    zadania: boolean | null;
    trening: boolean | null;
    cele: boolean | null;
  }>(() => ({
    zadania: readSectionPref("zadania"),
    trening: readSectionPref("trening"),
    cele: readSectionPref("cele"),
  }));
  const [toolbarOpen, setToolbarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("microcycle_toolbar_open") !== "0";
    } catch {
      return true;
    }
  });

  const fixtures = microcycleState.lnpFixtures ?? [];
  const fixturesTeamId = microcycleState.lnpTeamId ?? null;
  const fixturesTeamName = microcycleState.lnpTeamName ?? null;
  const fixturesFetchedAt = microcycleState.lnpFixturesFetchedAt ?? null;
  const watchFixtures = microcycleState.lnpWatchFixtures ?? [];
  const watchFixturesTeamId = microcycleState.lnpWatchTeamId ?? null;
  const watchFixturesTeamName = microcycleState.lnpWatchTeamName ?? null;
  const watchFixturesFetchedAt = microcycleState.lnpWatchFixturesFetchedAt ?? null;

  const dayTitlesAssignedCount = useMemo(
    () =>
      dayTitleTemplates.filter(
        (t) => t.defaultMatchDayOffset != null && t.defaultMatchDayOffset !== 0
      ).length,
    [dayTitleTemplates]
  );

  const proceduralAssignedCount = useMemo(
    () => proceduralTemplates.filter((t) => t.defaultMatchDayOffset != null).length,
    [proceduralTemplates]
  );

  const selectedTeamName = useMemo(() => {
    const t = teamsCatalog.find((x) => x.id === selectedTeam);
    return t?.name || "Zespół";
  }, [teamsCatalog, selectedTeam]);

  const toggleDayTitlesOpen = useCallback(() => {
    setDayTitlesOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("microcycle_dayTitles_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleProceduralOpen = useCallback(() => {
    setProceduralOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("microcycle_procedural_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setSectionOpen = useCallback((kind: DaySectionKind, open: boolean) => {
    writeSectionPref(kind, open);
    setSectionPrefs((prev) => ({ ...prev, [kind]: open }));
  }, []);

  useEffect(() => {
    didApplyProceduralDefaultsRef.current = false;
  }, [selectedTeam]);

  const toggleToolbarOpen = useCallback(() => {
    setToolbarOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("microcycle_toolbar_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const fromState = (microcycleState.lnpTeamUrl || "").trim();
    if (fromState) {
      setLnpTeamUrl(fromState);
      return;
    }
    if (!selectedTeam || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(lnpUrlStorageKey(selectedTeam));
      if (saved) setLnpTeamUrl(saved);
    } catch {
      /* ignore */
    }
  }, [selectedTeam, microcycleState.lnpTeamUrl]);

  useEffect(() => {
    const fromState = (microcycleState.lnpWatchTeamUrl || "").trim();
    if (fromState) {
      setLnpWatchTeamUrl(fromState);
      return;
    }
    if (!selectedTeam || typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(lnpWatchUrlStorageKey(selectedTeam));
      if (saved) setLnpWatchTeamUrl(saved);
    } catch {
      /* ignore */
    }
  }, [selectedTeam, microcycleState.lnpWatchTeamUrl]);

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

  useEffect(() => {
    if (
      microcycleLoading ||
      dayTitleTemplatesLoading ||
      proceduralTaskTemplatesLoading ||
      !activeMicrocycleId
    ) {
      return;
    }
    if (didApplyProceduralDefaultsRef.current) return;
    const hasDefaults = proceduralTemplates.some((t) => t.defaultMatchDayOffset != null);
    if (!hasDefaults) return;
    didApplyProceduralDefaultsRef.current = true;
    setMicrocycleState((prev) =>
      mergeDefaultProceduralTasksIntoState(
        prev,
        activeMicrocycleId,
        firstMatchDay,
        proceduralTemplates
      )
    );
  }, [
    microcycleLoading,
    dayTitleTemplatesLoading,
    proceduralTaskTemplatesLoading,
    activeMicrocycleId,
    firstMatchDay,
    proceduralTemplates,
    setMicrocycleState,
  ]);

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

  const activeSeasonName = useMemo(
    () => seasons.find((s) => s.id === activeSeasonId)?.name ?? "—",
    [seasons, activeSeasonId]
  );

  const toolbarMatchSummary = useMemo(() => {
    const parts = matches
      .filter((m) => m.opponent.trim())
      .map((m) => {
        const day = weekdayShortPl(m.dayIndex);
        const vs = m.venue === "away" ? `@ ${m.opponent.trim()}` : `vs ${m.opponent.trim()}`;
        return `${day} ${vs}`;
      });
    return parts.length > 0 ? parts.join(" · ") : "Brak przeciwnika";
  }, [matches]);

  const activeBlocks = useMemo(
    () => blocksForMicrocycle(microcycleState.trainingBlocks, activeMicrocycleId),
    [microcycleState.trainingBlocks, activeMicrocycleId]
  );

  const weekLoads = useMemo(
    () => (activeMicrocycle ? resolveWeekLoads(activeMicrocycle, activeBlocks) : []),
    [activeMicrocycle, activeBlocks]
  );

  /** sRPE poprzednich mikrocykli sezonu, od najnowszego — baza dla ACWR. */
  const previousWeeklySrpe = useMemo(() => {
    if (!activeMicrocycle) return [];
    return seasonMicrocycles
      .filter((m) => m.number < activeMicrocycle.number)
      .sort((a, b) => b.number - a.number)
      .slice(0, 3)
      .map((m) =>
        summarizeWeeklyLoad(
          resolveWeekLoads(m, blocksForMicrocycle(microcycleState.trainingBlocks, m.id))
        ).totalSrpe
      );
  }, [activeMicrocycle, seasonMicrocycles, microcycleState.trainingBlocks]);

  const ruleViolations = useMemo(() => {
    if (!activeMicrocycle) return [];
    return evaluateMicrocycleRules({
      microcycle: activeMicrocycle,
      blocks: activeBlocks,
      previousWeeklySrpe,
    });
  }, [activeMicrocycle, activeBlocks, previousWeeklySrpe]);

  const visibleDays = useMemo(
    () => visibleDayIndexes(anchorDayIndex, viewDays),
    [anchorDayIndex, viewDays]
  );

  const changeViewDays = useCallback((days: GridViewDays) => {
    setViewDays(days);
    try {
      window.localStorage.setItem(GRID_VIEW_STORAGE_KEY, String(days));
    } catch {
      /* ignore */
    }
  }, []);

  const focusDay = useCallback(
    (dayIndex: number) => {
      setAnchorDayIndex(dayIndex);
      if (viewDays === 7) changeViewDays(3);
    },
    [viewDays, changeViewDays]
  );

  const mutateActiveMicrocycle = useCallback(
    (updater: (m: TrainingMicrocycle) => TrainingMicrocycle) => {
      if (!activeMicrocycleId) return;
      setMicrocycleState((prev) => ({
        ...prev,
        microcycles: prev.microcycles.map((m) => (m.id === activeMicrocycleId ? updater(m) : m)),
      }));
    },
    [activeMicrocycleId, setMicrocycleState]
  );

  const setDayDominant = useCallback(
    (dayIndex: number, dominant: MotorDominantId | null) => {
      mutateActiveMicrocycle((m) => ({
        ...m,
        dayLoads: setDayLoadOverride(m.dayLoads, dayIndex, { dominant }),
      }));
    },
    [mutateActiveMicrocycle]
  );

  const setDayTarget = useCallback(
    (dayIndex: number, key: keyof MicrocycleDayLoadTargets, value: number | null) => {
      mutateActiveMicrocycle((m) => ({
        ...m,
        dayLoads: setDayLoadOverride(m.dayLoads, dayIndex, {
          targets: value == null ? undefined : { [key]: Math.max(0, Math.round(value)) },
        }),
      }));
    },
    [mutateActiveMicrocycle]
  );

  const resetDayLoad = useCallback(
    (dayIndex: number) => {
      mutateActiveMicrocycle((m) => ({
        ...m,
        dayLoads: (m.dayLoads ?? []).filter((d) => d.dayIndex !== dayIndex),
      }));
    },
    [mutateActiveMicrocycle]
  );

  const fillDayFromPreset = useCallback(
    (dayIndex: number) => {
      if (!activeMicrocycleId) return;
      const fresh = presetBlocksForDay(activeMicrocycleId, dayIndex, matchDays);
      if (fresh.length === 0) {
        toast.error("Model nie ma bloków dla tego dnia.");
        return;
      }
      setMicrocycleState((prev) => ({
        ...prev,
        trainingBlocks: [
          ...(prev.trainingBlocks ?? []).filter(
            (b) => !(b.microcycleId === activeMicrocycleId && b.dayIndex === dayIndex)
          ),
          ...fresh,
        ],
      }));
      toast.success(`Wstawiono ${fresh.length} bloków z modelu.`);
    },
    [activeMicrocycleId, matchDays, setMicrocycleState]
  );

  const fillWeekFromPreset = useCallback(() => {
    if (!activeMicrocycleId) return;
    const fresh = Array.from({ length: 7 }, (_, dayIndex) =>
      presetBlocksForDay(activeMicrocycleId, dayIndex, matchDays)
    ).flat();
    setMicrocycleState((prev) => ({
      ...prev,
      trainingBlocks: [
        ...(prev.trainingBlocks ?? []).filter((b) => b.microcycleId !== activeMicrocycleId),
        ...fresh,
      ],
    }));
    toast.success(`Rozpisano tydzień z modelu: ${fresh.length} bloków.`);
  }, [activeMicrocycleId, matchDays, setMicrocycleState]);

  const addBlock = useCallback(
    (dayIndex: number) => {
      if (!activeMicrocycleId) return;
      const order = blocksForDay(activeBlocks, dayIndex).length;
      setMicrocycleState((prev) => ({
        ...prev,
        trainingBlocks: [
          ...(prev.trainingBlocks ?? []),
          createEmptyBlock(activeMicrocycleId, dayIndex, order),
        ],
      }));
    },
    [activeMicrocycleId, activeBlocks, setMicrocycleState]
  );

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<MicrocycleTrainingBlock>) => {
      setMicrocycleState((prev) => ({
        ...prev,
        trainingBlocks: (prev.trainingBlocks ?? []).map((b) =>
          b.id === blockId
            ? {
                ...b,
                ...patch,
                minutes: patch.minutes !== undefined ? safeBlockMinutes(patch.minutes) : b.minutes,
              }
            : b
        ),
      }));
    },
    [setMicrocycleState]
  );

  const setBlockFormat = useCallback(
    (blockId: string, formatId: string | null) => {
      setMicrocycleState((prev) => ({
        ...prev,
        trainingBlocks: (prev.trainingBlocks ?? []).map((b) =>
          b.id === blockId ? applyFormatToBlock(b, formatId) : b
        ),
      }));
    },
    [setMicrocycleState]
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      setMicrocycleState((prev) => ({
        ...prev,
        trainingBlocks: (prev.trainingBlocks ?? []).filter((b) => b.id !== blockId),
      }));
    },
    [setMicrocycleState]
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      setMicrocycleState((prev) => {
        const all = prev.trainingBlocks ?? [];
        const target = all.find((b) => b.id === blockId);
        if (!target) return prev;
        const siblings = all
          .filter((b) => b.microcycleId === target.microcycleId && b.dayIndex === target.dayIndex)
          .sort((a, b) => a.order - b.order);
        const idx = siblings.findIndex((b) => b.id === blockId);
        const swapWith = siblings[idx + direction];
        if (!swapWith) return prev;
        return {
          ...prev,
          trainingBlocks: all.map((b) => {
            if (b.id === target.id) return { ...b, order: swapWith.order };
            if (b.id === swapWith.id) return { ...b, order: target.order };
            return b;
          }),
        };
      });
    },
    [setMicrocycleState]
  );

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
    const defaultMatches = [createDefaultMicrocycleMatch(5)];
    setMicrocycleState((prev) => {
      const order =
        prev.seasons.length === 0 ? 0 : Math.max(...prev.seasons.map((s) => s.order)) + 1;
      let next: TrainingMicrocycleState = {
        ...prev,
        seasons: [...prev.seasons, { id, name, order }],
        microcycles: [
          ...prev.microcycles,
          {
            id: microcycleId,
            seasonId: id,
            number: 1,
            weekStartIso: weekStartIsoNew,
            matches: defaultMatches,
            daySchedules: [],
          },
        ],
        activeSeasonId: id,
        activeMicrocycleId: microcycleId,
      };
      next = mergeDefaultDayPlansIntoState(
        next,
        microcycleId,
        defaultMatches[0].dayIndex,
        dayTitleTemplates
      );
      next = mergeDefaultProceduralTasksIntoState(
        next,
        microcycleId,
        defaultMatches[0].dayIndex,
        proceduralTemplates
      );
      return next;
    });
    setNewSeasonName("");
  }, [newSeasonName, setMicrocycleState, dayTitleTemplates, proceduralTemplates]);

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
      const matches =
        last?.matches?.map((m) => ({ ...m })) ?? [createDefaultMicrocycleMatch(5)];
      let next: TrainingMicrocycleState = {
        ...prev,
        microcycles: [
          ...prev.microcycles,
          {
            id,
            seasonId: activeSeasonId,
            number,
            weekStartIso: weekStartIsoNew,
            matches,
            daySchedules: last?.daySchedules?.map((s) => ({ ...s })) ?? [],
          },
        ],
        activeMicrocycleId: id,
      };
      next = mergeDefaultDayPlansIntoState(
        next,
        id,
        matches[0]?.dayIndex ?? 5,
        dayTitleTemplates
      );
      next = mergeDefaultProceduralTasksIntoState(
        next,
        id,
        matches[0]?.dayIndex ?? 5,
        proceduralTemplates
      );
      return next;
    });
  }, [activeSeasonId, setMicrocycleState, dayTitleTemplates, proceduralTemplates]);

  const removeActiveMicrocycle = useCallback(() => {
    if (!activeMicrocycleId) return;
    const label = activeMicrocycle?.number ?? "?";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Usunąć mikrocykl ${label}? Plany dni i przypisania elementów też znikną.`)
    ) {
      return;
    }
    setMicrocycleState((prev) => removeMicrocycleFromState(prev, activeMicrocycleId));
    toast.success(`Usunięto mikrocykl ${label}.`);
  }, [activeMicrocycleId, activeMicrocycle, setMicrocycleState]);

  /** Dociąga prognozę Open-Meteo dla meczów z adresem w horyzoncie ~10 dni. */
  const refreshMatchWeather = useCallback(
    async (snapshot: TrainingMicrocycleState): Promise<number> => {
      const queries = collectWeatherQueries(snapshot);
      if (queries.length === 0) return 0;
      try {
        const res = await fetch("/api/microcycle/match-weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: queries.map((q) => ({
              id: q.id,
              venueAddress: q.venueAddress,
              kickoffIso: q.kickoffIso,
            })),
          }),
        });
        const data = (await res.json()) as {
          results?: Array<{
            id: string;
            ok: boolean;
            weatherCondition?: string;
            weatherTempC?: number;
          }>;
        };
        if (!res.ok || !Array.isArray(data.results)) return 0;
        const okCount = data.results.filter((r) => r.ok).length;
        if (okCount === 0) return 0;
        setMicrocycleState((prev) => applyWeatherResultsToState(prev, data.results!));
        return okCount;
      } catch (e) {
        console.error("Pobieranie pogody meczów:", e);
        return 0;
      }
    },
    [setMicrocycleState]
  );

  const fetchLaczyFixtures = useCallback(async () => {
    const teamId = parseLaczyTeamIdFromUrl(lnpTeamUrl);
    if (!teamId) {
      toast.error("Wklej link do drużyny ŁNP (…/rozgrywki/druzyna/… ) albo UUID.");
      return;
    }
    setFixturesLoading(true);
    const hadSaved = (microcycleState.lnpFixtures ?? []).length > 0;
    const tid = toast.loading(
      hadSaved ? "Odświeżanie przyszłych meczów z ŁNP…" : "Pobieranie terminarza z Łączy Nas Piłka…"
    );
    try {
      if (selectedTeam) {
        try {
          window.localStorage.setItem(lnpUrlStorageKey(selectedTeam), lnpTeamUrl.trim());
        } catch {
          /* ignore */
        }
      }
      const res = await fetch("/api/microcycle/team-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lnpTeamUrl.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        teamId?: string;
        teamName?: string;
        fixtures?: LaczyTeamFixture[];
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "Błąd pobierania terminarza.");
      }
      const incoming = Array.isArray(data.fixtures) ? data.fixtures : [];
      const existing = microcycleState.lnpFixtures ?? [];
      const merged = mergeLaczyFixtures(existing, incoming);
      const fetchedAt = new Date().toISOString();
      const resolvedTeamId = data.teamId || teamId;
      let snapshot: TrainingMicrocycleState | null = null;
      setMicrocycleState((prev) => {
        const mergedFixtures = mergeLaczyFixtures(prev.lnpFixtures ?? [], incoming);
        let next: TrainingMicrocycleState = {
          ...prev,
          lnpTeamUrl: lnpTeamUrl.trim(),
          lnpTeamId: resolvedTeamId,
          lnpTeamName: data.teamName || prev.lnpTeamName || null,
          lnpFixtures: mergedFixtures,
          lnpFixturesFetchedAt: fetchedAt,
        };
        next = syncFixtureDetailsOntoMicrocycles(next, mergedFixtures, resolvedTeamId);
        snapshot = next;
        return next;
      });
      const weatherOk = snapshot ? await refreshMatchWeather(snapshot) : 0;
      if (incoming.length === 0 && existing.length === 0) {
        toast.error(data.message || "Brak meczów w terminarzu.", { id: tid });
      } else {
        const weatherSuffix =
          weatherOk > 0 ? ` · pogoda: ${weatherOk}` : "";
        toast.success(
          hadSaved
            ? `Zapisano terminarz · ${merged.length} mecz(y) (odświeżono tylko przyszłe).${weatherSuffix}`
            : `${data.message || `Zapisano ${merged.length} meczów w bazie zespołu.`}${weatherSuffix}`,
          { id: tid }
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd pobierania terminarza.", { id: tid });
    } finally {
      setFixturesLoading(false);
    }
  }, [
    lnpTeamUrl,
    selectedTeam,
    setMicrocycleState,
    microcycleState.lnpFixtures,
    refreshMatchWeather,
  ]);

  /** Podgląd terminarza innego zespołu — tylko mecze, bez syncu mikrocykli. */
  const fetchWatchFixtures = useCallback(async () => {
    const teamId = parseLaczyTeamIdFromUrl(lnpWatchTeamUrl);
    if (!teamId) {
      toast.error("Wklej link do drużyny ŁNP (…/rozgrywki/druzyna/… ) albo UUID.");
      return;
    }
    setWatchFixturesLoading(true);
    const hadSaved = (microcycleState.lnpWatchFixtures ?? []).length > 0;
    const tid = toast.loading(
      hadSaved
        ? "Odświeżanie podglądu meczów…"
        : "Pobieranie terminarza do podglądu…"
    );
    try {
      if (selectedTeam) {
        try {
          window.localStorage.setItem(
            lnpWatchUrlStorageKey(selectedTeam),
            lnpWatchTeamUrl.trim()
          );
        } catch {
          /* ignore */
        }
      }
      const res = await fetch("/api/microcycle/team-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lnpWatchTeamUrl.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        teamId?: string;
        teamName?: string;
        fixtures?: LaczyTeamFixture[];
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "Błąd pobierania terminarza.");
      }
      const incoming = Array.isArray(data.fixtures) ? data.fixtures : [];
      const existing = microcycleState.lnpWatchFixtures ?? [];
      const merged = mergeLaczyFixtures(existing, incoming);
      const fetchedAt = new Date().toISOString();
      const resolvedTeamId = data.teamId || teamId;
      setMicrocycleState((prev) => ({
        ...prev,
        lnpWatchTeamUrl: lnpWatchTeamUrl.trim(),
        lnpWatchTeamId: resolvedTeamId,
        lnpWatchTeamName: data.teamName || prev.lnpWatchTeamName || null,
        lnpWatchFixtures: mergeLaczyFixtures(prev.lnpWatchFixtures ?? [], incoming),
        lnpWatchFixturesFetchedAt: fetchedAt,
      }));
      if (incoming.length === 0 && existing.length === 0) {
        toast.error(data.message || "Brak meczów w terminarzu.", { id: tid });
      } else {
        toast.success(
          hadSaved
            ? `Podgląd zapisany · ${merged.length} mecz(y).`
            : data.message || `Zapisano podgląd: ${merged.length} mecz(y).`,
          { id: tid }
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd pobierania podglądu.", { id: tid });
    } finally {
      setWatchFixturesLoading(false);
    }
  }, [
    lnpWatchTeamUrl,
    selectedTeam,
    setMicrocycleState,
    microcycleState.lnpWatchFixtures,
  ]);

  const applyFixture = useCallback(
    (fixture: LaczyTeamFixture) => {
      if (!fixturesTeamId) return;
      let snapshot: TrainingMicrocycleState | null = null;
      setMicrocycleState((prev) => {
        let next = applyFixtureToActiveMicrocycle(prev, fixture, fixturesTeamId);
        const activeId = next.activeMicrocycleId;
        if (!activeId) {
          snapshot = next;
          return next;
        }
        const mc = next.microcycles.find((m) => m.id === activeId);
        const matchDay = mc?.matches[0]?.dayIndex ?? 5;
        next = mergeDefaultDayPlansIntoState(next, activeId, matchDay, dayTitleTemplates);
        next = mergeDefaultProceduralTasksIntoState(
          next,
          activeId,
          matchDay,
          proceduralTemplates
        );
        snapshot = next;
        return next;
      });
      toast.success(`Ustawiono mikrocykl: ${formatFixtureLabel(fixture, fixturesTeamId)}`);
      if (snapshot) {
        void refreshMatchWeather(snapshot).then((n) => {
          if (n > 0) toast.success(`Pobrano prognozę pogody (${n}).`);
        });
      }
    },
    [
      fixturesTeamId,
      setMicrocycleState,
      dayTitleTemplates,
      proceduralTemplates,
      refreshMatchWeather,
    ]
  );

  const buildMicrocyclesFromFixtures = useCallback(() => {
    if (!activeSeasonId || !fixturesTeamId || fixtures.length === 0) return;
    let snapshot: TrainingMicrocycleState | null = null;
    setMicrocycleState((prev) => {
      let next = upsertMicrocyclesFromFixtures(
        prev,
        activeSeasonId,
        fixturesTeamId,
        fixtures
      );
      const inSeason = microcyclesForSeason(next.microcycles, activeSeasonId);
      for (const mc of inSeason) {
        const matchDay = mc.matches[0]?.dayIndex ?? 5;
        next = mergeDefaultDayPlansIntoState(next, mc.id, matchDay, dayTitleTemplates);
        next = mergeDefaultProceduralTasksIntoState(
          next,
          mc.id,
          matchDay,
          proceduralTemplates
        );
      }
      snapshot = next;
      return next;
    });
    toast.success("Uzupełniono mikrocykle na podstawie terminarza.");
    if (snapshot) {
      void refreshMatchWeather(snapshot).then((n) => {
        if (n > 0) toast.success(`Pobrano prognozę pogody dla ${n} mecz(y).`);
      });
    }
  }, [
    activeSeasonId,
    fixturesTeamId,
    fixtures,
    setMicrocycleState,
    dayTitleTemplates,
    proceduralTemplates,
    refreshMatchWeather,
  ]);

  const sortedFixtures = useMemo(() => sortFixturesForDisplay(fixtures), [fixtures]);
  const sortedWatchFixtures = useMemo(
    () => sortFixturesForDisplay(watchFixtures),
    [watchFixtures]
  );
  const watchHitsThisWeek = useMemo(
    () => fixturesInWeekByDay(watchFixtures, weekStartIso),
    [watchFixtures, weekStartIso]
  );
  const watchMatchIdsThisWeek = useMemo(
    () => new Set(watchHitsThisWeek.map((h) => h.fixture.matchId)),
    [watchHitsThisWeek]
  );
  const watchByDay = useMemo(() => {
    const map: Record<number, typeof watchHitsThisWeek> = {};
    for (const hit of watchHitsThisWeek) {
      (map[hit.dayIndex] ??= []).push(hit);
    }
    return map;
  }, [watchHitsThisWeek]);

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
      const matchDayChanged = index === 0 && patch.dayIndex !== undefined;
      setMicrocycleState((prev) => {
        let next = {
          ...prev,
          microcycles: prev.microcycles.map((m) =>
            m.id === activeMicrocycleId ? { ...m, matches: nextMatches } : m
          ),
        };
        if (matchDayChanged) {
          const matchDay = nextMatches[0]?.dayIndex ?? 5;
          next = mergeDefaultDayPlansIntoState(
            next,
            activeMicrocycleId,
            matchDay,
            dayTitleTemplates
          );
          next = mergeDefaultProceduralTasksIntoState(
            next,
            activeMicrocycleId,
            matchDay,
            proceduralTemplates
          );
        }
        return next;
      });
    },
    [
      activeMicrocycleId,
      activeMicrocycle,
      setMicrocycleState,
      dayTitleTemplates,
      proceduralTemplates,
    ]
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

      const dropOnMatchDay = matchDays.includes(dayIndex);

      if (payload.kind === "dayTitleTemplate") {
        if (dropOnMatchDay) {
          toast.error("Dzień MD ma zawsze tytuł „Mecz” — nie przypisuj szablonu.");
          return;
        }
        const tpl = dayTitleTemplates.find((t) => t.id === payload.templateId);
        if (!tpl) return;
        const offset = matchDayOffsetFromDayIndex(firstMatchDay, dayIndex);
        const plan: MicrocycleDayPlan = {
          id: generateMicrocycleId(),
          microcycleId: activeMicrocycleId,
          dayIndex,
          templateId: tpl.id,
          generalFocus: tpl.generalFocus,
          gameMoments: tpl.gameMoments,
          phaseId: null,
        };
        setDayTitleTemplatesState((prev) => ({
          templates: setTemplateDefaultMatchDayOffset(prev.templates, tpl.id, offset),
        }));
        setMicrocycleState((prev) => ({
          ...prev,
          dayPlans: [
            ...(prev.dayPlans ?? []).filter(
              (p) => !(p.microcycleId === activeMicrocycleId && p.dayIndex === dayIndex)
            ),
            plan,
          ],
        }));
        toast.success(`Zapisano domyślnie na ${formatMatchDayLabel(offset)}`);
        return;
      }

      if (payload.kind === "proceduralTaskTemplate") {
        const tpl = proceduralTemplates.find((t) => t.id === payload.templateId);
        if (!tpl) return;
        const offset = matchDayOffsetFromDayIndex(firstMatchDay, dayIndex);
        const nextTemplates = setProceduralTemplateDefaultMatchDayOffset(
          proceduralTemplates,
          tpl.id,
          offset
        );
        setProceduralTaskTemplatesState({ templates: nextTemplates });
        setMicrocycleState((prev) =>
          mergeDefaultProceduralTasksIntoState(
            prev,
            activeMicrocycleId,
            firstMatchDay,
            nextTemplates
          )
        );
        toast.success(`Zadanie procesowe → ${formatMatchDayLabel(offset)}`);
        return;
      }

      if (payload.kind === "dayTitlePlan") {
        if (dropOnMatchDay) {
          toast.error("Dzień MD ma zawsze tytuł „Mecz” — nie przenoś tytułu na MD.");
          return;
        }
        let movedTemplateId: string | null = null;
        setMicrocycleState((prev) => {
          const plans = prev.dayPlans ?? [];
          const moving = plans.find((p) => p.id === payload.planId);
          if (!moving || moving.microcycleId !== activeMicrocycleId) return prev;
          movedTemplateId = moving.templateId;
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
        if (movedTemplateId) {
          const offset = matchDayOffsetFromDayIndex(firstMatchDay, dayIndex);
          setDayTitleTemplatesState((prev) => ({
            templates: setTemplateDefaultMatchDayOffset(prev.templates, movedTemplateId!, offset),
          }));
        }
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
    [
      activeMicrocycleId,
      firstMatchDay,
      matchDays,
      gameModelState.templates,
      gameModelState.nodes,
      dayTitleTemplates,
      proceduralTemplates,
      setMicrocycleState,
      setDayTitleTemplatesState,
      setProceduralTaskTemplatesState,
    ]
  );

  const setDayTitleDefaultMd = useCallback(
    (templateId: string, rawOffset: string) => {
      const offset = rawOffset === "" ? null : Number(rawOffset);
      const nextTemplates = setTemplateDefaultMatchDayOffset(
        dayTitleTemplates,
        templateId,
        offset
      );
      setDayTitleTemplatesState({ templates: nextTemplates });
      if (!activeMicrocycleId) return;
      setMicrocycleState((prev) =>
        mergeDefaultDayPlansIntoState(prev, activeMicrocycleId, firstMatchDay, nextTemplates)
      );
    },
    [
      activeMicrocycleId,
      firstMatchDay,
      dayTitleTemplates,
      setDayTitleTemplatesState,
      setMicrocycleState,
    ]
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

  const setProceduralDefaultMd = useCallback(
    (templateId: string, rawOffset: string) => {
      const offset = rawOffset === "" ? null : Number(rawOffset);
      const nextTemplates = setProceduralTemplateDefaultMatchDayOffset(
        proceduralTemplates,
        templateId,
        offset
      );
      setProceduralTaskTemplatesState({ templates: nextTemplates });
      if (!activeMicrocycleId) return;
      setMicrocycleState((prev) =>
        mergeDefaultProceduralTasksIntoState(
          prev,
          activeMicrocycleId,
          firstMatchDay,
          nextTemplates
        )
      );
    },
    [
      activeMicrocycleId,
      firstMatchDay,
      proceduralTemplates,
      setProceduralTaskTemplatesState,
      setMicrocycleState,
    ]
  );

  const addProceduralTaskTemplate = useCallback(() => {
    const title = newProceduralTitle.trim();
    if (!title) {
      toast.error("Podaj treść zadania procesowego.");
      return;
    }
    setProceduralTaskTemplatesState((prev) => ({
      ...prev,
      templates: [
        ...prev.templates,
        {
          id: generateMicrocycleId(),
          title,
          notes: newProceduralNotes.trim(),
        },
      ],
    }));
    setNewProceduralTitle("");
    setNewProceduralNotes("");
  }, [newProceduralTitle, newProceduralNotes, setProceduralTaskTemplatesState]);

  const removeProceduralTaskTemplate = useCallback(
    (templateId: string) => {
      setProceduralTaskTemplatesState((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== templateId),
      }));
      setMicrocycleState((prev) => ({
        ...prev,
        proceduralTasks: (prev.proceduralTasks ?? []).filter(
          (t) => t.templateId !== templateId
        ),
      }));
    },
    [setProceduralTaskTemplatesState, setMicrocycleState]
  );

  const toggleProceduralTaskDone = useCallback(
    (taskId: string) => {
      setMicrocycleState((prev) => ({
        ...prev,
        proceduralTasks: (prev.proceduralTasks ?? []).map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        ),
      }));
    },
    [setMicrocycleState]
  );

  const deleteProceduralTask = useCallback(
    (taskId: string) => {
      setMicrocycleState((prev) => ({
        ...prev,
        proceduralTasks: (prev.proceduralTasks ?? []).filter((t) => t.id !== taskId),
      }));
    },
    [setMicrocycleState]
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

  const handleDragStartProceduralTemplate = useCallback(
    (e: React.DragEvent, templateId: string) => {
      setDragProceduralTemplateId(templateId);
      const p: DragPayload = { kind: "proceduralTaskTemplate", templateId };
      e.dataTransfer.setData("application/json", JSON.stringify(p));
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragTemplateId(null);
    setDragAssignmentId(null);
    setDragDayTitleTemplateId(null);
    setDragDayTitlePlanId(null);
    setDragProceduralTemplateId(null);
    setDragOverDay(null);
    setDragOverDayTitle(null);
    setCascadeHoverRootId(null);
  }, []);

  if (
    microcycleLoading ||
    gameModelLoading ||
    dayTitleTemplatesLoading ||
    proceduralTaskTemplatesLoading
  ) {
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
      <section
        className={`${styles.toolbarSection} ${toolbarOpen ? "" : styles.toolbarSectionCollapsed}`}
        aria-label="Ustawienia mikrocyklu"
      >
        <button
          type="button"
          className={styles.dayTitlesToggle}
          onClick={toggleToolbarOpen}
          aria-expanded={toolbarOpen}
          aria-controls="microcycle-toolbar-panel"
          id="microcycle-toolbar-toggle"
        >
          <span className={styles.dayTitlesToggleLeft}>
            <span className={styles.dayTitlesChevron} aria-hidden>
              {toolbarOpen ? "▾" : "▸"}
            </span>
            <span className={styles.dayTitlesToggleTitle}>Ustawienia mikrocyklu</span>
            <span className={styles.dayTitlesCountBadge}>
              M{activeMicrocycle?.number ?? "—"}
              {fixtures.length > 0 ? ` · ${fixtures.length} mecze` : ""}
            </span>
          </span>
          <span className={styles.dayTitlesToggleHint}>{toolbarOpen ? "Zwiń" : "Rozwiń"}</span>
        </button>

        {!toolbarOpen && (
          <div className={styles.toolbarCollapsedPreview} aria-hidden>
            <span className={styles.toolbarPreviewChip}>
              <span className={styles.toolbarPreviewLabel}>Zespół</span>
              <span className={styles.toolbarPreviewValue}>{selectedTeamName}</span>
            </span>
            <span className={styles.toolbarPreviewChip}>
              <span className={styles.toolbarPreviewLabel}>Sezon</span>
              <span className={styles.toolbarPreviewValue}>{activeSeasonName}</span>
            </span>
            <span className={`${styles.toolbarPreviewChip} ${styles.toolbarPreviewChipAccent}`}>
              <span className={styles.toolbarPreviewLabel}>Mikrocykl</span>
              <span className={styles.toolbarPreviewValue}>
                {activeMicrocycle?.number ?? "—"} · {weekLabel}
              </span>
            </span>
            <span className={styles.toolbarPreviewChip}>
              <span className={styles.toolbarPreviewLabel}>Mecz</span>
              <span className={styles.toolbarPreviewValue}>{toolbarMatchSummary}</span>
            </span>
          </div>
        )}

        <div
          id="microcycle-toolbar-panel"
          className={styles.toolbarPanel}
          hidden={!toolbarOpen}
          role="region"
          aria-labelledby="microcycle-toolbar-toggle"
        >
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
            <button
              type="button"
              className={styles.smallBtnDanger}
              onClick={removeActiveMicrocycle}
              aria-label="Usuń aktywny mikrocykl"
              disabled={!activeMicrocycleId || seasonMicrocycles.length === 0}
              title="Usuń aktywny mikrocykl"
            >
              Usuń
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
                  onChange={(e) => {
                    const venue = e.target.value as MicrocycleMatch["venue"];
                    updateMatch(i as 0 | 1, {
                      venue,
                      ...(venue === "home" ? { departureTime: "" } : {}),
                    });
                  }}
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
                {match.venue === "away" && (
                  <label className={styles.departureTimeWrap}>
                    <span className={styles.departureTimeLabel}>Wyjazd</span>
                    <input
                      type="time"
                      className={styles.timeInput}
                      value={match.departureTime}
                      onChange={(e) =>
                        updateMatch(i as 0 | 1, { departureTime: e.target.value })
                      }
                      aria-label={`Godzina wyjazdu — mecz ${i + 1}`}
                      disabled={!activeMicrocycleId}
                    />
                  </label>
                )}
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
                <select
                  className={styles.select}
                  value={match.surface ?? ""}
                  onChange={(e) =>
                    updateMatch(i as 0 | 1, {
                      surface: (e.target.value || null) as MicrocycleMatch["surface"],
                    })
                  }
                  aria-label={`Nawierzchnia — mecz ${i + 1}`}
                  disabled={!activeMicrocycleId}
                >
                  <option value="">Nawierzchnia</option>
                  {(
                    Object.keys(MICROCYCLE_MATCH_SURFACE_LABELS) as NonNullable<
                      MicrocycleMatch["surface"]
                    >[]
                  ).map((id) => (
                    <option key={id} value={id}>
                      {MICROCYCLE_MATCH_SURFACE_LABELS[id]}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={match.weatherCondition ?? ""}
                  onChange={(e) =>
                    updateMatch(i as 0 | 1, {
                      weatherCondition: (e.target.value ||
                        null) as MicrocycleMatch["weatherCondition"],
                    })
                  }
                  aria-label={`Pogoda — mecz ${i + 1}`}
                  disabled={!activeMicrocycleId}
                >
                  <option value="">Pogoda</option>
                  {(
                    Object.keys(MICROCYCLE_WEATHER_CONDITION_LABELS) as NonNullable<
                      MicrocycleMatch["weatherCondition"]
                    >[]
                  ).map((id) => (
                    <option key={id} value={id}>
                      {MICROCYCLE_WEATHER_CONDITION_LABELS[id]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={styles.tempInput}
                  placeholder="°C"
                  min={-30}
                  max={50}
                  step={1}
                  value={match.weatherTempC ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateMatch(i as 0 | 1, {
                      weatherTempC: raw === "" ? null : Number(raw),
                    });
                  }}
                  aria-label={`Temperatura — mecz ${i + 1}`}
                  disabled={!activeMicrocycleId}
                />
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

        <div className={`${styles.toolbarGroup} ${styles.toolbarGroupWide}`}>
          <span className={styles.toolbarLabel}>Terminarz Łączy Nas Piłka</span>
          <div className={styles.lnpFetchRow}>
            <input
              type="url"
              className={styles.lnpUrlInput}
              placeholder="https://www.laczynaspilka.pl/rozgrywki/druzyna/…?tab=tab-mecz"
              value={lnpTeamUrl}
              onChange={(e) => setLnpTeamUrl(e.target.value)}
              aria-label="Link do drużyny Łączy Nas Piłka"
              disabled={fixturesLoading}
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => void fetchLaczyFixtures()}
              disabled={fixturesLoading || !lnpTeamUrl.trim()}
            >
              {fixturesLoading
                ? "Pobieram…"
                : fixtures.length > 0
                  ? "Odśwież dane"
                  : "Pobierz dane"}
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={buildMicrocyclesFromFixtures}
              disabled={fixturesLoading || fixtures.length === 0 || !activeSeasonId}
              title="Utwórz lub uzupełnij mikrocykle tygodniami z terminarza"
            >
              Uzupełnij mikrocykle
            </button>
          </div>
          {(fixturesTeamName || fixturesFetchedAt) && (
            <p className={styles.lnpTeamHint}>
              {fixturesTeamName ? (
                <>
                  Drużyna: <strong>{fixturesTeamName}</strong>
                  {fixtures.length > 0 ? ` · ${fixtures.length} mecz(y)` : null}
                </>
              ) : null}
              {fixturesFetchedAt
                ? `${fixturesTeamName ? " · " : ""}zapisano ${new Date(fixturesFetchedAt).toLocaleString("pl-PL")}`
                : null}
              {fixtures.length > 0
                ? " — ponowne pobranie odświeża tylko mecze przed nami"
                : null}
            </p>
          )}
          {sortedFixtures.length > 0 && (
            <div className={styles.fixturesTableWrap} role="region" aria-label="Terminarz drużyny">
              <table className={styles.fixturesTable}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Mecz</th>
                    <th>Rozgrywki</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFixtures.map((f) => {
                    const isHome =
                      fixturesTeamId != null &&
                      f.hostId.toLowerCase() === fixturesTeamId.toLowerCase();
                    const opp = isHome ? f.guestName : f.hostName;
                    const d = new Date(f.dateTime);
                    const dateLabel = Number.isNaN(d.getTime())
                      ? f.dateTime
                      : d.toLocaleString("pl-PL", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                    return (
                      <tr key={f.matchId}>
                        <td>{dateLabel}</td>
                        <td>
                          {isHome ? "Dom" : "Wyjazd"} · {opp}
                          {f.scoreFinal ? ` (${f.scoreFinal})` : ""}
                        </td>
                        <td>{f.playName}</td>
                        <td>{f.state || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.smallBtn}
                            onClick={() => applyFixture(f)}
                            disabled={!activeMicrocycleId}
                            aria-label={`Zastosuj mecz z ${opp} do aktywnego mikrocyklu`}
                          >
                            Do mikrocyklu
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.lnpWatchBlock}>
            <span className={styles.lnpWatchLabel}>Podgląd innego zespołu</span>
            <p className={styles.lnpWatchHint}>
              Tylko wgląd w mecze (np. pierwsza drużyna) — bez uzupełniania mikrocykli.
            </p>
            <div className={styles.lnpFetchRow}>
              <input
                type="url"
                className={styles.lnpUrlInput}
                placeholder="Link do drugiej drużyny ŁNP…"
                value={lnpWatchTeamUrl}
                onChange={(e) => setLnpWatchTeamUrl(e.target.value)}
                aria-label="Link do drużyny ŁNP — podgląd"
                disabled={watchFixturesLoading}
              />
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => void fetchWatchFixtures()}
                disabled={watchFixturesLoading || !lnpWatchTeamUrl.trim()}
              >
                {watchFixturesLoading
                  ? "Pobieram…"
                  : watchFixtures.length > 0
                    ? "Odśwież podgląd"
                    : "Pobierz podgląd"}
              </button>
            </div>
            {(watchFixturesTeamName || watchFixturesFetchedAt) && (
              <p className={styles.lnpTeamHint}>
                {watchFixturesTeamName ? (
                  <>
                    Podgląd: <strong>{watchFixturesTeamName}</strong>
                    {watchFixtures.length > 0 ? ` · ${watchFixtures.length} mecz(y)` : null}
                  </>
                ) : null}
                {watchFixturesFetchedAt
                  ? `${watchFixturesTeamName ? " · " : ""}zapisano ${new Date(watchFixturesFetchedAt).toLocaleString("pl-PL")}`
                  : null}
              </p>
            )}
            {sortedWatchFixtures.length > 0 && (
              <div
                className={styles.fixturesTableWrap}
                role="region"
                aria-label="Podgląd terminarza innego zespołu"
              >
                <table className={styles.fixturesTable}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Mecz</th>
                      <th>Rozgrywki</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWatchFixtures.map((f) => {
                      const isHome =
                        watchFixturesTeamId != null &&
                        f.hostId.toLowerCase() === watchFixturesTeamId.toLowerCase();
                      const opp = isHome ? f.guestName : f.hostName;
                      const d = new Date(f.dateTime);
                      const dateLabel = Number.isNaN(d.getTime())
                        ? f.dateTime
                        : d.toLocaleString("pl-PL", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                      const inActiveWeek = watchMatchIdsThisWeek.has(f.matchId);
                      return (
                        <tr
                          key={f.matchId}
                          className={inActiveWeek ? styles.fixturesTableRowInWeek : undefined}
                        >
                          <td>{dateLabel}</td>
                          <td>
                            {isHome ? "Dom" : "Wyjazd"} · {opp}
                            {f.scoreFinal ? ` (${f.scoreFinal})` : ""}
                          </td>
                          <td>{f.playName}</td>
                          <td>{f.state || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
          </div>
        </div>
      </section>

      <section aria-label="Siatka mikrocyklu">
        <div className={styles.gridHeader}>
          <h2 className={styles.sectionTitle}>
            Mikrocykl {activeMicrocycle?.number ?? "—"}
          </h2>
          <div className={styles.gridHeaderActions}>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={fillWeekFromPreset}
              disabled={!activeMicrocycleId}
              title="Rozpisz wszystkie dni blokami z modelu"
            >
              Rozpisz tydzień z modelu
            </button>
            <div className={styles.viewSwitcher} role="group" aria-label="Zakres widoku">
              {GRID_VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  className={`${styles.viewSwitcherBtn} ${
                    viewDays === opt.days ? styles.viewSwitcherBtnActive : ""
                  }`}
                  onClick={() => changeViewDays(opt.days)}
                  aria-pressed={viewDays === opt.days}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {viewDays !== 7 && (
              <div className={styles.viewNav}>
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => setAnchorDayIndex((p) => Math.max(0, p - viewDays))}
                  disabled={anchorDayIndex <= 0}
                  aria-label="Poprzednie dni"
                >
                  ←
                </button>
                <span className={styles.viewNavLabel}>
                  {visibleDays.map((i) => weekdayShortPl(i)).join(" · ")}
                </span>
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() =>
                    setAnchorDayIndex((p) => Math.min(7 - viewDays, p + viewDays))
                  }
                  disabled={anchorDayIndex >= 7 - viewDays}
                  aria-label="Następne dni"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>

        {activeMicrocycle && (
          <MicrocycleRulesBar violations={ruleViolations} onFocusDay={focusDay} />
        )}

        <div className={styles.gridWrap}>
          <div
            className={styles.weekGrid}
            data-view-days={viewDays}
            role="grid"
            aria-label="Dni tygodnia mikrocyklu"
          >
            {weekDates.map((d, dayIndex) => {
              if (!visibleDays.includes(dayIndex)) return null;
              const mdLines = matchDayLabelsForColumn(dayIndex, matchDays);
              const list = byDay[dayIndex] ?? [];
              const dayPlan = planByDay[dayIndex];
              const daySchedule = getDayScheduleForDay(activeMicrocycle?.daySchedules, dayIndex);
              const matchesOnDay = matches.filter((m) => m.dayIndex === dayIndex);
              const isMatchDay = matchesOnDay.length > 0;
              const watchOnDay = watchByDay[dayIndex] ?? [];
              const hasWatchMatch = watchOnDay.length > 0;
              const dayTitleDisplay = resolveDayTitleDisplay(isMatchDay, dayPlan);
              const dayProceduralTasks = activeMicrocycleId
                ? proceduralTasksForDay(
                    microcycleState.proceduralTasks,
                    activeMicrocycleId,
                    dayIndex
                  )
                : [];
              const dayBlocks = blocksForDay(activeBlocks, dayIndex);
              const dayLoad = weekLoads[dayIndex];
              const tasksDone = dayProceduralTasks.filter((t) => t.done).length;
              const zadaniaOpen =
                sectionPrefs.zadania ?? dayProceduralTasks.length > 0;
              const treningOpen = sectionPrefs.trening ?? viewDays !== 7;
              const celeOpen = sectionPrefs.cele ?? true;
              const treningBadge = dayLoad
                ? `${dayBlocks.length} blk · ${dayLoad.plannedMinutes ?? dayLoad.targets.minutes}′`
                : "—";
              const zadaniaBadge =
                dayProceduralTasks.length > 0
                  ? `${tasksDone}/${dayProceduralTasks.length}`
                  : "0";
              return (
                <div
                  key={dayIndex}
                  className={`${styles.dayColumn} ${dragOverDay === dayIndex ? styles.dayColumnDrag : ""} ${isMatchDay ? styles.dayColumnMatch : ""} ${hasWatchMatch && !isMatchDay ? styles.dayColumnWatch : ""} ${hasWatchMatch && isMatchDay ? styles.dayColumnWatchAlongside : ""}`}
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
                    {!isMatchDay && (
                      <div className={styles.dayHeaderTimes} onMouseDown={stopHeaderInputPropagation}>
                        <label className={styles.dayTimeLabel}>
                          <span className={styles.srOnly}>Godzina rozpoczęcia treningu</span>
                          <input
                            type="time"
                            className={styles.dayTimeInput}
                            value={daySchedule.startTime}
                            onChange={(e) =>
                              updateDaySchedule(dayIndex, { startTime: e.target.value })
                            }
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
                            onChange={(e) =>
                              updateDaySchedule(dayIndex, { endTime: e.target.value })
                            }
                            onClick={stopHeaderInputPropagation}
                            aria-label={`${weekdayShortPl(dayIndex)} — koniec treningu`}
                          />
                        </label>
                      </div>
                    )}
                    {dayTitleDisplay ? (
                      <div
                        className={`${styles.dayPlanCard} ${
                          dayTitleDisplay.locked ? styles.dayPlanCardLocked : ""
                        } ${
                          !dayTitleDisplay.locked &&
                          dayPlan &&
                          dragDayTitlePlanId === dayPlan.id
                            ? styles.dayPlanCardDragging
                            : ""
                        }`}
                        draggable={!dayTitleDisplay.locked && !!dayPlan}
                        onDragStart={
                          !dayTitleDisplay.locked && dayPlan
                            ? (e) => {
                                e.stopPropagation();
                                handleDragStartDayTitlePlan(e, dayPlan.id);
                              }
                            : undefined
                        }
                        onDragEnd={!dayTitleDisplay.locked ? handleDragEnd : undefined}
                      >
                        <p className={styles.dayPlanFocus}>{dayTitleDisplay.generalFocus}</p>
                        {dayTitleDisplay.gameMoments.trim() && (
                          <p className={styles.dayPlanMoments}>{dayTitleDisplay.gameMoments}</p>
                        )}
                        {!dayTitleDisplay.locked && dayPlan && (
                          <button
                            type="button"
                            className={styles.deleteAssign}
                            onClick={() => deleteDayPlan(dayPlan.id)}
                          >
                            Usuń tytuł
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className={styles.dayPlanPlaceholder}>Upuść tytuł dnia</p>
                    )}
                  </div>

                  {isMatchDay && (
                    <div className={styles.dayMatchSlot}>
                      {matchesOnDay.map((m, mi) => (
                        <MicrocycleDayMatchCard
                          key={`${m.dayIndex}-${mi}`}
                          match={m}
                          mdLabel={mdLines[mi] ?? mdLines[0] ?? "MD"}
                          matchIndex={mi}
                        />
                      ))}
                    </div>
                  )}

                  {hasWatchMatch && (
                    <div className={styles.dayWatchSlot} aria-label="Mecz z podglądu innego zespołu">
                      {watchOnDay.map(({ fixture: f }) => {
                        const isHome =
                          watchFixturesTeamId != null &&
                          f.hostId.toLowerCase() === watchFixturesTeamId.toLowerCase();
                        const opp = isHome ? f.guestName : f.hostName;
                        const dWatch = new Date(f.dateTime);
                        const timeLabel = Number.isNaN(dWatch.getTime())
                          ? ""
                          : `${String(dWatch.getHours()).padStart(2, "0")}:${String(dWatch.getMinutes()).padStart(2, "0")}`;
                        return (
                          <div
                            key={f.matchId}
                            className={styles.dayWatchCard}
                            title={watchFixturesTeamName || "Podgląd zespołu"}
                          >
                            <div className={styles.dayWatchCardHead}>
                              <span className={styles.dayWatchBadge}>
                                {watchFixturesTeamName
                                  ? `Podgląd · ${watchFixturesTeamName}`
                                  : "Podgląd"}
                              </span>
                            </div>
                            <p className={styles.dayWatchRow}>
                              <span className={styles.dayWatchLabel}>Godzina</span>
                              <span>{timeLabel || "—"}</span>
                            </p>
                            <p className={styles.dayWatchRow}>
                              <span className={styles.dayWatchLabel}>Mecz</span>
                              <span>
                                {isHome ? "Dom" : "Wyjazd"} · {opp}
                                {f.scoreFinal ? ` (${f.scoreFinal})` : ""}
                              </span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.daySections}>
                    <DayColumnSection
                      kind="zadania"
                      dayIndex={dayIndex}
                      title="Zadania"
                      badge={zadaniaBadge}
                      open={zadaniaOpen}
                      onToggle={() => setSectionOpen("zadania", !zadaniaOpen)}
                    >
                      {dayProceduralTasks.length > 0 ? (
                        <ul
                          className={styles.proceduralDayList}
                          aria-label="Zadania procesowe dnia"
                        >
                          {dayProceduralTasks.map((task) => (
                            <li
                              key={task.id}
                              className={`${styles.proceduralDayItem} ${
                                task.done ? styles.proceduralDayItemDone : ""
                              }`}
                            >
                              <label className={styles.proceduralDayLabel}>
                                <input
                                  type="checkbox"
                                  checked={task.done}
                                  onChange={() => toggleProceduralTaskDone(task.id)}
                                  aria-label={task.title}
                                />
                                <span className={styles.proceduralDayTitle}>{task.title}</span>
                              </label>
                              {task.notes?.trim() ? (
                                <p className={styles.proceduralDayNotes}>{task.notes}</p>
                              ) : null}
                              <button
                                type="button"
                                className={styles.proceduralDayRemove}
                                onClick={() => deleteProceduralTask(task.id)}
                                aria-label={`Usuń zadanie: ${task.title}`}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.daySectionHint}>Brak zadań procesowych</p>
                      )}
                    </DayColumnSection>

                    <DayColumnSection
                      kind="trening"
                      dayIndex={dayIndex}
                      title="Trening"
                      badge={treningBadge}
                      open={treningOpen}
                      onToggle={() => setSectionOpen("trening", !treningOpen)}
                      keepBodyVisible
                    >
                      {dayLoad ? (
                        <MicrocycleDayMotorPanel
                          load={dayLoad}
                          blocks={dayBlocks}
                          compact={viewDays === 7}
                          collapsed={!treningOpen}
                          disabled={!activeMicrocycleId}
                          onDominantChange={setDayDominant}
                          onTargetChange={setDayTarget}
                          onResetDay={resetDayLoad}
                          onFillFromPreset={fillDayFromPreset}
                          onAddBlock={addBlock}
                          onUpdateBlock={updateBlock}
                          onSetBlockFormat={setBlockFormat}
                          onDeleteBlock={deleteBlock}
                          onMoveBlock={moveBlock}
                        />
                      ) : (
                        <p className={styles.daySectionHint}>Brak planu obciążenia</p>
                      )}
                    </DayColumnSection>

                    <DayColumnSection
                      kind="cele"
                      dayIndex={dayIndex}
                      title="Cele treningowe"
                      badge={String(list.length)}
                      open={celeOpen}
                      onToggle={() => setSectionOpen("cele", !celeOpen)}
                    >
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
                          if (payload && !isDayHeaderDrag(payload)) {
                            dropOnDay(dayIndex, raw);
                          }
                        }}
                      >
                        {list.length === 0 && (
                          <p className={styles.emptyCell}>Upuść element modelu gry</p>
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
                    </DayColumnSection>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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

      <section
        className={`${styles.dayTitlesSection} ${dayTitlesOpen ? "" : styles.dayTitlesSectionCollapsed}`}
        aria-label="Tytuły dni treningowych"
      >
        <button
          type="button"
          className={styles.dayTitlesToggle}
          onClick={toggleDayTitlesOpen}
          aria-expanded={dayTitlesOpen}
          aria-controls="day-titles-panel"
          id="day-titles-toggle"
        >
          <span className={styles.dayTitlesToggleLeft}>
            <span className={styles.dayTitlesChevron} aria-hidden>
              {dayTitlesOpen ? "▾" : "▸"}
            </span>
            <span className={styles.dayTitlesToggleTitle}>Tytuły dni treningowych</span>
            <span className={styles.dayTitlesCountBadge}>
              {dayTitleTemplates.length}
              {dayTitlesAssignedCount > 0 ? ` · ${dayTitlesAssignedCount} MD` : ""}
            </span>
          </span>
          <span className={styles.dayTitlesToggleHint}>
            {dayTitlesOpen ? "Zwiń" : "Rozwiń"}
          </span>
        </button>

        {!dayTitlesOpen && dayTitleTemplates.length > 0 && (
          <div className={styles.dayTitlesCollapsedPreview} aria-hidden>
            {[...dayTitleTemplates]
              .sort((a, b) => {
                const ao = a.defaultMatchDayOffset ?? 99;
                const bo = b.defaultMatchDayOffset ?? 99;
                return ao - bo;
              })
              .slice(0, 8)
              .map((tpl) => (
                <span
                  key={tpl.id}
                  className={`${styles.dayTitlesPreviewChip} ${
                    tpl.defaultMatchDayOffset != null ? styles.dayTitlesPreviewChipAssigned : ""
                  }`}
                >
                  {tpl.defaultMatchDayOffset != null && (
                    <span className={styles.dayTitlesPreviewMd}>
                      {formatDefaultMdLabel(tpl.defaultMatchDayOffset)}
                    </span>
                  )}
                  <span className={styles.dayTitlesPreviewFocus}>{tpl.generalFocus}</span>
                </span>
              ))}
            {dayTitleTemplates.length > 8 && (
              <span className={styles.dayTitlesPreviewMore}>+{dayTitleTemplates.length - 8}</span>
            )}
          </div>
        )}

        <div
          id="day-titles-panel"
          className={styles.dayTitlesPanel}
          hidden={!dayTitlesOpen}
          role="region"
          aria-labelledby="day-titles-toggle"
        >
          <p className={styles.dayTitlesHint}>
            Przypisz szablon do MD (lista lub przeciągnięcie na dzień). MD (dzień meczowy) ma zawsze
            tytuł „Mecz”. Nowe mikrocykle dostaną pozostałe tytuły automatycznie względem dnia meczu.
          </p>
          <div className={styles.dayTitleList}>
            {dayTitleTemplates.length === 0 && (
              <p className={styles.emptyLibrary}>Brak szablonów — dodaj pierwszy poniżej.</p>
            )}
            {dayTitleTemplates.map((tpl) => {
              // MD (0) nie jest przypisywalne do tytułów — traktuj jak brak.
              const assignableOffset =
                tpl.defaultMatchDayOffset != null && tpl.defaultMatchDayOffset !== 0
                  ? tpl.defaultMatchDayOffset
                  : null;
              const assigned = assignableOffset != null;
              return (
                <div
                  key={tpl.id}
                  className={`${styles.dayTitleChip} ${assigned ? styles.dayTitleChipAssigned : ""} ${dragDayTitleTemplateId === tpl.id ? styles.dayTitleChipDragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStartDayTitleTemplate(e, tpl.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.dayTitleChipDrag} aria-hidden title="Przeciągnij na dzień">
                    ⋮⋮
                  </div>
                  <div className={styles.dayTitleChipBody}>
                    <p className={styles.dayTitleFocus}>{tpl.generalFocus}</p>
                    {tpl.gameMoments.trim() && (
                      <p className={styles.dayTitleMoments}>{tpl.gameMoments}</p>
                    )}
                  </div>
                  <label className={styles.dayTitleMdLabel}>
                    <span className={styles.srOnly}>Domyślny dzień MD</span>
                    <select
                      className={`${styles.dayTitleMdSelect} ${assigned ? styles.dayTitleMdSelectAssigned : ""}`}
                      value={assignableOffset == null ? "" : String(assignableOffset)}
                      aria-label={`Domyślny MD dla: ${tpl.generalFocus}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDayTitleDefaultMd(tpl.id, e.target.value)}
                    >
                      <option value="">Brak MD</option>
                      {DAY_TITLE_ASSIGNABLE_MD_OFFSETS.map((o) => (
                        <option key={o} value={o}>
                          {formatDefaultMdLabel(o)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.dayTitleRemove}
                    onClick={() => removeDayTitleTemplate(tpl.id)}
                    aria-label={`Usuń szablon: ${tpl.generalFocus}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
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
        </div>
      </section>

      <section
        className={`${styles.dayTitlesSection} ${proceduralOpen ? "" : styles.dayTitlesSectionCollapsed}`}
        aria-label="Zadania procesowe"
      >
        <button
          type="button"
          className={styles.dayTitlesToggle}
          onClick={toggleProceduralOpen}
          aria-expanded={proceduralOpen}
          aria-controls="procedural-tasks-panel"
          id="procedural-tasks-toggle"
        >
          <span className={styles.dayTitlesToggleLeft}>
            <span className={styles.dayTitlesChevron} aria-hidden>
              {proceduralOpen ? "▾" : "▸"}
            </span>
            <span className={styles.dayTitlesToggleTitle}>Zadania procesowe</span>
            <span className={styles.dayTitlesCountBadge}>
              {proceduralTemplates.length}
              {proceduralAssignedCount > 0 ? ` · ${proceduralAssignedCount} MD` : ""}
            </span>
          </span>
          <span className={styles.dayTitlesToggleHint}>
            {proceduralOpen ? "Zwiń" : "Rozwiń"}
          </span>
        </button>

        {!proceduralOpen && proceduralTemplates.length > 0 && (
          <div className={styles.dayTitlesCollapsedPreview} aria-hidden>
            {[...proceduralTemplates]
              .sort((a, b) => {
                const ao = a.defaultMatchDayOffset ?? 99;
                const bo = b.defaultMatchDayOffset ?? 99;
                return ao - bo;
              })
              .slice(0, 8)
              .map((tpl) => (
                <span
                  key={tpl.id}
                  className={`${styles.dayTitlesPreviewChip} ${
                    tpl.defaultMatchDayOffset != null ? styles.dayTitlesPreviewChipAssigned : ""
                  }`}
                >
                  {tpl.defaultMatchDayOffset != null && (
                    <span className={styles.dayTitlesPreviewMd}>
                      {formatDefaultMdLabel(tpl.defaultMatchDayOffset)}
                    </span>
                  )}
                  <span className={styles.dayTitlesPreviewFocus}>{tpl.title}</span>
                </span>
              ))}
            {proceduralTemplates.length > 8 && (
              <span className={styles.dayTitlesPreviewMore}>
                +{proceduralTemplates.length - 8}
              </span>
            )}
          </div>
        )}

        <div
          id="procedural-tasks-panel"
          className={styles.dayTitlesPanel}
          hidden={!proceduralOpen}
          role="region"
          aria-labelledby="procedural-tasks-toggle"
        >
          <p className={styles.dayTitlesHint}>
            Przypisz stałe zadania procesowe do MD (lista lub przeciągnięcie na dzień). Nowe
            mikrocykle dostaną je automatycznie względem dnia meczu — wiele zadań na ten sam
            dzień jest dozwolone.
          </p>
          <div className={styles.dayTitleList}>
            {proceduralTemplates.length === 0 && (
              <p className={styles.emptyLibrary}>Brak zadań — dodaj pierwsze poniżej.</p>
            )}
            {proceduralTemplates.map((tpl) => {
              const assigned = tpl.defaultMatchDayOffset != null;
              return (
                <div
                  key={tpl.id}
                  className={`${styles.dayTitleChip} ${assigned ? styles.dayTitleChipAssigned : ""} ${dragProceduralTemplateId === tpl.id ? styles.dayTitleChipDragging : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStartProceduralTemplate(e, tpl.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className={styles.dayTitleChipDrag} aria-hidden title="Przeciągnij na dzień">
                    ⋮⋮
                  </div>
                  <div className={styles.dayTitleChipBody}>
                    <p className={styles.dayTitleFocus}>{tpl.title}</p>
                    {tpl.notes?.trim() && (
                      <p className={styles.dayTitleMoments}>{tpl.notes}</p>
                    )}
                  </div>
                  <label className={styles.dayTitleMdLabel}>
                    <span className={styles.srOnly}>Domyślny dzień MD</span>
                    <select
                      className={`${styles.dayTitleMdSelect} ${assigned ? styles.dayTitleMdSelectAssigned : ""}`}
                      value={
                        tpl.defaultMatchDayOffset == null
                          ? ""
                          : String(tpl.defaultMatchDayOffset)
                      }
                      aria-label={`Domyślny MD dla: ${tpl.title}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setProceduralDefaultMd(tpl.id, e.target.value)}
                    >
                      <option value="">Brak MD</option>
                      {DAY_TITLE_DEFAULT_MD_OFFSETS.map((o) => (
                        <option key={o} value={o}>
                          {formatDefaultMdLabel(o)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.dayTitleRemove}
                    onClick={() => removeProceduralTaskTemplate(tpl.id)}
                    aria-label={`Usuń zadanie: ${tpl.title}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.dayTitleAddRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Treść zadania procesowego"
              value={newProceduralTitle}
              onChange={(e) => setNewProceduralTitle(e.target.value)}
              aria-label="Treść zadania procesowego"
            />
            <input
              type="text"
              className={styles.input}
              placeholder="Notatki (opcjonalnie)"
              value={newProceduralNotes}
              onChange={(e) => setNewProceduralNotes(e.target.value)}
              aria-label="Notatki do zadania procesowego"
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={addProceduralTaskTemplate}
              disabled={!newProceduralTitle.trim()}
            >
              Dodaj zadanie
            </button>
          </div>
        </div>
      </section>

      <MicrocycleMethodologyPanel />
    </div>
  );
}
