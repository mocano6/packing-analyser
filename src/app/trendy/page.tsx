"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTeams } from "@/hooks/useTeams";
import { usePlayersState } from "@/hooks/usePlayersState";
import SidePanel from "@/components/SidePanel/SidePanel";
import { collection, getDocs, query, where } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import KpiTrendChart from "@/components/KpiTrendChart/KpiTrendChart";
import PossessionTrendChart, { PossessionTrendPoint } from "@/components/PossessionTrendChart/PossessionTrendChart";
import P2P3TrendChart, { P2P3TrendPoint } from "@/components/P2P3TrendChart/P2P3TrendChart";
import { loadTrendyKpiDefinitions } from "@/lib/trendyKpiStore";
import { filterTeamsByUserAccess } from "@/lib/teamsForUserAccess";
import {
  calculateTrendyKpiValue,
  DEFAULT_TRENDY_KPI_DEFINITIONS,
  formatKpiValue,
  getDeadTimeMinutes,
  getDeadTimePct,
  getOpponentPossessionMinutes,
  getOpponentPossessionPct,
  getTeamPossessionMinutes,
  getTeamPossessionPct,
  getOpponentXGForMatch,
  getTeamGoalsForMatch,
  getOpponentGoalsForMatch,
  TrendyKpiDefinition,
  TrendyKpiUnit,
  pearsonCorrelation,
  getTeamP2CountForMatch,
  getTeamP3CountForMatch,
} from "@/utils/trendyKpis";
import { getTrendyKpiPlayerContributions } from "@/utils/trendyKpiPlayerContributions";
import { getPlayerFullName } from "@/utils/playerUtils";
import { TeamInfo } from "@/types";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveRadar } from "@nivo/radar";
import styles from "./trendy.module.css";

type MatchTypesEnabled = { liga: boolean; puchar: boolean; towarzyski: boolean };

const DEFAULT_MATCH_TYPES: MatchTypesEnabled = { liga: true, puchar: true, towarzyski: true };

function formatTrendyPlayerContributionCell(kpiId: string, value: number, unit: TrendyKpiUnit): string {
  if (!Number.isFinite(value)) return "—";
  const asInt = new Set([
    "shots_for",
    "pk_for",
    "pxt_p2p3",
    "regains_opp_half",
    "loses_pm_area",
    "pk_opponent",
    "regains_pp_8s_ca_pct",
    "counterpress_5s_pct",
  ]);
  if (asInt.has(kpiId)) return String(Math.round(value));
  if (kpiId === "xg_per_shot") return value.toFixed(3);
  if (kpiId === "pxt" || kpiId === "xg_for") return value.toFixed(2);
  if (kpiId === "acc8s_pct") return value.toFixed(2);
  return formatKpiValue(value, unit);
}

