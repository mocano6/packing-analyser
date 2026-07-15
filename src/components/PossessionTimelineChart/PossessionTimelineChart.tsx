"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PossessionSegment } from "@/types";
import {
  buildCumulativePossessionChartData,
  buildPossession5MinChartData,
  buildPossessionTimeline,
  getPeriodMinuteRange,
  type PossessionHalfFilter,
  type PossessionMatchTiming,
  type PossessionTimeline,
} from "@/utils/possessionTimelineChart";
import styles from "./PossessionTimelineChart.module.css";

const TEAM_BLUE = "#2563eb";
const TEAM_RED = "#dc2626";
const DEAD_GRAY = "#94a3b8";

type Props = {
  segments: PossessionSegment[];
  period: PossessionHalfFilter;
  teamName: string;
  opponentName: string;
  firstHalfStartTime?: number;
  secondHalfStartTime?: number;
};

function shortTeamLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const totalSeconds = Math.round(sec);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function xAxisTicks(start: number, end: number): number[] {
  const ticks: number[] = [];
  const firstTick = Math.ceil(start / 15) * 15;
  if (start < firstTick) ticks.push(start);
  for (let minute = firstTick; minute <= end; minute += 15) {
    ticks.push(minute);
  }
  if (ticks.length === 0 || ticks[ticks.length - 1] !== end) {
    ticks.push(end);
  }
  return ticks;
}

export default function PossessionTimelineChart({
  segments,
  period,
  teamName,
  opponentName,
  firstHalfStartTime,
  secondHalfStartTime,
}: Props) {
  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const timing = useMemo<PossessionMatchTiming>(
    () => ({ firstHalfStartTime, secondHalfStartTime }),
    [firstHalfStartTime, secondHalfStartTime],
  );

  const timeline = useMemo<PossessionTimeline>(
    () => buildPossessionTimeline(segments, timing),
    [segments, timing],
  );
  const { start: periodStart, end: periodEnd } = getPeriodMinuteRange(period, timeline);
  const axisTicks = xAxisTicks(periodStart, periodEnd);
  const showHalfDivider =
    period === "total" && timeline.hasFirstHalf && timeline.hasSecondHalf && timeline.boundaryMin > 0;
  const periodEndLabel = Math.round(periodEnd);
  const periodStartLabel = Math.round(periodStart);

  const cumulativeData = useMemo(
    () => buildCumulativePossessionChartData(segments, period, timing),
    [segments, period, timing],
  );

  const momentumData = useMemo(
    () =>
      buildPossession5MinChartData(segments, period, timing).map((row) => ({
        ...row,
        teamMin: row.teamSec / 60,
        opponentMin: row.opponentSec / 60,
        deadMin: row.deadSec / 60,
      })),
    [segments, period, timing],
  );

  const hasCumulative = cumulativeData.some(
    (point) => point.teamSec > 0 || point.opponentSec > 0 || point.deadSec > 0,
  );
  const hasMomentum = momentumData.some(
    (row) => row.teamSec > 0 || row.opponentSec > 0 || row.deadSec > 0,
  );

  if (!hasCumulative && !hasMomentum) {
    return (
      <p className={styles.emptyMessage} onClick={(e) => e.stopPropagation()}>
        Brak segmentów posiadania dla tego meczu. Zapisz akcje posiadania w analizatorze, aby zobaczyć wykres w czasie.
      </p>
    );
  }

  return (
    <div className={styles.wrap} aria-label="Wykres posiadania w czasie meczu" onClick={(e) => e.stopPropagation()}>
      {hasCumulative ? (
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>Posiadanie w czasie meczu</h4>
          <p className={styles.chartSubtitle}>
            Skumulowany udział czasu: {teamShort}, {oppShort} i czas martwy ({periodStartLabel}–{periodEndLabel} min)
          </p>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={cumulativeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
              <XAxis
                type="number"
                dataKey="minute"
                domain={[periodStart, periodEnd]}
                ticks={axisTicks}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(value: number) => `${Math.round(value)}'`}
                axisLine={false}
                tickLine={false}
                allowDataOverflow
              />
              {showHalfDivider ? (
                <ReferenceLine
                  x={timeline.boundaryMin}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{ value: "2. połowa", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }}
                />
              ) : null}
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(value: number) => `${value}%`}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as (typeof cumulativeData)[number];
                  return (
                    <div className={styles.tooltip}>
                      <div className={styles.tooltipLabel}>{point.label}</div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: TEAM_BLUE }} />
                        {teamShort}: {formatPct(point.teamPct)} ({formatDurationSec(point.teamSec)})
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: TEAM_RED }} />
                        {oppShort}: {formatPct(point.opponentPct)} ({formatDurationSec(point.opponentSec)})
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: DEAD_GRAY }} />
                        Czas martwy: {formatPct(point.deadPct)} ({formatDurationSec(point.deadSec)})
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="stepAfter"
                dataKey="teamPct"
                stroke={TEAM_BLUE}
                strokeWidth={2.5}
                dot={false}
                name={teamShort}
              />
              <Line
                type="stepAfter"
                dataKey="opponentPct"
                stroke={TEAM_RED}
                strokeWidth={2.5}
                dot={false}
                name={oppShort}
              />
              <Line
                type="stepAfter"
                dataKey="deadPct"
                stroke={DEAD_GRAY}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                name="Czas martwy"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: TEAM_BLUE }} />
              {teamShort}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: TEAM_RED }} />
              {oppShort}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: DEAD_GRAY }} />
              Czas martwy
            </span>
          </div>
        </div>
      ) : null}

      {hasMomentum ? (
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>Posiadanie co 5 minut</h4>
          <p className={styles.chartSubtitle}>
            Pełny zakres {periodStartLabel}–{periodEndLabel} min · niebieski = {teamShort} · czerwony = {oppShort} · szary = czas martwy
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={momentumData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="minuteValue"
                type="number"
                domain={[periodStart, periodEnd]}
                ticks={axisTicks}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(value: number) => `${Math.round(value)}'`}
                axisLine={false}
                tickLine={false}
                allowDataOverflow
              />
              <YAxis
                domain={[0, 5]}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(value: number) => `${value} min`}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <RechartsTooltip
                cursor={{ fill: "rgba(148,163,184,0.10)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as (typeof momentumData)[number];
                  return (
                    <div className={styles.tooltip}>
                      <div className={styles.tooltipLabel}>{row.minute}</div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: TEAM_BLUE }} />
                        {teamShort}: {formatPct(row.teamPct)} ({formatDurationSec(row.teamSec)})
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: TEAM_RED }} />
                        {oppShort}: {formatPct(row.oppPct)} ({formatDurationSec(row.opponentSec)})
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDot} style={{ background: DEAD_GRAY }} />
                        Czas martwy: {formatPct(row.deadPct)} ({formatDurationSec(row.deadSec)})
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                formatter={(value: string) => (value === "deadMin" ? "Czas martwy" : value === "teamMin" ? teamShort : oppShort)}
              />
              {showHalfDivider ? (
                <ReferenceLine
                  x={timeline.boundaryMin}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{ value: "2. połowa", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }}
                />
              ) : null}
              <Bar dataKey="teamMin" stackId="interval" fill={TEAM_BLUE} name="teamMin" />
              <Bar dataKey="opponentMin" stackId="interval" fill={TEAM_RED} name="opponentMin" />
              <Bar dataKey="deadMin" stackId="interval" fill={DEAD_GRAY} name="deadMin" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
