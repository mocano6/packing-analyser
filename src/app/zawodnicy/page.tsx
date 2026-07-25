"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { ResponsiveRadar } from "@nivo/radar";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SidePanel from "@/components/SidePanel/SidePanel";
import TeamsMultiSelectorModal from "@/components/TeamsMultiSelectorModal/TeamsMultiSelectorModal";
import PlayerComparisonRankingToolbar from "@/components/PlayerComparisonRankingToolbar/PlayerComparisonRankingToolbar";
import type { Team as TeamCatalogEntry } from "@/constants/teamsLoader";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerComparisonData, type PlayerComparisonFilters } from "@/hooks/usePlayerComparisonData";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useTeams } from "@/hooks/useTeams";
import { filterTeamsByUserAccess } from "@/lib/teamsForUserAccess";
import { getDB } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import {
  buildSharedWeightedIndexPresetsDocument,
  buildWeightedIndexFirestoreDocument,
  readSharedWeightedIndexPresets,
  readWeightedIndexStateJson,
  resolveSharedWeightedIndexPresets,
  WEIGHTED_INDEX_FIRESTORE_DOC_ID,
  WEIGHTED_INDEX_SHARED_PRESETS_COLLECTION,
  WEIGHTED_INDEX_SHARED_PRESETS_DOC_ID,
} from "@/lib/playerComparisonWeightedIndexStore";
import {
  PLAYER_COMPARISON_AXIS_METRIC_IDS,
  PLAYER_COMPARISON_METRICS,
  buildPlayerComparisonRankingSelectOptions,
  getPlayerComparisonAxisDisplay,
  getPlayerComparisonPairCellTone,
  formatPlayerComparisonRawSurplusParen,
  normalizePlayerComparisonRadarScore,
  resolveComparisonAxisValueId,
  resolvePlayerComparisonMetricId,
  supportsComparisonMetricRole,
  type PlayerComparisonMetricFamily,
  type PlayerComparisonMetricId,
  type PlayerComparisonMetricRole,
  type PlayerComparisonPairCellTone,
  type PlayerComparisonRow,
} from "@/utils/playerComparisonMetrics";
import { getDefaultPlayerComparisonDateRange } from "@/utils/playerComparisonDateDefaults";
import {
  PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY,
  parsePlayerComparisonPreferences,
  serializePlayerComparisonPreferences,
} from "@/utils/playerComparisonPreferences";
import {
  buildPlayerWeightedIndexRanking,
  canComputeWeightedIndex,
  formatWeightedIndexValue,
  formatWeightedMetricPercent,
  getActiveWeightedMetricConfigs,
  getRemainingWeightedIndexPercent,
  getDefaultWeightedIndexBetterWhen,
  getWeightedIndexBetterWhenLabel,
  getWeightedIndexMetricLabel,
  isWeightedIndexOverBudget,
  sanitizeWeightedIndexConfigs,
  setWeightedIndexMetricBetterWhen,
  setWeightedIndexMetricWeight,
  toggleWeightedIndexMetric,
  WEIGHTED_INDEX_PERCENT_BUDGET,
  type PlayerComparisonWeightedMetricConfig,
  type PlayerComparisonWeightedMetricContribution,
  type WeightedIndexBetterWhen,
} from "@/utils/playerComparisonWeightedIndex";
import {
  formatWeightedIndexChartEventLabel,
  formatWeightedIndexContributionRawValue,
  formatWeightedIndexEventBreakdown,
  type PlayerComparisonMetricEventStats,
} from "@/utils/playerComparisonMetricEventStats";
import {
  buildDefaultWeightedIndexConfigs,
  cloneWeightedIndexConfigs,
  deleteWeightedIndexPreset,
  findWeightedIndexPresetByName,
  isValidWeightedIndexPresetName,
  normalizeWeightedIndexPresetName,
  parsePlayerComparisonWeightedIndexStorage,
  PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY,
  serializePlayerComparisonWeightedIndexStorage,
  upsertWeightedIndexPreset,
  type PlayerComparisonWeightedIndexPreset,
} from "@/utils/playerComparisonWeightedIndexPreferences";
import styles from "./zawodnicy.module.css";

/** Kolory serii A/B — spider + oznaczenia przy selectach. */
const COMPARISON_PLAYER_COLORS = ["#2563eb", "#16a34a"] as const;

/** Kolory segmentów wykresu indeksu wagowego (kolejność = aktywne KPI). */
const WEIGHTED_INDEX_CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#ca8a04",
  "#4f46e5",
  "#059669",
  "#dc2626",
  "#0d9488",
  "#9333ea",
  "#d97706",
  "#1d4ed8",
  "#15803d",
  "#be123c",
  "#0369a1",
  "#854d0e",
] as const;

const metricById = new Map(PLAYER_COMPARISON_METRICS.map((metric) => [metric.id, metric]));

type WeightedIndexChartRow = Record<string, string | number> & {
  name: string;
  playerId: string;
  index: number;
};

const weightedIndexEventStatsFromContribution = (
  contribution: PlayerComparisonWeightedMetricContribution | undefined,
): PlayerComparisonMetricEventStats | null => {
  if (!contribution || contribution.eventTotal == null || contribution.eventTotal <= 0) return null;
  return {
    total: contribution.eventTotal,
    successful: contribution.eventSuccessful ?? 0,
  };
};

const WeightedIndexMetricCell = ({
  contribution,
}: {
  contribution: PlayerComparisonWeightedMetricContribution | undefined;
}) => {
  if (!contribution) return <>—</>;
  const eventStats = weightedIndexEventStatsFromContribution(contribution);
  const rawLabel = formatWeightedIndexContributionRawValue(contribution.metricId, contribution.rawValue);
  const eventLabel = formatWeightedIndexEventBreakdown(contribution.metricId, eventStats);
  return (
    <div className={styles.weightedIndexMetricCell}>
      <span className={styles.weightedIndexMetricCellContribution}>
        {formatWeightedIndexValue(contribution.contribution)}
      </span>
      {rawLabel ? <span className={styles.weightedIndexMetricCellMeta}>{rawLabel}</span> : null}
      {eventLabel ? <span className={styles.weightedIndexMetricCellMeta}>{eventLabel}</span> : null}
    </div>
  );
};