export default function TrendyPage() {
  const { teams } = useTeams();
  const { players } = usePlayersState();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, userRole, linkedPlayerId, logout } = useAuth();
  const { isPresentationMode } = usePresentationMode();

  const [selectedTeam, setSelectedTeam] = useState("");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const today = new Date();
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [matchTypesEnabled, setMatchTypesEnabled] = useState<MatchTypesEnabled>(DEFAULT_MATCH_TYPES);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [matches, setMatches] = useState<TeamInfo[]>([]);
  const [kpiDefinitions, setKpiDefinitions] = useState<TrendyKpiDefinition[]>(DEFAULT_TRENDY_KPI_DEFINITIONS);
  const [expandedKpis, setExpandedKpis] = useState<Record<string, boolean>>({});
  const [kpiPlayersModal, setKpiPlayersModal] = useState<{ kpiId: string; label: string; unit: TrendyKpiUnit } | null>(
    null,
  );

  const resolveTrendyPlayerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      map.set(p.id, getPlayerFullName(p));
    }
    return (playerId: string) => map.get(playerId) || playerId || "—";
  }, [players]);

  const kpiPlayersModalData = useMemo(() => {
    if (!kpiPlayersModal || matches.length === 0) return null;
    return getTrendyKpiPlayerContributions(matches, kpiPlayersModal.kpiId, resolveTrendyPlayerName);
  }, [kpiPlayersModal, matches, resolveTrendyPlayerName]);

  useEffect(() => {
    if (!kpiPlayersModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKpiPlayersModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kpiPlayersModal]);

  // Zapamiętywanie ostatnich wyborów filtrów (podręczna pamięć w localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("trendy_filters_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        selectedTeam?: string;
        dateFrom?: string;
        matchTypesEnabled?: MatchTypesEnabled;
      };
      if (parsed.selectedTeam) setSelectedTeam(parsed.selectedTeam);
      if (parsed.dateFrom) setDateFrom(parsed.dateFrom);
      if (parsed.matchTypesEnabled) setMatchTypesEnabled(parsed.matchTypesEnabled);
    } catch {
      // ignore broken storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({
      selectedTeam,
      dateFrom,
      matchTypesEnabled,
    });
    try {
      window.localStorage.setItem("trendy_filters_v1", payload);
    } catch {
      // ignore quota issues
    }
  }, [selectedTeam, dateFrom, matchTypesEnabled]);

  const availableTeams = useMemo(
    () =>
      filterTeamsByUserAccess(teams, {
        isAdmin,
        allowedTeamIds: userTeams ?? [],
      }),
    [teams, isAdmin, userTeams]
  );

  useEffect(() => {
    if (!selectedTeam && availableTeams.length > 0) {
      setSelectedTeam(availableTeams[0].id);
    }
  }, [availableTeams, selectedTeam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const defs = await loadTrendyKpiDefinitions();
        if (!cancelled) setKpiDefinitions(defs);
      } catch {
        if (!cancelled) setKpiDefinitions(DEFAULT_TRENDY_KPI_DEFINITIONS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clampDateRange = (from: string, to: string): { from: string; to: string } => {
    const toDate = new Date(to || new Date().toISOString().split("T")[0]);
    const minFromDate = new Date(toDate);
    minFromDate.setMonth(minFromDate.getMonth() - 3);

    const fromDate = new Date(from || minFromDate.toISOString().split("T")[0]);
    const clampedFrom = fromDate < minFromDate ? minFromDate : fromDate;

    return {
      from: clampedFrom.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
    };
  };

  const handleAnalyze = async () => {
    if (!selectedTeam) return;

    const clamped = clampDateRange(dateFrom, dateTo);
    if (clamped.from !== dateFrom) setDateFrom(clamped.from);
    if (clamped.to !== dateTo) setDateTo(clamped.to);

    setIsLoading(true);
    setLoadError(null);
    setMatches([]);

    try {
      const q = query(collection(getDB(), "matches"), where("team", "==", selectedTeam));
      const snapshot = await getDocs(q);
      const allTeamMatches = snapshot.docs.map((doc) => ({ ...(doc.data() as TeamInfo), matchId: doc.id } as TeamInfo));

      const filtered = allTeamMatches
        .filter((match) => {
          if (clamped.from && match.date < clamped.from) return false;
          if (clamped.to && match.date > clamped.to) return false;
          const mt = (match.matchType || "liga") as keyof MatchTypesEnabled;
          return Boolean(matchTypesEnabled[mt]);
        })
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

      setMatches(filtered);
    } catch (error) {
      setLoadError("Nie udało się pobrać danych trendów.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMatchLabel = (match: TeamInfo, idx: number) =>
    isPresentationMode ? `Mecz ${idx + 1}` : `${match.opponent || "Mecz"} (${match.date || idx + 1})`;

  const kpiRows = useMemo(() => {
    const pkOpponentDef = kpiDefinitions.find((kpi) => kpi.id === "pk_opponent");

    const activeKpis = kpiDefinitions
      .filter((kpi) => kpi.active && kpi.id !== "dead_time_pct" && kpi.id !== "pk_opponent")
      .sort((a, b) => {
        // xG zawsze na samej górze
        if (a.id === "xg_for") return -1;
        if (b.id === "xg_for") return 1;
        return a.order - b.order;
      });

    return activeKpis.map((kpi) => {
      if (kpi.id === "xg_for") {
        const data = matches.map((match, idx) => {
          const label = getMatchLabel(match, idx);
          const team = calculateTrendyKpiValue(match, "xg_for");
          const opponent = getOpponentXGForMatch(match);
          const teamGoals = getTeamGoalsForMatch(match);
          const opponentGoals = getOpponentGoalsForMatch(match);
          return { label, team, opponent, teamGoals, opponentGoals };
        });
        const latestTeamValue = data.length > 0 ? data[data.length - 1].team : 0;
        const delta = latestTeamValue - kpi.target;
        const meetsTarget = kpi.direction === "higher" ? latestTeamValue >= kpi.target : latestTeamValue <= kpi.target;
        return { kpi, data, latestValue: latestTeamValue, delta, meetsTarget, kind: "xg" as const };
      }

      if (kpi.id === "shots_for") {
        const data = matches.map((match, idx) => {
          const label = getMatchLabel(match, idx);
          const teamShots = (match.shots ?? []).filter((shot) => shot.teamContext === "attack").length;
          const opponentShots = (match.shots ?? []).filter((shot) => shot.teamContext === "defense").length;
          return { label, team: teamShots, opponent: opponentShots };
        });
        const latestTeamValue = data.length > 0 ? data[data.length - 1].team ?? 0 : 0;
        const delta = latestTeamValue - kpi.target;
        const meetsTarget = kpi.direction === "higher" ? latestTeamValue >= kpi.target : latestTeamValue <= kpi.target;
        return { kpi, data, latestValue: latestTeamValue, delta, meetsTarget, kind: "shots" as const };
      }

      if (kpi.id === "pk_for") {
        const data = matches.map((match, idx) => {
          const label = getMatchLabel(match, idx);
          const allPk = match.pkEntries ?? [];
          const teamPk = allPk.filter((entry) => (entry.teamContext ?? "attack") === "attack").length;
          const opponentPk = allPk.filter((entry) => (entry.teamContext ?? "attack") === "defense").length;
          const teamPkGoals = allPk.filter(
            (entry) => (entry.teamContext ?? "attack") === "attack" && entry.isGoal === true,
          ).length;
          const opponentPkGoals = allPk.filter(
            (entry) => (entry.teamContext ?? "attack") === "defense" && entry.isGoal === true,
          ).length;

          return { label, team: teamPk, opponent: opponentPk, teamPkGoals, opponentPkGoals };
        });
        const latestTeamValue = data.length > 0 ? data[data.length - 1].team ?? 0 : 0;
        const delta = latestTeamValue - kpi.target;
        const meetsTarget = kpi.direction === "higher" ? latestTeamValue >= kpi.target : latestTeamValue <= kpi.target;
        const pkOpponentTarget = pkOpponentDef?.target;
        const completedCount =
          typeof pkOpponentTarget === "number"
            ? data.filter(
                (point) =>
                  typeof point.team === "number" &&
                  typeof point.opponent === "number" &&
                  point.team >= kpi.target &&
                  point.opponent <= pkOpponentTarget
              ).length
            : data.filter((point) => typeof point.team === "number" && point.team >= kpi.target).length;
        const totalCount = data.length;
        const completedPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        const realizedPoints =
          typeof pkOpponentTarget === "number"
            ? data.filter(
                (point) =>
                  typeof point.team === "number" &&
                  typeof point.opponent === "number" &&
                  point.team >= kpi.target &&
                  point.opponent <= pkOpponentTarget,
              )
            : data.filter((point) => typeof point.team === "number" && point.team >= kpi.target);

        const avgExecutionPct =
          realizedPoints.length > 0
            ? realizedPoints.reduce((sum, point) => {
                const v = typeof point.team === "number" ? point.team : 0;
                const pct = (v / kpi.target) * 100;
                return sum + Math.min(100, pct);
              }, 0) / realizedPoints.length
            : undefined;
        return {
          kpi,
          data,
          latestValue: latestTeamValue,
          delta,
          meetsTarget,
          kind: "pk" as const,
          pkOpponentTarget,
          completedCount,
          completedPct,
          avgExecutionPct,
        };
      }
      if (kpi.id === "possession_pct") {
        const data: PossessionTrendPoint[] = matches.map((match, idx) => {
          const label = getMatchLabel(match, idx);
          const team = getTeamPossessionPct(match);
          const dead = getDeadTimePct(match);
          const opponent = getOpponentPossessionPct(match);
          const teamMin = getTeamPossessionMinutes(match);
          const oppMin = getOpponentPossessionMinutes(match);
          const deadMin = getDeadTimeMinutes(match);
          return {
            label,
            team,
            opponent,
            dead,
            teamMinutes: teamMin > 0 ? teamMin : undefined,
            opponentMinutes: oppMin > 0 ? oppMin : undefined,
            deadMinutes: deadMin > 0 ? deadMin : undefined,
          };
        });
        const latestTeamValue = data.length > 0 ? data[data.length - 1].team : 0;
        const delta = latestTeamValue - kpi.target;
        const meetsTarget = kpi.direction === "higher" ? latestTeamValue >= kpi.target : latestTeamValue <= kpi.target;
        return { kpi, data, latestValue: latestTeamValue, delta, meetsTarget, kind: "possession" as const };
      }

      if (kpi.id === "pxt_p2p3") {
        const data: P2P3TrendPoint[] = matches.map((match, idx) => {
          const label = getMatchLabel(match, idx);
          const p2 = getTeamP2CountForMatch(match);
          const p3 = getTeamP3CountForMatch(match);
          return { label, p2, p3 };
        });
        const latest = data.length > 0 ? data[data.length - 1] : { p2: 0, p3: 0, label: "" };
        const latestValue = latest.p2 + latest.p3;
        const delta = latestValue - kpi.target;
        const meetsTarget = kpi.direction === "higher" ? latestValue >= kpi.target : latestValue <= kpi.target;
        return { kpi, data, latestValue, delta, meetsTarget, kind: "p2p3" as const };
      }

      const data = matches.map((match, idx) => ({
        label: getMatchLabel(match, idx),
        value: calculateTrendyKpiValue(match, kpi.id),
      }));
      const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
      const delta = latestValue - kpi.target;
      const meetsTarget = kpi.direction === "higher" ? latestValue >= kpi.target : latestValue <= kpi.target;

      let completedCount: number | undefined;
      let completedPct: number | undefined;
      let avgExecutionPct: number | undefined;
      if (
        kpi.id === "regains_opp_half" ||
        kpi.id === "loses_pm_area" ||
        kpi.id === "acc8s_pct" ||
        kpi.id === "regains_pp_8s_ca_pct" ||
        kpi.id === "xg_per_shot" ||
        kpi.id === "one_touch_pct" ||
        kpi.id === "counterpress_5s_pct"
      ) {
        const totalCount = data.length;
        completedCount =
          kpi.direction === "higher"
            ? data.filter((point) => typeof point.value === "number" && point.value >= kpi.target).length
            : data.filter((point) => typeof point.value === "number" && point.value <= kpi.target).length;
        completedPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        const realizedValues =
          kpi.direction === "higher"
            ? data
                .map((p) => p.value)
                .filter((v): v is number => typeof v === "number" && v >= kpi.target)
            : data
                .map((p) => p.value)
                .filter((v): v is number => typeof v === "number" && v <= kpi.target);

        avgExecutionPct =
          realizedValues.length > 0
            ? realizedValues.reduce((sum, v) => {
                const ratio = kpi.direction === "higher" ? v / kpi.target : kpi.target / v;
                return sum + Math.min(100, ratio * 100);
              }, 0) / realizedValues.length
            : undefined;
      }

      return { kpi, data, latestValue, delta, meetsTarget, kind: "single" as const, completedCount, completedPct, avgExecutionPct };
    });
  }, [kpiDefinitions, matches, isPresentationMode]);

  // KPI zrealizowane w danym meczu (model 8 KPI jak w statystyce/radar)
  const kpiCompletionIds = [
    "xg_per_shot",
    "one_touch_pct",
    "counterpress_5s_pct",
    "pk_opponent",
    "loses_pm_area",
    "regains_opp_half",
    "regains_pp_8s_ca_pct",
    "acc8s_pct",
  ] as const;

  const kpiCompletionTotal = kpiCompletionIds.length;

  const kpiCompletionPerMatch = useMemo(() => {
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const scoreHigherIsBetter = (actual: number, target: number): number => {
      if (target <= 0) return 0;
      return clamp((actual / target) * 100, 0, 200);
    };

    const scoreLowerIsBetter = (actual: number, target: number): number => {
      if (target <= 0) return 0;
      if (actual <= 0) return 200; // w statystyce: gdy actual = 0 i KPI jest "lower better"
      return clamp((target / actual) * 100, 0, 200);
    };

    return matches.map((match, idx) => {
      const label = isPresentationMode ? `Mecz ${idx + 1}` : `${match.opponent || "Mecz"} (${match.date || idx + 1})`;

      let metCount = 0;
      let scoreSum = 0;

      kpiCompletionIds.forEach((kpiId) => {
        const def = kpiDefinitions.find((k) => k.id === kpiId);
        if (!def) return;

        const value = calculateTrendyKpiValue(match, kpiId);
        const meets = def.direction === "higher" ? value >= def.target : value <= def.target;
        if (meets) metCount += 1;

        const score = def.direction === "higher" ? scoreHigherIsBetter(value, def.target) : scoreLowerIsBetter(value, def.target);
        scoreSum += score;
      });

      const metPct = kpiCompletionTotal > 0 ? (metCount / kpiCompletionTotal) * 100 : 0;
      const avgExecutionPct = kpiCompletionTotal > 0 ? scoreSum / kpiCompletionTotal : 0;

      return { label, metCount, metPct, avgExecutionPct };
    });
  }, [matches, kpiDefinitions, isPresentationMode]);

  const latestKpiCompletion =
    kpiCompletionPerMatch.length > 0 ? kpiCompletionPerMatch[kpiCompletionPerMatch.length - 1] : null;

  // Dane do wykresu łączonego xG · PK · PxT (tylko nasz zespół)
  const xgPkPxtChartData = useMemo(() => {
    return matches.map((match, idx) => {
      const label = isPresentationMode ? `Mecz ${idx + 1}` : `${match.opponent || "Mecz"} (${match.date || idx + 1})`;
      const xg = calculateTrendyKpiValue(match, "xg_for");
      const pk = calculateTrendyKpiValue(match, "pk_for");
      const pxt = calculateTrendyKpiValue(match, "pxt");
      const teamGoals = getTeamGoalsForMatch(match);
      const opponentGoals = getOpponentGoalsForMatch(match);
      const resultType: "win" | "draw" | "loss" =
        teamGoals > opponentGoals ? "win" : teamGoals === opponentGoals ? "draw" : "loss";
      return { label, xg, pk, pxt, teamGoals, opponentGoals, resultType };
    });
  }, [matches, isPresentationMode]);

  // Korelacja Pearsona między xG, PK, PxT
  const xgPkPxtCorrelation = useMemo(() => {
    const data = xgPkPxtChartData;
    if (data.length < 3) return null;

    const xg = data.map((d) => d.xg);
    const pk = data.map((d) => d.pk);
    const pxt = data.map((d) => d.pxt);

    const xgPk = pearsonCorrelation(xg, pk, 3);
    const xgPxt = pearsonCorrelation(xg, pxt, 3);
    const pkPxt = pearsonCorrelation(pk, pxt, 3);

    return { xgPk, xgPxt, pkPxt };
  }, [xgPkPxtChartData]);

  const kpiCompletionChartData = useMemo(() => {
    const points = kpiCompletionPerMatch
      .map((p, idx) => ({ x: idx, y: p.metCount }))
      .filter((p) => Number.isFinite(p.y));

    if (points.length < 2) {
      return kpiCompletionPerMatch.map((p) => ({ ...p, metCountTrend: null as number | null }));
    }

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) {
      return kpiCompletionPerMatch.map((p) => ({ ...p, metCountTrend: null as number | null }));
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return kpiCompletionPerMatch.map((p, idx) => ({
      ...p,
      metCountTrend: intercept + slope * idx,
    }));
  }, [kpiCompletionPerMatch]);

  // Radar ze średnim wykonaniem 8 oryginalnych KPI (jak w statystyki-zespolu)
  const radarData = useMemo(() => {
    if (matches.length === 0) return [];

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const scoreHigherIsBetter = (actual: number, target: number): number => {
      if (target <= 0) return 0;
      return clamp((actual / target) * 100, 0, 200);
    };
    const scoreLowerIsBetter = (actual: number, target: number): number => {
      if (target <= 0) return 0;
      if (actual <= 0) return 200;
      return clamp((target / actual) * 100, 0, 200);
    };

    const radarKpis: { id: string; metric: string; direction: "higher" | "lower"; unit: TrendyKpiUnit }[] = [
      { id: "xg_per_shot", metric: "xG/strzał", direction: "higher", unit: "ratio" },
      { id: "one_touch_pct", metric: "1T", direction: "higher", unit: "percent" },
      { id: "counterpress_5s_pct", metric: "5s", direction: "higher", unit: "percent" },
      { id: "pk_opponent", metric: "PK przeciwnik", direction: "lower", unit: "number" },
      { id: "loses_pm_area", metric: "PM Area straty", direction: "lower", unit: "number" },
      { id: "regains_opp_half", metric: "Przechwyty PP", direction: "higher", unit: "number" },
      { id: "regains_pp_8s_ca_pct", metric: "8s CA", direction: "higher", unit: "percent" },
      { id: "acc8s_pct", metric: "8s ACC", direction: "higher", unit: "percent" },
    ];

    return radarKpis.map(({ id, metric, direction, unit }, idx) => {
      const def = kpiDefinitions.find((k) => k.id === id);
      const target = def?.target ?? 0;
      const values = matches.map((m) => calculateTrendyKpiValue(m, id)).filter((v) => Number.isFinite(v));
      const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const score =
        direction === "higher"
          ? scoreHigherIsBetter(avgValue, target)
          : scoreLowerIsBetter(avgValue, target);

      return {
        metric,
        displayMetric: isPresentationMode ? `KPI ${idx + 1}` : metric,
        KPI: 100,
        Wartość: score,
        value: score,
        actualValue: avgValue,
        kpiLabel: def ? `KPI ${direction === "higher" ? "≥" : "≤"} ${formatKpiValue(target, unit)}` : "",
      };
    });
  }, [matches, kpiDefinitions, isPresentationMode]);

  if (authLoading) {
    return <div className={styles.centered}>Ładowanie...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.centered}>
        <h2>Brak dostępu</h2>
        <p>Musisz być zalogowany, aby zobaczyć trendy.</p>
        <Link href="/login" className={styles.primaryButton}>
          Przejdź do logowania
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.filtersPanel}>
        <div className={styles.filterItem}>
          <span>Zespół</span>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className={styles.select}>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {isPresentationMode ? "Zespół" : team.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <span>Data od</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={styles.input} />
        </div>
        <div className={styles.filterItem}>
          <span>Data do</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={styles.input} />
        </div>
        <div className={styles.matchTypes}>
          {(["liga", "puchar", "towarzyski"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMatchTypesEnabled((prev) => ({ ...prev, [type]: !prev[type] }))}
              className={`${styles.matchTypeButton} ${matchTypesEnabled[type] ? styles.active : ""}`}
            >
              {type}
            </button>
          ))}
        </div>
        <button type="button" onClick={handleAnalyze} className={styles.primaryButton} disabled={isLoading || !selectedTeam}>
          {isLoading ? "Pobieranie..." : "Analizuj trendy"}
        </button>
      </div>

      {loadError && <p className={styles.errorText}>{loadError}</p>}

      {matches.length > 0 && (
        <>
          {radarData.length > 0 && (
            <div className={styles.radarSection}>
              <div className={styles.radarCard}>
                <h4 className={styles.radarTitle}>Ocena modelu gry</h4>
                <p className={styles.radarSubtitle}>Średnie wykonanie 8 KPI w wybranym okresie</p>
                <div className={styles.radarLayout}>
                  <div className={styles.radarWrapper}>
                  <ResponsiveRadar
                    data={radarData}
                    keys={["KPI", "Wartość"]}
                    indexBy="displayMetric"
                    maxValue={200}
                    margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                    curve="linearClosed"
                    borderWidth={2}
                    borderColor={{ from: "color" }}
                    gridLevels={6}
                    gridShape="circular"
                    gridLabelOffset={12}
                    enableDots={true}
                    dotSize={6}
                    dotBorderWidth={2}
                    dotBorderColor={{ from: "color" }}
                    colors={["#34C759", "#6366f1"]}
                    fillOpacity={0.15}
                    blendMode="multiply"
                    motionConfig="wobbly"
                    sliceTooltip={({ index }) => {
                      const d =
                        typeof index === "string"
                          ? radarData.find((r) => r.displayMetric === index)
                          : radarData[typeof index === "number" ? index : 0];
                      if (!d) return null;
                      const isPercentage =
                        d.metric === "1T" ||
                        d.metric === "5s" ||
                        d.metric === "8s CA" ||
                        d.metric === "8s ACC";
                      const valueFormatted = isPercentage
                        ? `${parseFloat(Number(d.actualValue).toFixed(1))}%`
                        : typeof d.actualValue === "number" && d.actualValue % 1 !== 0
                          ? d.actualValue.toFixed(2)
                          : String(d.actualValue);
                      const pctWykonania = Math.round(d.value);
                      const achieved = d.value >= 100;
                      const statusColor = achieved ? "#059669" : "#dc2626";
                      const statusLabel = achieved ? "KPI osiągnięte" : "KPI nieosiągnięte";
                      return (
                        <div
                          style={{
                            backgroundColor: "#1e293b",
                            border: `2px solid ${statusColor}`,
                            borderRadius: "12px",
                            padding: "16px 20px",
                            boxShadow:
                              "0 12px 32px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.2)",
                            fontFamily:
                              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
                            minWidth: "200px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              marginBottom: "8px",
                              fontSize: "18px",
                              fontWeight: 800,
                              color: "#ffffff",
                            }}
                          >
                            {valueFormatted}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              marginBottom: "8px",
                              fontSize: "13px",
                              color: "#94a3b8",
                              fontWeight: 500,
                            }}
                          >
                            {d.kpiLabel}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "10px",
                              paddingTop: "10px",
                              borderTop: "1px solid rgba(255,255,255,0.15)",
                            }}
                          >
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: statusColor,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            />
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: statusColor,
                              }}
                            >
                              {pctWykonania}% — {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                    theme={{
                      grid: { line: { stroke: "rgba(0, 0, 0, 0.08)", strokeWidth: 1 } },
                      dots: { text: { fontSize: 11 } },
                      axis: {
                        ticks: {
                          text: {
                            fontSize: 12,
                            fill: "rgba(0, 0, 0, 0.65)",
                            fontFamily:
                              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
                            fontWeight: 500,
                          },
                        },
                      },
                    }}
                  />
                </div>
                <div className={styles.radarRightPanel}>
                  <div className={styles.matchResultsList}>
                    <div className={styles.matchResultsHeader}>
                      <span className={styles.matchCountBadge}>
                        <span className={styles.matchCountNumber}>{matches.length}</span>
                        <span className={styles.matchCountLabel}>
                          {matches.length === 1 ? "mecz" : matches.length < 5 ? "mecze" : "meczów"}
                        </span>
                      </span>
                      <span className={styles.matchResultsTitle}>Wyniki meczów</span>
                      <span className={styles.matchResultsKpiHint}>
                        KPI (X/{kpiCompletionTotal})
                      </span>
                    </div>
                    <div className={styles.matchResultsTable}>
                      <div className={styles.matchResultHeaderRow}>
                        <span className={styles.matchResultColDate}>Data</span>
                        <span className={styles.matchResultColOpponent}>Przeciwnik</span>
                        <span className={styles.matchResultColScore}>Wynik</span>
                        <span className={styles.matchResultColKpi}>KPI</span>
                      </div>
                      {matches.map((match, idx) => {
                        const teamGoals = getTeamGoalsForMatch(match);
                        const opponentGoals = getOpponentGoalsForMatch(match);
                        const kpiCompletion = kpiCompletionPerMatch[idx];
                        const kpiPct = kpiCompletion?.metPct ?? 0;
                        const kpiGood = kpiPct >= 50;
                        const dateStr =
                          match.date && typeof match.date === "string"
                            ? match.date.includes("T")
                              ? match.date.slice(0, 10)
                              : match.date
                            : "";
                        const dateLabel = dateStr
                          ? (() => {
                              const d = new Date(dateStr);
                              return Number.isNaN(d.getTime())
                                ? dateStr
                                : d.toLocaleDateString("pl-PL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  });
                            })()
                          : `Mecz ${idx + 1}`;
                        const isWin = teamGoals > opponentGoals;
                        const isDraw = teamGoals === opponentGoals;
                        const isLoss = teamGoals < opponentGoals;
                        const resultClass = isWin
                          ? styles.matchResultRowWin
                          : isDraw
                            ? styles.matchResultRowDraw
                            : styles.matchResultRowLoss;
                        return (
                          <div
                            key={match.matchId ?? idx}
                            className={`${styles.matchResultRow} ${resultClass}`}
                          >
                            <span className={styles.matchResultColDate}>{dateLabel}</span>
                            <span className={styles.matchResultColOpponent}>
                              {isPresentationMode ? "Przeciwnik" : (match.opponent || "Przeciwnik")}
                            </span>
                            <span className={styles.matchResultColScore}>
                              {teamGoals} : {opponentGoals}
                            </span>
                            <span
                              className={`${styles.matchResultKpiBadge} ${
                                kpiGood ? styles.matchResultKpiGood : styles.matchResultKpiBad
                              }`}
                              title={`${kpiCompletion?.metCount ?? 0}/${kpiCompletionTotal} KPI zrealizowanych`}
                            >
                              {kpiCompletion?.metCount ?? 0}/{kpiCompletionTotal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.kpiList}>
          {kpiRows.map(({ kpi, data, latestValue, delta, meetsTarget, kind, pkOpponentTarget, completedCount, completedPct }) => {
            const isOpen = expandedKpis[kpi.id] ?? false;
            return (
              <div key={kpi.id} className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <button
                    type="button"
                    className={styles.kpiHeaderToggle}
                    onClick={() => setExpandedKpis((prev) => ({ ...prev, [kpi.id]: !isOpen }))}
                  >
                    <span className={styles.kpiTitle}>{kpi.label}</span>
                    {kpi.id === "pk_for" && typeof completedCount === "number" ? (
                      <span className={`${styles.kpiMeta} ${meetsTarget ? styles.good : styles.bad}`}>
                        {formatKpiValue(latestValue, kpi.unit)} ({delta >= 0 ? "+" : ""}
                        {formatKpiValue(delta, kpi.unit)}) — KPI w zakresie w {completedCount}/{data.length} meczach (
                        {completedPct.toFixed(0)}%)
                      </span>
                    ) : (kpi.id === "regains_opp_half" ||
                        kpi.id === "loses_pm_area" ||
                        kpi.id === "acc8s_pct" ||
                        kpi.id === "regains_pp_8s_ca_pct" ||
                        kpi.id === "xg_per_shot" ||
                        kpi.id === "one_touch_pct" ||
                        kpi.id === "counterpress_5s_pct") &&
                      typeof completedCount === "number" &&
                      typeof completedPct === "number" ? (
                      <span className={`${styles.kpiMeta} ${meetsTarget ? styles.good : styles.bad}`}>
                        {formatKpiValue(latestValue, kpi.unit)} ({delta >= 0 ? "+" : ""}
                        {formatKpiValue(delta, kpi.unit)}) — KPI w zakresie w {completedCount}/{data.length} meczach (
                        {completedPct.toFixed(0)}%)
                      </span>
                    ) : (
                      <span className={`${styles.kpiMeta} ${meetsTarget ? styles.good : styles.bad}`}>
                        {formatKpiValue(latestValue, kpi.unit)} ({delta >= 0 ? "+" : ""}
                        {formatKpiValue(delta, kpi.unit)})
                      </span>
                    )}
                  </button>
                  {matches.length > 0 &&
                    !["possession_pct", "dead_time_pct", "acc8s_pct"].includes(kpi.id) && (
                    <button
                      type="button"
                      className={styles.kpiPlayersIconButton}
                      title={`Wkład zawodników: ${kpi.label}`}
                      aria-label={`Pokaż wkład zawodników — ${kpi.label}`}
                      onClick={() => setKpiPlayersModal({ kpiId: kpi.id, label: kpi.label, unit: kpi.unit })}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className={styles.kpiBody}>
                    {kpi.id === "possession_pct" && kind === "possession" ? (
                      <PossessionTrendChart data={data as PossessionTrendPoint[]} unit={kpi.unit} />
                    ) : kpi.id === "pxt_p2p3" && kind === "p2p3" ? (
                      <P2P3TrendChart data={data as P2P3TrendPoint[]} />
                    ) : kpi.id === "xg_for" && kind === "xg" ? (
                      <KpiTrendChart
                        metric="xg"
                        teamId={selectedTeam}
                        data={data as any}
                        unit={kpi.unit}
                      />
                    ) : kpi.id === "shots_for" && kind === "shots" ? (
                      <KpiTrendChart
                        metric="shots"
                        teamId={selectedTeam}
                        data={data as any}
                        unit={kpi.unit}
                      />
                    ) : kpi.id === "pk_for" && kind === "pk" ? (
                      <KpiTrendChart
                        metric="pk"
                        teamId={selectedTeam}
                        data={data as any}
                        unit={kpi.unit}
                        opponentTarget={pkOpponentTarget}
                        opponentTargetLabel={
                          pkOpponentTarget != null
                            ? `Cel PK przeciwnika: ${formatKpiValue(pkOpponentTarget, "number")}`
                            : "Cel PK przeciwnika"
                        }
                      />
                    ) : (
                      <KpiTrendChart
                        teamId={selectedTeam}
                        data={data as any}
                        target={kpi.target}
                        hasKpiTarget={
                          kpi.id === "pk_for" ||
                          kpi.id === "regains_opp_half" ||
                          kpi.id === "loses_pm_area" ||
                          kpi.id === "acc8s_pct" ||
                          kpi.id === "regains_pp_8s_ca_pct" ||
                          kpi.id === "xg_per_shot" ||
                          kpi.id === "one_touch_pct" ||
                          kpi.id === "counterpress_5s_pct"
                        }
                        direction={kpi.direction}
                        unit={kpi.unit}
                        targetLabel={`Cel: ${formatKpiValue(kpi.target, kpi.unit)}`}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {matches.length > 0 && latestKpiCompletion && (
            <div key="kpi_zrealizowane" className={styles.kpiCard}>
              <button
                type="button"
                className={styles.kpiHeader}
                onClick={() =>
                  setExpandedKpis((prev) => ({ ...prev, kpi_zrealizowane: !prev.kpi_zrealizowane }))
                }
              >
                <span className={styles.kpiTitle}>KPI zrealizowane</span>
                <span className={styles.kpiMeta}>
                  {latestKpiCompletion.metPct.toFixed(1)}% ({latestKpiCompletion.metCount} / {kpiCompletionTotal} KPI) · śr. wykonanie:{" "}
                  {latestKpiCompletion.avgExecutionPct.toFixed(0)}%
                </span>
              </button>
              {(expandedKpis.kpi_zrealizowane ?? false) && (
                <div className={styles.kpiBody}>
                  <div style={{ width: "100%", height: 160 }}>
                    <ResponsiveContainer>
                      <LineChart data={kpiCompletionChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <XAxis dataKey="label" hide />
                        <YAxis domain={[0, kpiCompletionTotal]} allowDecimals={false} />
                        <ReferenceLine
                          y={kpiCompletionTotal / 2}
                          stroke="#16a34a"
                          strokeDasharray="5 5"
                          label={{ value: "Cel KPI: 50%", position: "insideTopRight", fill: "#166534", fontSize: 11 }}
                        />
                        <Tooltip
                          content={(props: any) => {
                            if (!props?.active || !props?.payload?.length) return null;
                            const p = props.payload[0].payload;
                            return (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: "8px 10px",
                                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{p.label}</div>
                                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                                  KPI zrealizowane {p.metPct.toFixed(1)}% ({p.metCount} / {kpiCompletionTotal} KPI) · śr. wykonanie:{" "}
                                  {p.avgExecutionPct.toFixed(0)}%
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="metCount"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const metCount = typeof props?.payload?.metCount === "number" ? props.payload.metCount : null;
                            const meets = metCount != null ? metCount >= kpiCompletionTotal / 2 : null;
                            const fill = meets ? "#16a34a" : "#dc2626";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={6}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1}
                              />
                            );
                          }}
                          activeDot={(props: any) => {
                            const metCount = typeof props?.payload?.metCount === "number" ? props.payload.metCount : null;
                            const meets = metCount != null ? metCount >= kpiCompletionTotal / 2 : null;
                            const fill = meets ? "#16a34a" : "#dc2626";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={7}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1}
                              />
                            );
                          }}
                          name="KPI zrealizowane"
                        />
                        <Line
                          type="monotone"
                          dataKey="metCountTrend"
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          strokeOpacity={0.75}
                          dot={false}
                          activeDot={false}
                          name="Trend KPI zrealizowane"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {matches.length > 0 && xgPkPxtChartData.length > 0 && (
            <div key="kpi_xg_pk_pxt" className={styles.kpiCard}>
              <button
                type="button"
                className={styles.kpiHeader}
                onClick={() =>
                  setExpandedKpis((prev) => ({ ...prev, kpi_xg_pk_pxt: !prev.kpi_xg_pk_pxt }))
                }
              >
                <span className={styles.kpiTitle}>xG · PK · PxT</span>
                <span className={styles.kpiMeta}>
                  {xgPkPxtCorrelation ? (
                    <>
                      xG↔PK: {xgPkPxtCorrelation.xgPk != null ? xgPkPxtCorrelation.xgPk.toFixed(2) : "—"} · xG↔PxT:{" "}
                      {xgPkPxtCorrelation.xgPxt != null ? xgPkPxtCorrelation.xgPxt.toFixed(2) : "—"} · PK↔PxT:{" "}
                      {xgPkPxtCorrelation.pkPxt != null ? xgPkPxtCorrelation.pkPxt.toFixed(2) : "—"}
                    </>
                  ) : (
                    "xG, wejścia w PK i PxT zespołu w meczach"
                  )}
                </span>
              </button>
              {(expandedKpis.kpi_xg_pk_pxt ?? false) && (
                <div className={styles.kpiBody}>
                  <div className={styles.correlationBlock}>
                    <h5 className={styles.correlationTitle}>Korelacja i zależności</h5>
                    <p className={styles.correlationText}>
                      <strong>xG</strong> (expected goals) mierzy jakość zagrożeń. <strong>PK</strong> (wejścia w pole karne) pokazuje
                      częstotliwość wchodzenia w strefę niebezpieczną. <strong>PxT</strong> (Packing xT) to wartość progresji piłki
                      między liniami. Więcej wejść w PK zwykle generuje więcej xG i większy PxT — gdy zespół skutecznie
                      wchodzi w strefę i tworzy zagrożenia, rośnie zarówno xG, jak i wartość progresji.
                    </p>
                    <p className={styles.correlationFormula}>
                      <strong>Obliczenie korelacji Pearsona:</strong> r = (n·Σxy − Σx·Σy) / √[(n·Σx² − (Σx)²)(n·Σy² − (Σy)²)].
                      Dla każdej pary metryk (np. xG i PK) bierzemy wartości z wszystkich meczów: x₁,x₂,…,xₙ oraz y₁,y₂,…,yₙ.
                      Współczynnik r ∈ [−1, 1]: r &gt; 0 oznacza, że gdy jedna metryka rośnie, druga też ma tendencję do wzrostu;
                      r &lt; 0 — odwrotnie; r ≈ 0 — brak liniowej zależności.
                    </p>
                    {xgPkPxtCorrelation && (
                      <div className={styles.correlationValues}>
                        <span>
                          xG↔PK: {xgPkPxtCorrelation.xgPk != null ? xgPkPxtCorrelation.xgPk.toFixed(2) : "—"} —{" "}
                          {xgPkPxtCorrelation.xgPk != null && xgPkPxtCorrelation.xgPk > 0.5
                            ? "silna zależność: więcej wejść w PK → więcej xG"
                            : xgPkPxtCorrelation.xgPk != null && xgPkPxtCorrelation.xgPk > 0
                              ? "słaba zależność"
                              : xgPkPxtCorrelation.xgPk != null && xgPkPxtCorrelation.xgPk < 0
                                ? "ujemna: mniej wejść → więcej xG (np. skuteczne finisze z dystansu)"
                                : "—"}
                        </span>
                        <span>
                          xG↔PxT: {xgPkPxtCorrelation.xgPxt != null ? xgPkPxtCorrelation.xgPxt.toFixed(2) : "—"} —{" "}
                          {xgPkPxtCorrelation.xgPxt != null && xgPkPxtCorrelation.xgPxt > 0.5
                            ? "silna zależność: więcej progresji → więcej xG"
                            : xgPkPxtCorrelation.xgPxt != null && xgPkPxtCorrelation.xgPxt > 0
                              ? "słaba zależność"
                              : xgPkPxtCorrelation.xgPxt != null && xgPkPxtCorrelation.xgPxt < 0
                                ? "ujemna: mniej progresji → więcej xG"
                                : "—"}
                        </span>
                        <span>
                          PK↔PxT: {xgPkPxtCorrelation.pkPxt != null ? xgPkPxtCorrelation.pkPxt.toFixed(2) : "—"} —{" "}
                          {xgPkPxtCorrelation.pkPxt != null && xgPkPxtCorrelation.pkPxt > 0.5
                            ? "silna zależność: wejścia w PK wynikają z progresji"
                            : xgPkPxtCorrelation.pkPxt != null && xgPkPxtCorrelation.pkPxt > 0
                              ? "słaba zależność"
                              : xgPkPxtCorrelation.pkPxt != null && xgPkPxtCorrelation.pkPxt < 0
                                ? "ujemna"
                                : "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer>
                      <LineChart
                        data={xgPkPxtChartData}
                        margin={{ top: 8, right: 40, bottom: 0, left: 0 }}
                      >
                        <XAxis dataKey="label" hide />
                        <YAxis yAxisId="left" width={36} />
                        <YAxis yAxisId="right" orientation="right" width={36} />
                        <Tooltip
                          content={(props: any) => {
                            if (!props?.active || !props?.payload?.length) return null;
                            const p = props.payload[0]?.payload;
                            const resultLabel =
                              p?.resultType === "win"
                                ? "Wygrana"
                                : p?.resultType === "draw"
                                  ? "Remis"
                                  : p?.resultType === "loss"
                                    ? "Przegrana"
                                    : "";
                            const resultColor =
                              p?.resultType === "win" ? "#16a34a" : p?.resultType === "draw" ? "#ca8a04" : "#dc2626";
                            const score =
                              p?.teamGoals != null && p?.opponentGoals != null
                                ? ` ${p.teamGoals}:${p.opponentGoals}`
                                : "";
                            return (
                              <div
                                style={{
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  padding: "10px 14px",
                                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                }}
                              >
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                                  {p?.label}
                                </div>
                                <div style={{ fontSize: 12, color: resultColor, fontWeight: 600, marginBottom: 6 }}>
                                  {resultLabel}
                                  {score}
                                </div>
                                <div style={{ fontSize: 12, color: "#475569" }}>
                                  xG: {typeof p?.xg === "number" ? p.xg.toFixed(2) : "—"} · PK:{" "}
                                  {typeof p?.pk === "number" ? p.pk : "—"} · PxT:{" "}
                                  {typeof p?.pxt === "number" ? p.pxt.toFixed(2) : "—"}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="xg"
                          yAxisId="left"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#2563eb";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={5}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          activeDot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#2563eb";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={6}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          name="xG"
                        />
                        <Line
                          type="monotone"
                          dataKey="pxt"
                          yAxisId="left"
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#16a34a";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={5}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          activeDot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#16a34a";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={6}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          name="PxT"
                        />
                        <Line
                          type="monotone"
                          dataKey="pk"
                          yAxisId="right"
                          stroke="#9333ea"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#9333ea";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={5}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          activeDot={(props: any) => {
                            const r = props?.payload?.resultType;
                            const fill =
                              r === "win" ? "#16a34a" : r === "draw" ? "#ca8a04" : r === "loss" ? "#dc2626" : "#9333ea";
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={6}
                                fill={fill}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                              />
                            );
                          }}
                          name="PK"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className={styles.chartLegend}>
                    <span className={styles.chartLegendItem}>
                      <span className={styles.chartLegendDot} style={{ background: "#16a34a" }} />
                      Wygrana
                    </span>
                    <span className={styles.chartLegendItem}>
                      <span className={styles.chartLegendDot} style={{ background: "#ca8a04" }} />
                      Remis
                    </span>
                    <span className={styles.chartLegendItem}>
                      <span className={styles.chartLegendDot} style={{ background: "#dc2626" }} />
                      Przegrana
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {kpiPlayersModal && (
        <div
          className={styles.playersModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trendy-kpi-players-modal-title"
          onClick={() => setKpiPlayersModal(null)}
        >
          <div
            className={`${styles.playersModal} ${kpiPlayersModalData?.kind === "table" && kpiPlayersModalData.pxtColumns ? styles.playersModalWide : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.playersModalHeader}>
              <h2 id="trendy-kpi-players-modal-title" className={styles.playersModalTitle}>
                Wkład zawodników — {kpiPlayersModal.label}
                <span style={{ display: "block", fontWeight: 500, fontSize: 13, color: "#64748b", marginTop: 6 }}>
                  Zakres: {matches.length} meczów (po filtrach)
                </span>
              </h2>
              <button
                type="button"
                className={styles.playersModalClose}
                aria-label="Zamknij"
                onClick={() => setKpiPlayersModal(null)}
              >
                ×
              </button>
            </div>
            <div className={styles.playersModalBody}>
              {!kpiPlayersModalData ? (
                <p className={styles.playersModalInfo}>Brak danych.</p>
              ) : kpiPlayersModalData.kind === "info" ? (
                <p className={styles.playersModalInfo}>{kpiPlayersModalData.message}</p>
              ) : kpiPlayersModalData.rows.length === 0 ? (
                <p className={styles.playersModalInfo}>Brak wierszy do wyświetlenia.</p>
              ) : (
                <>
                  <table className={styles.playersModalTable}>
                    <thead>
                      <tr>
                        <th scope="col">Zawodnik</th>
                        <th scope="col" className={styles.playersModalNum}>
                          {kpiPlayersModalData.valueHeader}
                        </th>
                        {kpiPlayersModalData.pxtColumns ? (
                          <>
                            <th scope="col" className={styles.playersModalNum}>
                              {kpiPlayersModalData.pxtColumns.xtHeader}
                            </th>
                            <th scope="col" className={styles.playersModalNum}>
                              {kpiPlayersModalData.pxtColumns.packingHeader}
                            </th>
                          </>
                        ) : null}
                        <th scope="col" className={styles.playersModalNum}>
                          % udziału
                        </th>
                        {kpiPlayersModalData.extraHeader ? (
                          <th scope="col">{kpiPlayersModalData.extraHeader}</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {kpiPlayersModalData.rows.map((row) => (
                        <tr key={row.playerId}>
                          <td>{row.playerName}</td>
                          <td className={styles.playersModalNum}>
                            {formatTrendyPlayerContributionCell(kpiPlayersModal.kpiId, row.value, kpiPlayersModal.unit)}
                          </td>
                          {kpiPlayersModalData.pxtColumns ? (
                            <>
                              <td className={styles.playersModalNum}>
                                {row.xtDeltaSum != null && Number.isFinite(row.xtDeltaSum)
                                  ? row.xtDeltaSum.toFixed(3)
                                  : "—"}
                              </td>
                              <td className={styles.playersModalNum}>
                                {row.packingPointsSum != null && Number.isFinite(row.packingPointsSum)
                                  ? row.packingPointsSum.toFixed(2)
                                  : "—"}
                              </td>
                            </>
                          ) : null}
                          <td className={styles.playersModalNum}>{row.sharePct.toFixed(1)}%</td>
                          {kpiPlayersModalData.extraHeader ? <td>{row.extra ?? "—"}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {kpiPlayersModalData.footnote ? (
                    <p className={styles.playersModalFootnote}>{kpiPlayersModalData.footnote}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <SidePanel
        players={players}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin}
        userRole={userRole}
        linkedPlayerId={linkedPlayerId}
        selectedTeam={selectedTeam}
        onRefreshData={async () => {}}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
    </div>
  );
}
