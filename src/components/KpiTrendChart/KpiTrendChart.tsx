"use client";

import React, { useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKpiValue, TrendyKpiUnit } from "@/utils/trendyKpis";

type MetricType = "xg" | "shots" | "pk" | "p2p3" | "regains_pp" | "possession";

type KpiTrendChartProps = {
  metric?: MetricType;
  teamId: string;
  matches?: Array<Record<string, unknown>>;
  data?: ChartPoint[];
  target?: number;
  unit?: TrendyKpiUnit;
  targetLabel?: string;
  showTarget?: boolean;
  opponentTarget?: number;
  opponentTargetLabel?: string;
  hasKpiTarget?: boolean;
  direction?: "higher" | "lower";
};

type ChartPoint = {
  label: string;
  value?: number;
  team?: number;
  opponent?: number;
  teamGoals?: number;
  opponentGoals?: number;
  // PK: gole z wejść w pole karne (w kontekście ataku/obrony)
  teamPkGoals?: number;
  opponentPkGoals?: number;
};

const METRIC_CANDIDATES: Record<MetricType, string[]> = {
  xg: ["xg", "xG", "teamXG", "xgFor", "expectedGoals", "expectedGoalsFor"],
  shots: ["shots", "teamShots", "shotsFor", "totalShots"],
  pk: ["pkEntries", "penaltyAreaEntries", "boxEntries", "entriesToBox"],
  p2p3: ["p2p3", "passes2to3", "passesFromSecondToThird", "progressions2to3"],
  regains_pp: ["regains_pp", "regainsPerPossession", "regainsPerPossessionLost", "regainsPP"],
  possession: ["possession", "possessionPct", "possessionPercentage"],
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace("%", "").replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getMetricValue = (match: Record<string, unknown>, metric: MetricType): number => {
  const candidateKeys = METRIC_CANDIDATES[metric];
  for (const key of candidateKeys) {
    const raw = match[key];
    const parsed = toNumber(raw);
    if (parsed !== null) return parsed;
  }
  return 0;
};

const getMatchLabel = (match: Record<string, unknown>, index: number): string => {
  const opponent = typeof match.opponent === "string" ? match.opponent : `Mecz ${index + 1}`;
  const date = typeof match.date === "string" ? match.date : "";
  return date ? `${opponent} (${date})` : opponent;
};

export const KpiTrendChart: React.FC<KpiTrendChartProps> = ({
  metric,
  matches = [],
  data: externalData,
  target,
  unit = "number",
  targetLabel = "Cel KPI",
  showTarget = true,
  opponentTarget,
  opponentTargetLabel = "Cel PK przeciwnika",
  hasKpiTarget = true,
  direction = "higher",
}) => {
  const data = useMemo<ChartPoint[]>(() => {
    if (externalData && externalData.length > 0) return externalData;
    if (!metric) return [];

    const sorted = [...matches].sort((a, b) => {
      const aDate = new Date(String(a.date ?? 0)).getTime();
      const bDate = new Date(String(b.date ?? 0)).getTime();
      return aDate - bDate;
    });

    return sorted.map((match, index) => ({
      label: getMatchLabel(match, index),
      value: getMetricValue(match, metric),
    }));
  }, [externalData, matches, metric]);

  const chartData = useMemo(() => {
    const keys: Array<keyof ChartPoint> = ["value", "team", "opponent", "teamGoals", "opponentGoals"];

    const calculateLinearTrend = (values: Array<number | null>): Array<number | null> => {
      const points = values
        .map((value, idx) => ({ x: idx, y: value }))
        .filter((p): p is { x: number; y: number } => typeof p.y === "number" && Number.isFinite(p.y));

      if (points.length < 2) return values.map(() => null);

      const n = points.length;
      const sumX = points.reduce((sum, p) => sum + p.x, 0);
      const sumY = points.reduce((sum, p) => sum + p.y, 0);
      const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
      const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
      const denom = n * sumXX - sumX * sumX;
      if (denom === 0) return values.map(() => null);

      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;

      return values.map((_, idx) => intercept + slope * idx);
    };

    const trendByKey: Partial<Record<keyof ChartPoint, Array<number | null>>> = {};
    keys.forEach((key) => {
      const values = data.map((p) => (typeof p[key] === "number" && Number.isFinite(p[key] as number) ? (p[key] as number) : null));
      trendByKey[key] = calculateLinearTrend(values);
    });

    return data.map((point, idx) => ({
      ...point,
      valueTrend: trendByKey.value?.[idx] ?? null,
      teamTrend: trendByKey.team?.[idx] ?? null,
      opponentTrend: trendByKey.opponent?.[idx] ?? null,
      teamGoalsTrend: trendByKey.teamGoals?.[idx] ?? null,
      opponentGoalsTrend: trendByKey.opponentGoals?.[idx] ?? null,
    }));
  }, [data]);

  const hasGoals =
    metric === "xg" &&
    data[0] &&
    typeof (data[0] as any).teamGoals === "number" &&
    typeof (data[0] as any).opponentGoals === "number";

  const hasPkGoals =
    metric === "pk" &&
    data[0] &&
    typeof (data[0] as any).teamPkGoals === "number" &&
    typeof (data[0] as any).opponentPkGoals === "number";

  const [showTeamXg, setShowTeamXg] = useState(true);
  const [showOpponentXg, setShowOpponentXg] = useState(true);
  const [showTeamGoals, setShowTeamGoals] = useState(true);
  const [showOpponentGoals, setShowOpponentGoals] = useState(true);
  const [summaryMode, setSummaryMode] = useState<"avg" | "sum">("avg");


  if (data.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
        Brak danych trendu dla wybranych meczów.
      </div>
    );
  }

  const calcSum = (key: keyof ChartPoint): number | null => {
    const values = data
      .map((p) => (p as any)[key])
      .filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0);
  };

  const calcAvg = (key: keyof ChartPoint): number | null => {
    const values = data
      .map((p) => (p as any)[key])
      .filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  const sumTeamXg = calcSum("team");
  const sumOpponentXg = calcSum("opponent");
  const sumTeamGoals = calcSum("teamGoals");
  const sumOpponentGoals = calcSum("opponentGoals");
  const sumTeamPkGoals = calcSum("teamPkGoals");
  const sumOpponentPkGoals = calcSum("opponentPkGoals");

  const avgTeamXg = calcAvg("team");
  const avgOpponentXg = calcAvg("opponent");
  const avgTeamGoals = calcAvg("teamGoals");
  const avgOpponentGoals = calcAvg("opponentGoals");
  const avgTeamPkGoals = calcAvg("teamPkGoals");
  const avgOpponentPkGoals = calcAvg("opponentPkGoals");

  const displayTeamXg = summaryMode === "avg" ? avgTeamXg : sumTeamXg;
  const displayOpponentXg = summaryMode === "avg" ? avgOpponentXg : sumOpponentXg;
  const displayTeamGoals = summaryMode === "avg" ? avgTeamGoals : sumTeamGoals;
  const displayOpponentGoals = summaryMode === "avg" ? avgOpponentGoals : sumOpponentGoals;

  // Średnia "Wejścia w PK / Bramki" liczone per-mecz (pomijamy mecze z 0 bramek)
  const pkGoalsPerEntryAttackAvg = (() => {
    const ratios = data
      .map((p) => {
        const entries = typeof p.team === "number" ? p.team : null;
        const goals = typeof p.teamPkGoals === "number" ? p.teamPkGoals : null;
        if (entries == null || goals == null || goals <= 0) return null;
        return entries / goals;
      })
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!ratios.length) return null;
    return ratios.reduce((sum, v) => sum + v, 0) / ratios.length;
  })();

  const pkGoalsPerEntryDefenseAvg = (() => {
    const ratios = data
      .map((p) => {
        const entries = typeof p.opponent === "number" ? p.opponent : null;
        const goals = typeof p.opponentPkGoals === "number" ? p.opponentPkGoals : null;
        if (entries == null || goals == null || goals <= 0) return null;
        return entries / goals;
      })
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!ratios.length) return null;
    return ratios.reduce((sum, v) => sum + v, 0) / ratios.length;
  })();


  const defaultDot = { r: 4 };
  const defaultGoodDot = (
    props: any,
    meets: boolean | null,
  ) => {
    const fill = meets === null ? "#2563eb" : meets ? "#16a34a" : "#dc2626";
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
  };

  const opponentDot =
    metric === "pk" && typeof opponentTarget === "number" && Number.isFinite(opponentTarget)
      ? (props: any) => {
          const value = typeof props.value === "number" ? props.value : Number(props.value ?? 0);
          const isBelow = value <= opponentTarget;
          const fill = isBelow ? "#16a34a" : "#dc2626";
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
        }
      : defaultDot;

  return (
    <div style={{ width: "100%" }}>
      {hasGoals && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
            fontSize: 12,
            color: "#475569",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#f9fafb",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 12, color: "#475569" }}>Podsumowanie:</span>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="radio" name="summaryMode" checked={summaryMode === "avg"} onChange={() => setSummaryMode("avg")} />
              Średnia
            </label>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="radio" name="summaryMode" checked={summaryMode === "sum"} onChange={() => setSummaryMode("sum")} />
              Suma
            </label>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", paddingRight: 4 }}>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showTeamXg} onChange={(e) => setShowTeamXg(e.target.checked)} />
              xG naszego zespołu{displayTeamXg != null ? ` (${displayTeamXg.toFixed(2)})` : ""}
            </label>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showOpponentXg} onChange={(e) => setShowOpponentXg(e.target.checked)} />
              xG przeciwnika{displayOpponentXg != null ? ` (${displayOpponentXg.toFixed(2)})` : ""}
            </label>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showTeamGoals} onChange={(e) => setShowTeamGoals(e.target.checked)} />
              Gole naszego zespołu
              {displayTeamGoals != null
                ? ` (${summaryMode === "avg" ? displayTeamGoals.toFixed(2) : displayTeamGoals.toFixed(0)})`
                : ""}
            </label>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showOpponentGoals} onChange={(e) => setShowOpponentGoals(e.target.checked)} />
              Gole przeciwnika
              {displayOpponentGoals != null
                ? ` (${summaryMode === "avg" ? displayOpponentGoals.toFixed(2) : displayOpponentGoals.toFixed(0)})`
                : ""}
            </label>
          </div>
        </div>
      )}

      {hasPkGoals && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
            fontSize: 12,
            color: "#475569",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#f9fafb",
            }}
          >
            <span style={{ fontWeight: 700, color: "#475569" }}>Wejścia PK / gole (suma):</span>
            <span>
              Atak{" "}
              {sumTeamXg != null && typeof sumTeamXg === "number" ? sumTeamXg.toFixed(0) : "—"} /{" "}
              {sumTeamPkGoals != null && typeof sumTeamPkGoals === "number" ? sumTeamPkGoals.toFixed(0) : "—"}
            </span>
            <span>
              Obrona{" "}
              {sumOpponentXg != null && typeof sumOpponentXg === "number" ? sumOpponentXg.toFixed(0) : "—"} /{" "}
              {sumOpponentPkGoals != null && typeof sumOpponentPkGoals === "number" ? sumOpponentPkGoals.toFixed(0) : "—"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              paddingRight: 4,
            }}
          >
            <span style={{ fontWeight: 700, color: "#475569" }}>Wejścia w PK / bramki (średnia):</span>
            <span>
              Atak {pkGoalsPerEntryAttackAvg != null ? pkGoalsPerEntryAttackAvg.toFixed(2) : "—"} | Obrona{" "}
              {pkGoalsPerEntryDefenseAvg != null ? pkGoalsPerEntryDefenseAvg.toFixed(2) : "—"}
            </span>
          </div>
        </div>
      )}
      <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis width={32} />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => {
              const dataKey = props && typeof props.dataKey === "string" ? (props.dataKey as keyof ChartPoint) : "value";

              let labelBase = "Wartość";
              if (metric === "xg") {
                labelBase =
                  dataKey === "team"
                    ? "xG naszego zespołu"
                    : dataKey === "opponent"
                    ? "xG przeciwnika"
                    : dataKey === "teamGoals"
                    ? "Gole naszego zespołu"
                    : dataKey === "opponentGoals"
                    ? "Gole przeciwnika"
                    : "xG";
              } else if (metric === "shots") {
                labelBase =
                  dataKey === "team"
                    ? "Strzały naszego zespołu"
                    : dataKey === "opponent"
                    ? "Strzały przeciwnika"
                    : "Strzały";
              } else if (metric === "pk") {
                const payload = props?.payload ?? {};
                const entriesTeam = typeof payload.team === "number" ? payload.team : undefined;
                const entriesOpp = typeof payload.opponent === "number" ? payload.opponent : undefined;
                const goalsTeam = typeof payload.teamPkGoals === "number" ? payload.teamPkGoals : undefined;
                const goalsOpp = typeof payload.opponentPkGoals === "number" ? payload.opponentPkGoals : undefined;

                const ratio = (entries?: number, goals?: number): string | null => {
                  if (entries == null || goals == null || goals <= 0) return null;
                  return (entries / goals).toFixed(2);
                };

                if (dataKey === "team") {
                  const r = ratio(entriesTeam, goalsTeam);
                  labelBase = `PK/gol w meczu (atak): ${r != null ? r : "—"}`;
                } else if (dataKey === "opponent") {
                  const r = ratio(entriesOpp, goalsOpp);
                  labelBase = `PK/gol w meczu (obrona): ${r != null ? r : "—"}`;

                  if (typeof opponentTarget === "number" && Number.isFinite(opponentTarget)) {
                    if (value > opponentTarget) {
                      labelBase += " • Powyżej celu";
                    } else {
                      labelBase += " • Poniżej celu";
                    }
                  }
                } else if (dataKey === "teamPkGoals") {
                  labelBase = "Gole z wejść w PK naszego zespołu";
                  const r = ratio(entriesTeam, goalsTeam);
                  labelBase += r != null ? ` (PK/gol: ${r})` : " (PK/gol: —)";
                } else if (dataKey === "opponentPkGoals") {
                  labelBase = "Gole z wejść w PK przeciwnika";
                  const r = ratio(entriesOpp, goalsOpp);
                  labelBase += r != null ? ` (PK/gol: ${r})` : " (PK/gol: —)";
                } else {
                  labelBase = "Wejścia w PK";
                }
              }

              return [formatKpiValue(value, unit), labelBase];
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
          />
          {showTarget &&
            typeof target === "number" &&
            Number.isFinite(target) &&
            !(data[0] && typeof (data[0] as any).team === "number" && typeof (data[0] as any).opponent === "number") && (
              <ReferenceLine
                y={target}
                stroke="#16a34a"
                strokeDasharray="5 5"
                label={{ value: targetLabel, fill: "#166534", fontSize: 11 }}
              />
            )}
          {metric === "pk" &&
            typeof opponentTarget === "number" &&
            Number.isFinite(opponentTarget) && (
              <ReferenceLine
                y={opponentTarget}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: opponentTargetLabel, fill: "#7f1d1d", fontSize: 11 }}
              />
            )}
          {data[0] && typeof (data[0] as any).team === "number" && typeof (data[0] as any).opponent === "number" ? (
            typeof (data[0] as any).teamGoals === "number" && typeof (data[0] as any).opponentGoals === "number" ? (
              <>
                {showTeamXg && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="team"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={defaultDot}
                      activeDot={defaultDot}
                      name="xG naszego zespołu"
                    />
                    <Line
                      type="monotone"
                      dataKey="teamTrend"
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.75}
                      dot={false}
                      activeDot={false}
                      name="Trend xG naszego zespołu"
                    />
                  </>
                )}
                {showOpponentXg && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="opponent"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={opponentDot}
                      activeDot={opponentDot}
                      name="xG przeciwnika"
                    />
                    <Line
                      type="monotone"
                      dataKey="opponentTrend"
                      stroke="#dc2626"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.75}
                      dot={false}
                      activeDot={false}
                      name="Trend xG przeciwnika"
                    />
                  </>
                )}
                {showTeamGoals && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="teamGoals"
                      stroke="#93c5fd"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#93c5fd", stroke: "#ffffff", strokeWidth: 1 }}
                      activeDot={{ r: 3, fill: "#93c5fd", stroke: "#ffffff", strokeWidth: 1 }}
                      name="Gole naszego zespołu"
                    />
                    <Line
                      type="monotone"
                      dataKey="teamGoalsTrend"
                      stroke="#93c5fd"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.75}
                      dot={false}
                      activeDot={false}
                      name="Trend goli naszego zespołu"
                    />
                  </>
                )}
                {showOpponentGoals && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="opponentGoals"
                      stroke="#f87171"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f87171", stroke: "#ffffff", strokeWidth: 1 }}
                      activeDot={{ r: 3, fill: "#f87171", stroke: "#ffffff", strokeWidth: 1 }}
                      name="Gole przeciwnika"
                    />
                    <Line
                      type="monotone"
                      dataKey="opponentGoalsTrend"
                      stroke="#f87171"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.75}
                      dot={false}
                      activeDot={false}
                      name="Trend goli przeciwnika"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="team"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={defaultDot}
                  activeDot={defaultDot}
                  name={metric === "pk" ? "Wejścia w PK naszego zespołu" : "xG naszego zespołu"}
                />
                <Line
                  type="monotone"
                  dataKey="teamTrend"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.75}
                  dot={false}
                  activeDot={false}
                  name={metric === "pk" ? "Trend wejść w PK (nasz zespół)" : "Trend xG naszego zespołu"}
                />
                <Line
                  type="monotone"
                  dataKey="opponent"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={opponentDot}
                  activeDot={opponentDot}
                  name={metric === "pk" ? "Wejścia w PK przeciwnika" : "xG przeciwnika"}
                />
                <Line
                  type="monotone"
                  dataKey="opponentTrend"
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.75}
                  dot={false}
                  activeDot={false}
                  name={metric === "pk" ? "Trend wejść w PK (przeciwnik)" : "Trend xG przeciwnika"}
                />
              </>
            )
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={(props: any) => {
                  if (!hasKpiTarget || typeof target !== "number" || !Number.isFinite(target)) {
                    return defaultGoodDot(props, null);
                  }
                  const value = typeof props.value === "number" ? props.value : Number(props.value ?? 0);
                  const meets =
                    unit === "percent" || unit === "number" || unit === "ratio" || unit === "seconds"
                      ? direction === "higher"
                        ? value >= target
                        : value <= target
                      : null;
                  return defaultGoodDot(props, meets);
                }}
                activeDot={(props: any) => {
                  if (!hasKpiTarget || typeof target !== "number" || !Number.isFinite(target)) {
                    return defaultGoodDot(props, null);
                  }
                  const value = typeof props.value === "number" ? props.value : Number(props.value ?? 0);
                  const meets =
                    unit === "percent" || unit === "number" || unit === "ratio" || unit === "seconds"
                      ? direction === "higher"
                        ? value >= target
                        : value <= target
                      : null;
                  return defaultGoodDot(props, meets);
                }}
              />
              <Line
                type="monotone"
                dataKey="valueTrend"
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.75}
                dot={false}
                activeDot={false}
                name="Linia trendu"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KpiTrendChart;