const formatMetricValue = (metricId: PlayerComparisonMetricId, value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const digits = metricById.get(metricId)?.fractionDigits ?? 1;
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const formatComparisonMinutes = (minutes: number): string => {
  if (!Number.isFinite(minutes)) return "—";
  return `${Math.round(minutes).toLocaleString("pl-PL")} min`;
};

const comparePairToneClass = (tone: PlayerComparisonPairCellTone): string | undefined => {
  if (tone === "better") return styles.compareCellBetter;
  if (tone === "worse") return styles.compareCellWorse;
  if (tone === "even") return styles.compareCellEven;
  return undefined;
};

const comparePairToneTitle = (tone: PlayerComparisonPairCellTone): string | undefined => {
  if (tone === "better") return "Lepszy wynik niż drugi zawodnik w tej kategorii";
  if (tone === "worse") return "Słabszy wynik niż drugi zawodnik w tej kategorii";
  if (tone === "even") return "Identyczna wartość";
  return undefined;
};

const parseYear = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type FullTableSortColumn = "playerName" | "birthYear" | "position" | "minutes" | "matches" | "kpi";

type ComparisonActivity = "pair" | "weightedIndex";

const defaultKpiTableSortDirection = (metricId: PlayerComparisonMetricId): "asc" | "desc" =>
  metricById.get(metricId)?.direction === "lower" ? "asc" : "desc";

function weightedIndexStateDoc(uid: string) {
  return doc(getDB(), "users", uid, "playerComparisonWeightedIndex", WEIGHTED_INDEX_FIRESTORE_DOC_ID);
}

function weightedIndexSharedPresetsDoc() {
  return doc(
    getDB(),
    WEIGHTED_INDEX_SHARED_PRESETS_COLLECTION,
    WEIGHTED_INDEX_SHARED_PRESETS_DOC_ID,
  );
}

export default function ZawodnicyPage() {
  const { maskName, isPresentationMode } = usePresentationMode();
  const { isAuthenticated, isLoading: authLoading, user, userTeams, isAdmin, userRole, linkedPlayerId, logout } = useAuth();
  const { teams, isLoading: teamsLoading } = useTeams();
  const { players, refetchPlayers } = usePlayersState();

  const defaultDateRange = useMemo(() => getDefaultPlayerComparisonDateRange(), []);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [birthYearFrom, setBirthYearFrom] = useState("");
  const [birthYearTo, setBirthYearTo] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateRange.from);
  const [dateTo, setDateTo] = useState(defaultDateRange.to);
  const [mode, setMode] = useState<"sum" | "per90">("per90");
  const [excludeExtremeMatches, setExcludeExtremeMatches] = useState(false);

  const {
    comparison,
    matches,
    matchesForComparison,
    excludedExtremeMatchCount,
    isLoading,
    error,
    lastFilters,
    loadComparison,
  } = usePlayerComparisonData(mode, excludeExtremeMatches);

  const [metricFamily, setMetricFamily] = useState<PlayerComparisonMetricFamily>("pxt");
  const [metricRole, setMetricRole] = useState<PlayerComparisonMetricRole>("sender");

  const rankingKpiSelectOptions = useMemo(() => buildPlayerComparisonRankingSelectOptions(), []);
  const [minMinutesStr, setMinMinutesStr] = useState("");
  const [minMatchesStr, setMinMatchesStr] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [fullTableSort, setFullTableSort] = useState<{ column: FullTableSortColumn; direction: "asc" | "desc" }>(() => ({
    column: "kpi",
    direction: defaultKpiTableSortDirection(resolvePlayerComparisonMetricId("pxt", "sender")),
  }));
  const [primaryPlayerId, setPrimaryPlayerId] = useState("");
  const [secondaryPlayerId, setSecondaryPlayerId] = useState("");
  const [comparisonActivity, setComparisonActivity] = useState<ComparisonActivity>("pair");
  const [weightedIndexConfigs, setWeightedIndexConfigs] = useState<PlayerComparisonWeightedMetricConfig[]>(() =>
    buildDefaultWeightedIndexConfigs(),
  );
  const [weightedIndexPresets, setWeightedIndexPresets] = useState<PlayerComparisonWeightedIndexPreset[]>([]);
  const [activeWeightedPresetId, setActiveWeightedPresetId] = useState<string | null>(null);
  const [weightedPresetNameInput, setWeightedPresetNameInput] = useState("");
  const [weightedPresetMessage, setWeightedPresetMessage] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [weightedIndexRemoteReady, setWeightedIndexRemoteReady] = useState(false);
  const skipWeightedIndexSaveOnce = useRef(false);

  const userTeamAccess = useMemo(
    () => ({ isAdmin, allowedTeamIds: userTeams ?? [] }),
    [isAdmin, userTeams],
  );
  const availableTeams = useMemo(() => filterTeamsByUserAccess(teams, userTeamAccess), [teams, userTeamAccess]);
  const teamsCatalog = teams as TeamCatalogEntry[];
  const sidePanelTeamId = useMemo(
    () => selectedTeamIds[0] ?? availableTeams[0]?.id ?? "",
    [availableTeams, selectedTeamIds],
  );
  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const rows = comparison?.rows ?? [];
  const positionsCatalog = useMemo(() => rows.map((r) => r.position), [rows]);

  const positionFilteredRows = useMemo(() => {
    if (selectedPositions.length === 0) return rows;
    return rows.filter((r) => selectedPositions.includes(r.position));
  }, [rows, selectedPositions]);

  const minMinutesThreshold = Math.max(0, Number.parseInt(minMinutesStr, 10) || 0);
  const minMatchesThreshold = Math.max(0, Number.parseInt(minMatchesStr, 10) || 0);

  const eligibleRows = useMemo(
    () =>
      positionFilteredRows.filter(
        (r) => r.minutes >= minMinutesThreshold && r.matchesPlayed >= minMatchesThreshold,
      ),
    [minMatchesThreshold, minMinutesThreshold, positionFilteredRows],
  );

  const activeMetricId = useMemo(
    () => resolvePlayerComparisonMetricId(metricFamily, metricRole),
    [metricFamily, metricRole],
  );
  const selectedMetric = metricById.get(activeMetricId) ?? PLAYER_COMPARISON_METRICS[0];
  const rowsWithAnyValue = useMemo(
    () =>
      eligibleRows.filter((row) => PLAYER_COMPARISON_METRICS.some((metric) => Math.abs(row.values[metric.id]) > 0)),
    [eligibleRows],
  );

  const sortedRows = useMemo(() => {
    const direction = metricById.get(activeMetricId)?.direction ?? "higher";
    return [...eligibleRows].sort((a, b) => {
      const diff = a.values[activeMetricId] - b.values[activeMetricId];
      return direction === "lower" ? diff : -diff;
    });
  }, [activeMetricId, eligibleRows]);

  const sortedSelectRows = useMemo(
    () =>
      [...rowsWithAnyValue].sort((a, b) => {
        const byLast = a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true });
        if (byLast !== 0) return byLast;
        return a.firstName.localeCompare(b.firstName, "pl", { sensitivity: "base", numeric: true });
      }),
    [rowsWithAnyValue],
  );

  useEffect(() => {
    setFullTableSort((s) =>
      s.column === "kpi" ? { column: "kpi", direction: defaultKpiTableSortDirection(activeMetricId) } : s,
    );
  }, [activeMetricId]);

  const fullTableSortedRows = useMemo(() => {
    const { column, direction } = fullTableSort;
    const rows = [...eligibleRows];

    const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

    rows.sort((a, b) => {
      let d = 0;
      switch (column) {
        case "playerName":
          d = a.playerName.localeCompare(b.playerName, "pl", { sensitivity: "base", numeric: true });
          break;
        case "birthYear": {
          const aNull = a.birthYear == null;
          const bNull = b.birthYear == null;
          if (aNull && bNull) d = 0;
          else if (aNull) return 1;
          else if (bNull) return -1;
          else d = a.birthYear! - b.birthYear!;
          break;
        }
        case "position":
          d = (a.position || "").localeCompare(b.position || "", "pl", { sensitivity: "base", numeric: true });
          break;
        case "minutes":
          d = a.minutes - b.minutes;
          break;
        case "matches":
          d = a.matchesPlayed - b.matchesPlayed;
          break;
        case "kpi":
          d =
            finiteOr(a.values[activeMetricId], Number.POSITIVE_INFINITY) -
            finiteOr(b.values[activeMetricId], Number.POSITIVE_INFINITY);
          break;
        default:
          d = 0;
      }
      if (d !== 0) return direction === "asc" ? d : -d;
      return (
        a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true }) || a.playerId.localeCompare(b.playerId)
      );
    });

    return rows;
  }, [activeMetricId, eligibleRows, fullTableSort]);

  const handleFullTableSort = (column: FullTableSortColumn) => {
    setFullTableSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const direction =
        column === "kpi" ? defaultKpiTableSortDirection(activeMetricId) : "asc";
      return { column, direction };
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferences = parsePlayerComparisonPreferences(window.localStorage.getItem(PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY));
    setSelectedTeamIds(preferences.selectedTeamIds);
    setBirthYearFrom(preferences.birthYearFrom);
    setBirthYearTo(preferences.birthYearTo);
    setMode(preferences.mode);
    setMetricFamily(preferences.comparisonMetricFamily);
    setMetricRole(preferences.comparisonMetricRole);
    setMinMinutesStr(preferences.minMinutes);
    setMinMatchesStr(preferences.minMatches);
    setSelectedPositions(preferences.selectedPositions);
    const weightedStorage = parsePlayerComparisonWeightedIndexStorage(
      window.localStorage.getItem(PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY),
    );
    setWeightedIndexPresets(weightedStorage.presets);
    setActiveWeightedPresetId(weightedStorage.activePresetId);
    setWeightedIndexConfigs(sanitizeWeightedIndexConfigs(cloneWeightedIndexConfigs(weightedStorage.draftConfigs)));
    const activePreset = weightedStorage.presets.find((preset) => preset.id === weightedStorage.activePresetId);
    setWeightedPresetNameInput(activePreset?.name ?? "");
    if (activePreset) {
      setSelectedPositions(activePreset.selectedPositions);
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || typeof window === "undefined") return;

    if (!isAuthenticated || !user?.uid) {
      setWeightedIndexRemoteReady(true);
      return;
    }

    let cancelled = false;
    setWeightedIndexRemoteReady(false);

    (async () => {
      try {
        const localRaw = window.localStorage.getItem(PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY);
        const localStorageParsed = parsePlayerComparisonWeightedIndexStorage(localRaw);

        const [privateSnapshot, sharedSnapshot] = await Promise.all([
          getDoc(weightedIndexStateDoc(user.uid)),
          getDoc(weightedIndexSharedPresetsDoc()),
        ]);
        if (cancelled) return;

        let privateStorage = localStorageParsed;
        if (privateSnapshot.exists()) {
          const stateJson = readWeightedIndexStateJson(
            privateSnapshot.data() as Record<string, unknown>,
          );
          const remote = stateJson ? parsePlayerComparisonWeightedIndexStorage(stateJson) : null;
          if (remote) {
            privateStorage = remote;
          }
        } else if (localRaw) {
          await setDoc(
            weightedIndexStateDoc(user.uid),
            buildWeightedIndexFirestoreDocument(
              serializePlayerComparisonWeightedIndexStorage({
                ...localStorageParsed,
                presets: [],
              }),
              Date.now(),
            ),
          );
        }

        const sharedRaw = sharedSnapshot.exists()
          ? readSharedWeightedIndexPresets(sharedSnapshot.data() as Record<string, unknown>)
          : null;
        const resolved = resolveSharedWeightedIndexPresets({
          isAdmin,
          sharedPresets: sharedRaw,
          privatePresets: privateStorage.presets,
          localPresets: localStorageParsed.presets,
        });

        if (resolved.shouldWriteShared) {
          await setDoc(
            weightedIndexSharedPresetsDoc(),
            buildSharedWeightedIndexPresetsDocument(resolved.presets, Date.now()),
          );
        }

        if (cancelled) return;

        skipWeightedIndexSaveOnce.current = true;
        setWeightedIndexPresets(resolved.presets);
        setActiveWeightedPresetId(privateStorage.activePresetId);
        setWeightedIndexConfigs(
          sanitizeWeightedIndexConfigs(cloneWeightedIndexConfigs(privateStorage.draftConfigs)),
        );
        const activePreset =
          resolved.presets.find((preset) => preset.id === privateStorage.activePresetId) ?? null;
        setWeightedPresetNameInput(activePreset?.name ?? "");
        if (activePreset) {
          setSelectedPositions(activePreset.selectedPositions);
        }

        window.localStorage.setItem(
          PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY,
          serializePlayerComparisonWeightedIndexStorage({
            presets: [],
            activePresetId: privateStorage.activePresetId,
            draftConfigs: privateStorage.draftConfigs,
          }),
        );
      } catch (error) {
        console.error("Błąd ładowania pakietów wag z Firebase:", error);
      } finally {
        if (!cancelled) {
          setWeightedIndexRemoteReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, isAuthenticated, preferencesLoaded, user?.uid]);

  useEffect(() => {
    if (!preferencesLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(
      PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY,
      serializePlayerComparisonPreferences({
        selectedTeamIds,
        birthYearFrom,
        birthYearTo,
        mode,
        comparisonMetricFamily: metricFamily,
        comparisonMetricRole: metricRole,
        minMinutes: minMinutesStr,
        minMatches: minMatchesStr,
        selectedPositions,
      }),
    );
  }, [
    birthYearFrom,
    birthYearTo,
    metricFamily,
    metricRole,
    minMatchesStr,
    minMinutesStr,
    mode,
    preferencesLoaded,
    selectedPositions,
    selectedTeamIds,
  ]);

  useEffect(() => {
    if (!preferencesLoaded || typeof window === "undefined") return;

    // Prywatny blob: tylko draft + activePresetId. Lista pakietów jest współdzielona.
    const storage = {
      presets: [] as PlayerComparisonWeightedIndexPreset[],
      activePresetId: activeWeightedPresetId,
      draftConfigs: weightedIndexConfigs,
    };

    window.localStorage.setItem(
      PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY,
      serializePlayerComparisonWeightedIndexStorage(storage),
    );

    if (skipWeightedIndexSaveOnce.current) {
      skipWeightedIndexSaveOnce.current = false;
      return;
    }

    if (!isAuthenticated || !user?.uid || !weightedIndexRemoteReady) return;

    const timer = window.setTimeout(() => {
      setDoc(
        weightedIndexStateDoc(user.uid),
        buildWeightedIndexFirestoreDocument(
          serializePlayerComparisonWeightedIndexStorage(storage),
          Date.now(),
        ),
      ).catch((error: unknown) => {
        console.error("Błąd zapisu draftu indeksu wagowego do Firebase:", error);
        toast.error("Nie udało się zapisać ustawień wag w chmurze. Zmiany są zapisane lokalnie.", {
          id: "weighted-index-save-error",
        });
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeWeightedPresetId,
    isAuthenticated,
    preferencesLoaded,
    user?.uid,
    weightedIndexConfigs,
    weightedIndexRemoteReady,
  ]);

  const activeWeightedMetrics = useMemo(
    () => getActiveWeightedMetricConfigs(weightedIndexConfigs),
    [weightedIndexConfigs],
  );
  const activeWeightedWeightSum = useMemo(
    () => activeWeightedMetrics.reduce((sum, config) => sum + config.weight, 0),
    [activeWeightedMetrics],
  );
  const weightedIndexOverBudget = useMemo(
    () => isWeightedIndexOverBudget(weightedIndexConfigs),
    [weightedIndexConfigs],
  );
  const weightedIndexCanCompute = useMemo(
    () => canComputeWeightedIndex(weightedIndexConfigs),
    [weightedIndexConfigs],
  );
  const remainingWeightedPoints = useMemo(
    () => getRemainingWeightedIndexPercent(weightedIndexConfigs),
    [weightedIndexConfigs],
  );

  const weightedIndexRanking = useMemo(
    () => buildPlayerWeightedIndexRanking(eligibleRows, weightedIndexConfigs),
    [eligibleRows, weightedIndexConfigs],
  );

  const weightedIndexMetricChartSeries = useMemo(
    () =>
      activeWeightedMetrics.map((config, index) => ({
        metricId: config.metricId,
        label: getWeightedIndexMetricLabel(config.metricId),
        weight: config.weight,
        color: WEIGHTED_INDEX_CHART_COLORS[index % WEIGHTED_INDEX_CHART_COLORS.length],
      })),
    [activeWeightedMetrics],
  );

  const weightedIndexStackedBarData = useMemo((): WeightedIndexChartRow[] => {
    return weightedIndexRanking.map((entry) => {
      const row: WeightedIndexChartRow = {
        name: maskName(entry.row.playerName),
        playerId: entry.row.playerId,
        index: Number(entry.index.toFixed(1)),
      };
      for (const contribution of entry.contributions) {
        row[contribution.metricId] = Number(contribution.contribution.toFixed(2));
        if (contribution.eventTotal != null && contribution.eventTotal > 0) {
          row[`${contribution.metricId}__evTotal`] = contribution.eventTotal;
          row[`${contribution.metricId}__evOk`] = contribution.eventSuccessful ?? 0;
        }
      }
      return row;
    });
  }, [maskName, weightedIndexRanking]);

  const weightedIndexContributionByPlayerId = useMemo(() => {
    const map = new Map<string, Map<PlayerComparisonMetricId, PlayerComparisonWeightedMetricContribution>>();
    for (const entry of weightedIndexRanking) {
      map.set(
        entry.row.playerId,
        new Map(entry.contributions.map((item) => [item.metricId, item])),
      );
    }
    return map;
  }, [weightedIndexRanking]);

  const weightedIndexChartHeight = useMemo(
    () => Math.max(320, weightedIndexRanking.length * 36),
    [weightedIndexRanking.length],
  );

  const handleWeightedMetricToggle = (metricId: PlayerComparisonMetricId, enabled: boolean) => {
    setWeightedIndexConfigs((current) => toggleWeightedIndexMetric(current, metricId, enabled));
  };

  const handleWeightedMetricWeightChange = (metricId: PlayerComparisonMetricId, weightStr: string) => {
    const parsed = Number.parseInt(weightStr.replace(",", "."), 10);
    const weight = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setWeightedIndexConfigs((current) => setWeightedIndexMetricWeight(current, metricId, weight));
  };

  const handleWeightedMetricBetterWhenChange = (
    metricId: PlayerComparisonMetricId,
    betterWhen: WeightedIndexBetterWhen,
  ) => {
    setWeightedIndexConfigs((current) => setWeightedIndexMetricBetterWhen(current, metricId, betterWhen));
  };

  const activeWeightedPreset = useMemo(
    () => weightedIndexPresets.find((preset) => preset.id === activeWeightedPresetId) ?? null,
    [activeWeightedPresetId, weightedIndexPresets],
  );

  const handleLoadWeightedPreset = (presetId: string) => {
    const preset = weightedIndexPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setActiveWeightedPresetId(preset.id);
    setWeightedIndexConfigs(sanitizeWeightedIndexConfigs(cloneWeightedIndexConfigs(preset.configs)));
    setSelectedPositions(preset.selectedPositions);
    setWeightedPresetNameInput(preset.name);
    setWeightedPresetMessage(`Wczytano pakiet „${preset.name}”.`);
  };

  const handleSaveWeightedPreset = () => {
    if (!isAdmin) {
      setWeightedPresetMessage("Tylko administrator może zapisywać pakiety.");
      return;
    }
    const name = normalizeWeightedIndexPresetName(weightedPresetNameInput);
    if (!isValidWeightedIndexPresetName(name)) {
      setWeightedPresetMessage("Podaj nazwę pakietu (1–48 znaków).");
      return;
    }
    const existing = findWeightedIndexPresetByName(weightedIndexPresets, name);
    const { presets, presetId } = upsertWeightedIndexPreset(
      weightedIndexPresets,
      name,
      weightedIndexConfigs,
      selectedPositions,
    );
    setWeightedIndexPresets(presets);
    setActiveWeightedPresetId(presetId);
    setWeightedPresetNameInput(name);
    setWeightedPresetMessage(
      existing ? `Zaktualizowano pakiet „${name}”.` : `Zapisano pakiet „${name}”.`,
    );
    void setDoc(
      weightedIndexSharedPresetsDoc(),
      buildSharedWeightedIndexPresetsDocument(presets, Date.now()),
    ).catch((error: unknown) => {
      console.error("Błąd zapisu wspólnych pakietów wag:", error);
      toast.error("Nie udało się zapisać pakietu w chmurze.", {
        id: "weighted-index-shared-save-error",
      });
    });
  };

  const handleDeleteWeightedPreset = () => {
    if (!isAdmin) {
      setWeightedPresetMessage("Tylko administrator może usuwać pakiety.");
      return;
    }
    if (!activeWeightedPresetId) {
      setWeightedPresetMessage("Wybierz pakiet do usunięcia.");
      return;
    }
    const preset = activeWeightedPreset;
    const nextPresets = deleteWeightedIndexPreset(weightedIndexPresets, activeWeightedPresetId);
    setWeightedIndexPresets(nextPresets);
    setActiveWeightedPresetId(null);
    setWeightedPresetNameInput("");
    setWeightedPresetMessage(preset ? `Usunięto pakiet „${preset.name}”.` : "Usunięto pakiet.");
    void setDoc(
      weightedIndexSharedPresetsDoc(),
      buildSharedWeightedIndexPresetsDocument(nextPresets, Date.now()),
    ).catch((error: unknown) => {
      console.error("Błąd usuwania wspólnego pakietu wag:", error);
      toast.error("Nie udało się usunąć pakietu w chmurze.", {
        id: "weighted-index-shared-delete-error",
      });
    });
  };

  useEffect(() => {
    if (!weightedPresetMessage) return;
    const timer = window.setTimeout(() => setWeightedPresetMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [weightedPresetMessage]);

  useEffect(() => {
    if (sortedSelectRows.length === 0) {
      setPrimaryPlayerId("");
      setSecondaryPlayerId("");
      return;
    }
    const firstId = sortedSelectRows[0].playerId;
    setPrimaryPlayerId((current) =>
      sortedSelectRows.some((row) => row.playerId === current) ? current : firstId,
    );
    setSecondaryPlayerId((current) => {
      if (sortedSelectRows.some((row) => row.playerId === current) && current !== firstId) return current;
      return sortedSelectRows[1]?.playerId ?? firstId;
    });
  }, [sortedSelectRows]);

  const loadedTeamNames = useMemo(() => {
    const ids = lastFilters?.teamIds ?? selectedTeamIds;
    return ids.map((teamId) => maskName(teamNameById.get(teamId) ?? teamId));
  }, [lastFilters?.teamIds, maskName, selectedTeamIds, teamNameById, isPresentationMode]);

  const barData = useMemo(
    () =>
      sortedRows.slice(0, 12).map((row) => {
        const v = row.values[activeMetricId];
        const value = Number.isFinite(v) ? Number(v.toFixed(3)) : 0;
        return { name: maskName(row.playerName), value };
      }),
    [activeMetricId, isPresentationMode, maskName, sortedRows],
  );

  const primaryPlayer = sortedSelectRows.find((row) => row.playerId === primaryPlayerId) ?? null;
  const secondaryPlayer = sortedSelectRows.find((row) => row.playerId === secondaryPlayerId) ?? null;
  const radarData = useMemo(() => {
    if (!primaryPlayer || !secondaryPlayer) return [];
    const primaryLabel = maskName(primaryPlayer.playerName);
    const secondaryLabel = maskName(secondaryPlayer.playerName);
    return PLAYER_COMPARISON_AXIS_METRIC_IDS.map((axisId) => {
      const valueId = resolveComparisonAxisValueId(axisId, metricRole);
      const { radarAxis } = getPlayerComparisonAxisDisplay(axisId, metricRole);
      return {
        metric: radarAxis,
        [primaryLabel]: normalizePlayerComparisonRadarScore(eligibleRows, primaryPlayer, valueId),
        [secondaryLabel]: normalizePlayerComparisonRadarScore(eligibleRows, secondaryPlayer, valueId),
      };
    });
  }, [eligibleRows, isPresentationMode, maskName, metricRole, primaryPlayer, secondaryPlayer]);

  const primaryComparisonLabel = primaryPlayer ? maskName(primaryPlayer.playerName) : "";
  const secondaryComparisonLabel = secondaryPlayer ? maskName(secondaryPlayer.playerName) : "";

  const rankingToolbarProps = useMemo(
    () => ({
      styles,
      metricFamily,
      onMetricFamilyChange: (family: PlayerComparisonMetricFamily) => {
        setMetricFamily(family);
        if (!supportsComparisonMetricRole(family)) {
          setMetricRole("sender");
        }
      },
      metricRole,
      onMetricRoleChange: setMetricRole,
      rankingKpiSelectOptions,
      mode,
      onModeChange: setMode,
      excludeExtremeMatches,
      onExcludeExtremeMatchesChange: (value: boolean) => setExcludeExtremeMatches(value),
      comparisonLoaded: Boolean(comparison),
      positionsCatalog,
      selectedPositions,
      onSelectedPositionsChange: setSelectedPositions,
      minMinutesStr,
      onMinMinutesStrChange: setMinMinutesStr,
      minMatchesStr,
      onMinMatchesStrChange: setMinMatchesStr,
    }),
    [
      comparison,
      excludeExtremeMatches,
      metricFamily,
      metricRole,
      minMatchesStr,
      minMinutesStr,
      mode,
      positionsCatalog,
      rankingKpiSelectOptions,
      selectedPositions,
    ],
  );

  const handleLoad = async () => {
    const filters: PlayerComparisonFilters = {
      teamIds: selectedTeamIds,
      birthYearFrom: parseYear(birthYearFrom),
      birthYearTo: parseYear(birthYearTo),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      mode,
    };
    await loadComparison(filters);
  };

  const sidePanel = (
    <SidePanel
      players={players}
      actions={[]}
      matchInfo={null}
      isAdmin={isAdmin}
      userRole={userRole ?? undefined}
      linkedPlayerId={linkedPlayerId}
      selectedTeam={sidePanelTeamId}
      onRefreshData={refetchPlayers}
      onImportSuccess={() => {}}
      onImportError={() => {}}
      onLogout={logout}
    />
  );

  if (authLoading) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <div className={styles.spinner} />
          <p>Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <h1 className={styles.centeredTitle}>Brak dostępu</h1>
          <p className={styles.centeredHint}>Musisz być zalogowany, aby zobaczyć porównywarkę zawodników.</p>
          <Link href="/login" className={styles.primaryButton}>
            Przejdź do logowania
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin && (!userTeams || userTeams.length === 0)) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <h1 className={styles.centeredTitle}>Brak dostępu do zespołów</h1>
          <p className={styles.centeredHint}>Twoje konto nie ma przypisanych zespołów.</p>
          <button type="button" onClick={logout} className={styles.primaryButton}>
            Wyloguj się
          </button>
        </div>
        {sidePanel}
      </div>
    );
  }

  if (teamsLoading) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <div className={styles.spinner} />
          <p>Ładowanie zespołów...</p>
        </div>
        {sidePanel}
      </div>
    );
  }

  return (
    <div className={styles.pageRoot}>
      <header className={styles.header}>
        <div>
          <h1>Porównywarka zawodników</h1>
          <p>Dane KPI z meczów. Porównanie: Packing, PXT, xT, NPxG, wejścia PK, przechwyty, straty i xT strat.</p>
        </div>
      </header>

      <section className={styles.filtersPanel} aria-labelledby="player-comparison-filters">
        <div className={styles.sectionHeading}>
          <h2 id="player-comparison-filters">Filtry porównania</h2>
          <p className={styles.sectionHint}>Zespoły, roczniki i zakres dat — pobieranie dopiero po „Załaduj porównanie”. Tryb per 90 / suma, pozycje i progi minut zmienisz w panelu rankingu bez ponownego pobierania.</p>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.teamsFilterCell}>
            <TeamsMultiSelectorModal
              teamsCatalog={teamsCatalog}
              userTeamAccess={userTeamAccess}
              selectedTeamIds={selectedTeamIds}
              onChange={setSelectedTeamIds}
              containerClassName={styles.teamsMultiSelectorInRow}
            />
          </div>

          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Rocznik od</span>
            <input
              id="birth-year-from"
              type="number"
              inputMode="numeric"
              placeholder="np. 2007"
              value={birthYearFrom}
              onChange={(event) => setBirthYearFrom(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Rocznik do</span>
            <input
              id="birth-year-to"
              type="number"
              inputMode="numeric"
              placeholder="np. 2009"
              value={birthYearTo}
              onChange={(event) => setBirthYearTo(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Data meczu od</span>
            <input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={styles.input} />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Data meczu do</span>
            <input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={styles.input} />
          </div>
          <div className={styles.filterActions}>
            <span className={styles.filterSummaryLine}>
              <strong>{selectedTeamIds.length}</strong> zesp.
              {birthYearFrom || birthYearTo ? ` · r. ${birthYearFrom || "…"}–${birthYearTo || "…"}` : ""}
            </span>
            <button type="button" className={styles.primaryButton} onClick={handleLoad} disabled={isLoading || selectedTeamIds.length === 0}>
              {isLoading ? "Ładowanie…" : "Załaduj porównanie"}
            </button>
          </div>
        </div>
      </section>

      {error && <p className={styles.errorText}>{error}</p>}

      {!comparison && !isLoading && (
        <section className={styles.emptyState}>
          <h2>Ustaw filtry, żeby rozpocząć</h2>
          <p>Na starcie nie pobieramy listy meczów dla tej analizy. Wybierz zespoły i (opcjonalnie) roczniki, potem załaduj porównanie.</p>
        </section>
      )}

      {comparison && (
        <>
          <section className={styles.summaryGrid} aria-label="Podsumowanie porównania">
            <article className={styles.summaryCard}>
              <span>Zawodnicy w analizie</span>
              <strong title="Po progach minut, meczów i filtrze pozycji">
                {eligibleRows.length}
                {rows.length > 0 ? ` / ${rows.length}` : ""}
              </strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Mecze w rankingu</span>
              <strong>{matchesForComparison.length}</strong>
              {excludeExtremeMatches && excludedExtremeMatchCount > 0 ? (
                <p className={styles.summaryCardMeta}>
                  Z załadowanych {matches.length}: wykluczono {excludedExtremeMatchCount} skrajnych
                </p>
              ) : null}
            </article>
            <article className={styles.summaryCard}>
              <span>Tryb</span>
              <strong>{mode === "per90" ? "Per 90" : "Suma"}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Zespoły</span>
              <strong className={styles.summaryTeams}>{loadedTeamNames.length ? loadedTeamNames.join(", ") : "—"}</strong>
            </article>
          </section>

          {comparison.usedPer90Fallback && mode === "per90" && (
            <p className={styles.warningText}>
              Dla części zawodników nie znaleziono minut w meczach. Ich wartości w trybie per 90 pokazujemy jak sumę (bez skalowania).
            </p>
          )}

          {rows.length === 0 ? (
            <section className={styles.emptyState}>
              <h2>Brak zawodników dla wybranych filtrów</h2>
              <p>Zmień zakres roczników albo wybierz inne zespoły.</p>
            </section>
          ) : eligibleRows.length === 0 ? (
            <section className={styles.emptyState}>
              <h2>Żaden zawodnik nie spełnia kryteriów</h2>
              <p>
                Zmniejsz próg minimalnych minut lub meczów albo poszerz filtr pozycji (albo usuń go — „Pokaż wszystkie pozycje” w modalu).
              </p>
            </section>
          ) : (
            <>
              <article className={styles.panel}>
                  <div className={styles.panelHeaderRankingBlock}>
                  <h2 className={styles.panelTitle}>Ranking KPI</h2>
                  <PlayerComparisonRankingToolbar idPrefix="ranking" {...rankingToolbarProps} />
                  <p className={styles.rankingClientHint}>
                    Per 90 / suma, pozycje oraz progi minut i meczów działają na już pobranych danych — bez ponownego
                    ładowania. Te filtry wpływają na wykres rankingu, porównanie 1:1 i indeks wagowy poniżej.
                  </p>
                </div>

                <div className={`${styles.panelHeader} ${styles.panelComparisonSubheader}`}>
                  <div>
                    <h2 className={styles.panelTitle}>Porównanie zawodników</h2>
                    <p className={styles.panelSubtitle}>
                      Wybierz czynność: klasyczne porównanie 1:1 ze spider mapą albo indeks wagowy z własnymi KPI i
                      procentami. W indeksie wagowym metryki wielorolowe (Packing, PXT, xT, PK, P1–P3) są osobno dla
                      podania, przyjęcia i dryblingu — bez zależności od suwaka roli w rankingu.
                    </p>
                  </div>
                  <div className={styles.comparisonActivityToggle} role="group" aria-label="Tryb porównania zawodników">
                    <button
                      type="button"
                      className={`${styles.modeButton} ${comparisonActivity === "pair" ? styles.modeButtonActive : ""}`}
                      onClick={() => setComparisonActivity("pair")}
                      aria-pressed={comparisonActivity === "pair"}
                    >
                      Porównanie 1:1
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${comparisonActivity === "weightedIndex" ? styles.modeButtonActive : ""}`}
                      onClick={() => setComparisonActivity("weightedIndex")}
                      aria-pressed={comparisonActivity === "weightedIndex"}
                    >
                      Indeks wagowy
                    </button>
                  </div>
                </div>

                {sortedSelectRows.length > 0 ? (
                  comparisonActivity === "pair" ? (
                  <>
                <div className={styles.chartWrapper}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fill: "#475569", fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [formatMetricValue(activeMetricId, Number(value)), selectedMetric.label]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                      />
                      <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                  <div className={styles.comparisonLayout}>
                    {primaryPlayer && secondaryPlayer ? (
                      <div className={styles.radarWrapper}>
                        <ResponsiveRadar
                          data={radarData}
                          keys={[primaryComparisonLabel, secondaryComparisonLabel]}
                          indexBy="metric"
                          maxValue={100}
                          margin={{ top: 48, right: 64, bottom: 48, left: 64 }}
                          curve="linearClosed"
                          borderWidth={2}
                          borderColor={{ from: "color" }}
                          gridLevels={5}
                          gridShape="circular"
                          gridLabelOffset={18}
                          enableDots
                          dotSize={6}
                          dotBorderWidth={2}
                          dotBorderColor={{ from: "color" }}
                          colors={[...COMPARISON_PLAYER_COLORS]}
                          fillOpacity={0.15}
                          blendMode="multiply"
                          motionConfig="wobbly"
                          sliceTooltip={({ index }) => {
                            const axisId = PLAYER_COMPARISON_AXIS_METRIC_IDS.find(
                              (id) => getPlayerComparisonAxisDisplay(id, metricRole).radarAxis === index,
                            );
                            if (!axisId) return null;
                            const valueId = resolveComparisonAxisValueId(axisId, metricRole);
                            const disp = getPlayerComparisonAxisDisplay(axisId, metricRole);
                            return (
                              <div className={styles.radarTooltip}>
                                <strong>{disp.compareTable}</strong>
                                <span>
                                  {primaryComparisonLabel}: {formatMetricValue(valueId, primaryPlayer.values[valueId])}
                                </span>
                                <span>
                                  {secondaryComparisonLabel}: {formatMetricValue(valueId, secondaryPlayer.values[valueId])}
                                </span>
                              </div>
                            );
                          }}
                        />
                      </div>
                    ) : null}
                    <div className={styles.compareTableWrapper}>
                      <table className={`${styles.playersTable} ${styles.comparePairTable}`}>
                        <caption className={styles.compareTableCaption}>
                          Pierwszy wiersz: rozegrane minuty w wybranym zakresie. Zielone tło — lepszy wynik KPI; czerwone — słabszy. Przy wyższej wartości surowej w parze nadwyżka w nawiasie, np. (+0,15).
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">KPI</th>
                            <th scope="col">
                              <div className={styles.compareTableThPlayer}>
                                <div className={styles.compareTableThPlayerRow}>
                                  <span
                                    className={styles.playerColorDot}
                                    style={{ backgroundColor: COMPARISON_PLAYER_COLORS[0] }}
                                    title="Kolor serii zawodnika A na spider mapie"
                                    aria-hidden
                                  />
                                  <select
                                    value={primaryPlayerId}
                                    onChange={(event) => setPrimaryPlayerId(event.target.value)}
                                    className={`${styles.select} ${styles.compareTableHeadSelect}`}
                                    aria-label="Zawodnik A (pierwsza kolumna porównania)"
                                  >
                                    {sortedSelectRows.map((row) => (
                                      <option key={row.playerId} value={row.playerId}>
                                        {maskName(row.playerName)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </th>
                            <th scope="col">
                              <div className={styles.compareTableThPlayer}>
                                <div className={styles.compareTableThPlayerRow}>
                                  <span
                                    className={styles.playerColorDot}
                                    style={{ backgroundColor: COMPARISON_PLAYER_COLORS[1] }}
                                    title="Kolor serii zawodnika B na spider mapie"
                                    aria-hidden
                                  />
                                  <select
                                    value={secondaryPlayerId}
                                    onChange={(event) => setSecondaryPlayerId(event.target.value)}
                                    className={`${styles.select} ${styles.compareTableHeadSelect}`}
                                    aria-label="Zawodnik B (druga kolumna porównania)"
                                  >
                                    {sortedSelectRows.map((row) => (
                                      <option key={row.playerId} value={row.playerId}>
                                        {maskName(row.playerName)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        {primaryPlayer && secondaryPlayer ? (
                          <tbody>
                            <tr className={styles.compareMinutesRow}>
                              <td>Rozegrane minuty</td>
                              <td className={styles.compareValueCell}>{formatComparisonMinutes(primaryPlayer.minutes)}</td>
                              <td className={styles.compareValueCell}>{formatComparisonMinutes(secondaryPlayer.minutes)}</td>
                            </tr>
                            {PLAYER_COMPARISON_AXIS_METRIC_IDS.map((axisId) => {
                              const valueId = resolveComparisonAxisValueId(axisId, metricRole);
                              const { compareTable } = getPlayerComparisonAxisDisplay(axisId, metricRole);
                              const direction = metricById.get(valueId)?.direction ?? "higher";
                              const pv = primaryPlayer.values[valueId];
                              const sv = secondaryPlayer.values[valueId];
                              const tone = getPlayerComparisonPairCellTone(pv, sv, direction, valueId);
                              const pSurplus = formatPlayerComparisonRawSurplusParen(valueId, pv, sv);
                              const sSurplus = formatPlayerComparisonRawSurplusParen(valueId, sv, pv);
                              const pToneClass = comparePairToneClass(tone.primary);
                              const sToneClass = comparePairToneClass(tone.secondary);
                              return (
                                <tr key={`${axisId}-${metricRole}`}>
                                  <td>{compareTable}</td>
                                  <td
                                    className={[styles.compareValueCell, pToneClass].filter(Boolean).join(" ")}
                                    title={comparePairToneTitle(tone.primary)}
                                  >
                                    <span className={styles.compareValueLine}>
                                      <span className={styles.compareValueMain}>{formatMetricValue(valueId, pv)}</span>
                                      {pSurplus ? (
                                        <span className={styles.compareValueDelta} title="Nadwyżka względem drugiego zawodnika">
                                          {pSurplus}
                                        </span>
                                      ) : null}
                                    </span>
                                  </td>
                                  <td
                                    className={[styles.compareValueCell, sToneClass].filter(Boolean).join(" ")}
                                    title={comparePairToneTitle(tone.secondary)}
                                  >
                                    <span className={styles.compareValueLine}>
                                      <span className={styles.compareValueMain}>{formatMetricValue(valueId, sv)}</span>
                                      {sSurplus ? (
                                        <span className={styles.compareValueDelta} title="Nadwyżka względem drugiego zawodnika">
                                          {sSurplus}
                                        </span>
                                      ) : null}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        ) : null}
                      </table>
                    </div>
                  </div>
                  </>
                  ) : (
                  <div className={styles.weightedIndexLayout}>
                    <section className={styles.weightedIndexConfigPanel} aria-labelledby="weighted-index-config-title">
                      <h3 id="weighted-index-config-title" className={styles.weightedIndexConfigTitle}>
                        Parametry i wagi
                      </h3>
                      <p className={styles.weightedIndexConfigHint}>
                        Przydzielaj procenty (0–100) każdemu zaznaczonemu KPI osobno. Łącznie możesz użyć maksymalnie{" "}
                        <strong>{WEIGHTED_INDEX_PERCENT_BUDGET} %</strong> — mniejsza suma też jest OK. Przy każdej
                        metryce wybierz, czy lepszy wynik to <strong>↑ więcej</strong>, czy{" "}
                        <strong>↓ mniej</strong> (np. straty domyślnie „mniej”). Metryki wielorolowe (Packing, PXT,
                        xT, PK, P1–P3) wybierasz osobno dla podania, przyjęcia i dryblingu. Dla obrońców:{" "}
                        <strong>na linii strzału</strong> oraz <strong>łączne xG zablokowanych strzałów</strong> przy
                        obronie przed strzałami przeciwnika.
                      </p>

                      <div className={styles.weightedIndexPresetPanel} aria-labelledby="weighted-index-presets-title">
                        <h4 id="weighted-index-presets-title" className={styles.weightedIndexPresetTitle}>
                          Zapisane pakiety wag
                        </h4>
                        <p className={styles.weightedIndexConfigHint}>
                          Pakiety są współdzielone dla wszystkich użytkowników. Edycja (zapis / usuwanie) tylko dla
                          administratora. Wczytanie ustawia wagi KPI oraz zaznaczone pozycje z filtra powyżej.
                        </p>
                        <div className={styles.weightedIndexPresetRow}>
                          <label htmlFor="weighted-preset-select" className={styles.weightedIndexPresetLabel}>
                            Pakiet
                          </label>
                          <select
                            id="weighted-preset-select"
                            value={activeWeightedPresetId ?? ""}
                            onChange={(event) => {
                              const presetId = event.target.value;
                              if (!presetId) {
                                setActiveWeightedPresetId(null);
                                return;
                              }
                              handleLoadWeightedPreset(presetId);
                            }}
                            className={styles.select}
                            aria-label="Wczytaj zapisany pakiet wag"
                          >
                            <option value="">— wybierz pakiet —</option>
                            {weightedIndexPresets.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isAdmin ? (
                          <>
                            <div className={styles.weightedIndexPresetRow}>
                              <label htmlFor="weighted-preset-name" className={styles.weightedIndexPresetLabel}>
                                Nazwa
                              </label>
                              <input
                                id="weighted-preset-name"
                                type="text"
                                value={weightedPresetNameInput}
                                onChange={(event) => setWeightedPresetNameInput(event.target.value)}
                                placeholder="np. napastnik"
                                className={styles.input}
                                maxLength={48}
                                aria-label="Nazwa pakietu wag"
                              />
                            </div>
                            <div className={styles.weightedIndexPresetActions}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={handleSaveWeightedPreset}
                              >
                                Zapisz pakiet
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButtonDanger}
                                onClick={handleDeleteWeightedPreset}
                                disabled={!activeWeightedPresetId}
                              >
                                Usuń
                              </button>
                            </div>
                          </>
                        ) : null}
                        {weightedPresetMessage ? (
                          <p className={styles.weightedIndexPresetMessage} role="status">
                            {weightedPresetMessage}
                          </p>
                        ) : null}
                      </div>

                      <ul className={styles.weightedIndexMetricList}>
                        {weightedIndexConfigs.map((config) => {
                          const label = getWeightedIndexMetricLabel(config.metricId);
                          const defaultBetterWhen = getDefaultWeightedIndexBetterWhen(config.metricId);
                          const betterWhenLabel = getWeightedIndexBetterWhenLabel(config.betterWhen);
                          return (
                            <li key={config.metricId} className={styles.weightedIndexMetricRow}>
                              <label className={styles.weightedIndexMetricLabel}>
                                <input
                                  type="checkbox"
                                  checked={config.enabled}
                                  onChange={(event) =>
                                    handleWeightedMetricToggle(config.metricId, event.target.checked)
                                  }
                                  aria-label={`Uwzględnij ${label} w indeksie`}
                                />
                                <span>{label}</span>
                              </label>
                              <div className={styles.weightedIndexMetricControls}>
                                <div
                                  className={styles.weightedIndexDirectionToggle}
                                  role="group"
                                  aria-label={`Kierunek oceny dla ${label}: ${betterWhenLabel}`}
                                >
                                  <button
                                    type="button"
                                    className={`${styles.weightedIndexDirectionBtn} ${
                                      config.betterWhen === "higher" ? styles.weightedIndexDirectionBtnActive : ""
                                    }`}
                                    aria-pressed={config.betterWhen === "higher"}
                                    aria-label={`${label}: lepiej więcej`}
                                    disabled={!config.enabled}
                                    onClick={() =>
                                      handleWeightedMetricBetterWhenChange(config.metricId, "higher")
                                    }
                                    title={
                                      config.betterWhen !== defaultBetterWhen && config.betterWhen === "higher"
                                        ? `Domyślnie: ${getWeightedIndexBetterWhenLabel(defaultBetterWhen)}`
                                        : "Lepiej więcej"
                                    }
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.weightedIndexDirectionBtn} ${
                                      config.betterWhen === "lower" ? styles.weightedIndexDirectionBtnActive : ""
                                    }`}
                                    aria-pressed={config.betterWhen === "lower"}
                                    aria-label={`${label}: lepiej mniej`}
                                    disabled={!config.enabled}
                                    onClick={() =>
                                      handleWeightedMetricBetterWhenChange(config.metricId, "lower")
                                    }
                                    title={
                                      config.betterWhen !== defaultBetterWhen && config.betterWhen === "lower"
                                        ? `Domyślnie: ${getWeightedIndexBetterWhenLabel(defaultBetterWhen)}`
                                        : "Lepiej mniej"
                                    }
                                  >
                                    ↓
                                  </button>
                                </div>
                                <div className={styles.weightedIndexWeightField}>
                                  <label
                                    htmlFor={`weight-${config.metricId}`}
                                    className={styles.weightedIndexWeightLabel}
                                  >
                                    %
                                  </label>
                                  <input
                                    id={`weight-${config.metricId}`}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={WEIGHTED_INDEX_PERCENT_BUDGET}
                                    step={1}
                                    value={config.enabled ? config.weight : ""}
                                    placeholder="0"
                                    disabled={!config.enabled}
                                    onChange={(event) =>
                                      handleWeightedMetricWeightChange(config.metricId, event.target.value)
                                    }
                                    className={styles.input}
                                    aria-label={`Procent dla ${label} (0–100)`}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <p className={styles.weightedIndexSummary}>
                        Aktywne KPI: <strong>{activeWeightedMetrics.length}</strong>
                        {activeWeightedMetrics.length > 0 ? (
                          <>
                            {" "}
                            · suma procentów:{" "}
                            <strong
                              className={
                                weightedIndexOverBudget ? styles.weightedIndexBudgetBad : styles.weightedIndexBudgetOk
                              }
                            >
                              {formatWeightedMetricPercent(activeWeightedWeightSum)} /{" "}
                              {formatWeightedMetricPercent(WEIGHTED_INDEX_PERCENT_BUDGET)}
                            </strong>
                            {!weightedIndexOverBudget && remainingWeightedPoints > 0 ? (
                              <> · pozostało: {formatWeightedMetricPercent(remainingWeightedPoints)}</>
                            ) : null}
                          </>
                        ) : (
                          <> — zaznacz co najmniej jeden parametr.</>
                        )}
                      </p>
                    </section>

                    <div className={styles.weightedIndexResults}>
                      {!weightedIndexCanCompute ? (
                        <p className={styles.emptyInline}>
                          {activeWeightedMetrics.length === 0
                            ? "Zaznacz parametry i ustaw procenty, aby obliczyć indeks."
                            : weightedIndexOverBudget
                              ? `Suma procentów przekracza ${WEIGHTED_INDEX_PERCENT_BUDGET} — zmniejsz wartości w wybranych KPI.`
                              : "Przydziel co najmniej 1 % do zaznaczonego KPI."}
                        </p>
                      ) : (
                        <>
                          <div className={styles.weightedIndexMetricLegend} aria-label="Legenda składowych indeksu">
                              <span className={styles.weightedIndexMetricLegendTitle}>Składowe wagi na wykresie</span>
                              <ul className={styles.weightedIndexMetricLegendList}>
                                {weightedIndexMetricChartSeries.map((series) => (
                                  <li key={series.metricId} className={styles.weightedIndexMetricLegendItem}>
                                    <span
                                      className={styles.weightedIndexMetricLegendSwatch}
                                      style={{ backgroundColor: series.color }}
                                      aria-hidden
                                    />
                                    <span className={styles.weightedIndexMetricLegendLabel}>{series.label}</span>
                                    <span className={styles.weightedIndexMetricLegendWeight}>
                                      {formatWeightedMetricPercent(series.weight)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                          </div>

                          <div className={styles.chartWrapper}>
                            <ResponsiveContainer width="100%" height={weightedIndexChartHeight}>
                                  <BarChart
                                    data={weightedIndexStackedBarData}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                    <XAxis
                                      type="number"
                                      domain={[0, 100]}
                                      tick={{ fill: "#64748b", fontSize: 12 }}
                                    />
                                    <YAxis
                                      dataKey="name"
                                      type="category"
                                      width={120}
                                      tick={{ fill: "#475569", fontSize: 12 }}
                                    />
                                    <Tooltip
                                      content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const total = payload.reduce(
                                          (sum, item) => sum + Number(item.value ?? 0),
                                          0,
                                        );
                                        const chartRow = payload[0]?.payload as WeightedIndexChartRow | undefined;
                                        return (
                                          <div className={styles.weightedIndexTooltip}>
                                            <strong>{label}</strong>
                                            <span>Indeks: {formatWeightedIndexValue(total)}</span>
                                            {payload
                                              .filter((item) => Number(item.value) > 0)
                                              .map((item) => {
                                                const metricId = String(item.dataKey) as PlayerComparisonMetricId;
                                                const evTotal = chartRow?.[`${metricId}__evTotal`];
                                                const evOk = chartRow?.[`${metricId}__evOk`];
                                                const eventStats =
                                                  typeof evTotal === "number" && evTotal > 0
                                                    ? {
                                                        total: evTotal,
                                                        successful: typeof evOk === "number" ? evOk : 0,
                                                      }
                                                    : null;
                                                const rawValue = chartRow
                                                  ? weightedIndexContributionByPlayerId
                                                      .get(String(chartRow.playerId))
                                                      ?.get(metricId)?.rawValue
                                                  : undefined;
                                                const rawLabel =
                                                  rawValue != null
                                                    ? formatWeightedIndexContributionRawValue(metricId, rawValue)
                                                    : null;
                                                const eventLabel = formatWeightedIndexEventBreakdown(metricId, eventStats);
                                                return (
                                                  <span key={String(item.dataKey)} style={{ color: item.color }}>
                                                    {getWeightedIndexMetricLabel(metricId)}:{" "}
                                                    {formatWeightedIndexValue(Number(item.value))}
                                                    {rawLabel ? ` · ${rawLabel}` : ""}
                                                    {eventLabel ? ` · ${eventLabel}` : ""}
                                                  </span>
                                                );
                                              })}
                                          </div>
                                        );
                                      }}
                                    />
                                    <Legend wrapperStyle={{ display: "none" }} />
                                    {weightedIndexMetricChartSeries.map((series) => (
                                      <Bar
                                        key={series.metricId}
                                        dataKey={series.metricId}
                                        name={series.label}
                                        stackId="weightedIndex"
                                        fill={series.color}
                                      >
                                        <LabelList
                                          dataKey={series.metricId}
                                          position="center"
                                          content={(labelProps) => {
                                            const { x, y, width, height, value, index } = labelProps;
                                            const contribution = Number(value ?? 0);
                                            if (
                                              contribution <= 0 ||
                                              width == null ||
                                              height == null ||
                                              x == null ||
                                              y == null ||
                                              index == null ||
                                              width < 52 ||
                                              height < 16
                                            ) {
                                              return null;
                                            }
                                            const chartRow = weightedIndexStackedBarData[index];
                                            if (!chartRow) return null;
                                            const evTotal = chartRow[`${series.metricId}__evTotal`];
                                            const evOk = chartRow[`${series.metricId}__evOk`];
                                            const eventStats =
                                              typeof evTotal === "number" && evTotal > 0
                                                ? {
                                                    total: evTotal,
                                                    successful: typeof evOk === "number" ? evOk : 0,
                                                  }
                                                : null;
                                            const eventLabel = formatWeightedIndexChartEventLabel(
                                              series.metricId,
                                              eventStats,
                                            );
                                            if (!eventLabel) return null;
                                            return (
                                              <text
                                                x={Number(x) + Number(width) / 2}
                                                y={Number(y) + Number(height) / 2}
                                                fill="#fff"
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize={10}
                                                fontWeight={600}
                                                pointerEvents="none"
                                              >
                                                {eventLabel}
                                              </text>
                                            );
                                          }}
                                        />
                                      </Bar>
                                    ))}
                                  </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className={styles.tableWrapper}>
                                <table className={styles.playersTable}>
                                  <caption className={styles.compareTableCaption}>
                                    Indeks z rozbiciem na kolorowe składowe (wkład = wynik w grupie × udział procentowy).
                                    Pod wkładem: wartość surowa KPI oraz liczba zdarzeń w zakresie dat (format X/Y tam,
                                    gdzie ma to sens, inaczej sama liczba).
                                  </caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">Zawodnik</th>
                                      <th scope="col">Indeks</th>
                                      {weightedIndexMetricChartSeries.map((series) => (
                                        <th key={series.metricId} scope="col">
                                          <span className={styles.weightedIndexTableMetricHead}>
                                            <span
                                              className={styles.weightedIndexMetricLegendSwatch}
                                              style={{ backgroundColor: series.color }}
                                              aria-hidden
                                            />
                                            <span>{series.label}</span>
                                          </span>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {weightedIndexRanking.map((entry) => {
                                      const contributionByMetric =
                                        weightedIndexContributionByPlayerId.get(entry.row.playerId) ??
                                        new Map<PlayerComparisonMetricId, PlayerComparisonWeightedMetricContribution>();
                                      return (
                                        <tr key={entry.row.playerId}>
                                          <td>
                                            <strong>{maskName(entry.row.playerName)}</strong>
                                          </td>
                                          <td>
                                            <strong>{formatWeightedIndexValue(entry.index)}</strong>
                                          </td>
                                          {weightedIndexMetricChartSeries.map((series) => (
                                            <td key={series.metricId}>
                                              <WeightedIndexMetricCell
                                                contribution={contributionByMetric.get(series.metricId)}
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  )
                ) : (
                  <p className={styles.emptyInline}>Brak zawodników z danymi KPI do porównania w tym zakresie.</p>
                )}
              </article>

              <details className={styles.playersTableDetails}>
                <summary className={styles.playersTableSummary}>Pełna tabela zawodników (opcjonalnie rozwiń)</summary>
                <p className={styles.playersTableHint}>
                  Kliknij nagłówek kolumny, by sortować. Drugie kliknięcie odwraca kolejność. Kolumna KPI odpowiada aktualnemu zestawowi w rankingu (
                  {selectedMetric.label}).
                </p>
                <div className={styles.tableWrapper}>
                  <table className={styles.playersTable}>
                    <thead>
                      <tr>
                        <th scope="col" aria-sort={fullTableSort.column === "playerName" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("playerName")}
                            aria-label="Sortuj według zawodnika"
                          >
                            Zawodnik
                            {fullTableSort.column === "playerName" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "birthYear" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("birthYear")}
                            aria-label="Sortuj według rocznika"
                          >
                            Rocznik
                            {fullTableSort.column === "birthYear" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "position" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("position")}
                            aria-label="Sortuj według pozycji"
                          >
                            Pozycja
                            {fullTableSort.column === "position" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "minutes" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("minutes")}
                            aria-label="Sortuj według minut"
                          >
                            Min
                            {fullTableSort.column === "minutes" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "matches" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("matches")}
                            aria-label="Sortuj według liczby meczów"
                          >
                            Mecze
                            {fullTableSort.column === "matches" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "kpi" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("kpi")}
                            aria-label={`Sortuj według ${selectedMetric.label}`}
                          >
                            {selectedMetric.shortLabel}
                            {fullTableSort.column === "kpi" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullTableSortedRows.map((row) => (
                        <tr key={row.playerId}>
                          <td>
                            <strong>{maskName(row.playerName)}</strong>
                            <span className={styles.playerMeta}>#{row.number || "—"}</span>
                          </td>
                          <td>{row.birthYear ?? "—"}</td>
                          <td>{row.position || "—"}</td>
                          <td>{Math.round(row.minutes)}</td>
                          <td>{row.matchesPlayed}</td>
                          <td>{formatMetricValue(activeMetricId, row.values[activeMetricId])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
      {sidePanel}
    </div>
  );
}
