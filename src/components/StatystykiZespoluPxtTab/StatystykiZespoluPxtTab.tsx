'use client';

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MatchVideoFloatingPanel from '@/components/MatchVideoFloatingPanel/MatchVideoFloatingPanel';
import { renderChartMatchEventMarkers } from '@/components/ChartMatchEventMarkers/ChartMatchEventMarkers';
import PlayerHeatmapPitch from '@/components/PlayerHeatmapPitch/PlayerHeatmapPitch';
import PxtAttackChannelOverlay from '@/components/PxtAttackChannelOverlay/PxtAttackChannelOverlay';
import { getVideoTimestampSeconds } from '@/utils/actionVideoSeekSeconds';
import { hasExternalVideoSource } from '@/utils/externalVideoMatchInfo';
import type { Action, PKEntry, Player, Shot, TeamInfo } from '@/types';
import { getPlayerLabel } from '@/utils/playerUtils';
import { buildPxtAttackChannelStats } from '@/utils/statystykiZespoluPxtAttackChannels';
import { buildPxtComparisonMetrics, type PxtComparisonMetric } from '@/utils/statystykiZespoluPxtComparison';
import {
  DEFAULT_PXT_PACKING_FILTERS,
  filterPackingActionsForTab,
  type PxtPackingFilterKey,
  type PxtPackingFilterState,
} from '@/utils/statystykiZespoluPxtFilters';
import {
  buildCumulativePxtChartData,
  buildPlayerPxtRows,
  buildPxt5MinChartData,
  buildPxtContactBreakdown,
  buildPxtFilterCounts,
  buildPxtHeatmapData,
  buildPxtOutcomeBreakdown,
  buildPxtTypeBreakdown,
  buildPxtZoneRoleActionGroups,
  buildTeamAndOpponentPxtStats,
  getPackingMetrics,
  filterPackingByHalf,
  getOpponentPackingActions,
  getTeamPackingActions,
  resolveOpponentTeamId,
  type PxtBreakdownRow,
  type PxtHalfFilter,
  type PxtPlayerRow,
  type PxtRoleFilter,
  type PxtTeamSideStats,
} from '@/utils/statystykiZespoluPxtStats';
import {
  buildChartMatchEvents,
  buildCumulativeMarkerPoints,
  buildIntervalMarkerPoints,
} from '@/utils/statystykiZespoluChartEvents';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from '../StatystykiZespoluXgTab/StatystykiZespoluXgTab.module.css';

const TEAM_BLUE = '#2563eb';
const TEAM_RED = '#dc2626';

type PxtMetricKind = 'pxt' | 'xt' | 'packing';
type PxtView = 'overview' | 'players' | 'distributions' | 'map';
type PlayerSortCol = 'playerName' | 'pxtSharePct' | 'pxt' | 'xt' | 'packing' | 'passes' | 'dribbles' | 'p2Count' | 'p3Count';

function fmt2(value: number): string {
  return Number(value).toFixed(2);
}

function fmt3(value: number): string {
  return Number(value).toFixed(3);
}

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt2(value)}`;
}

function shortTeamLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

function metricFromStats(stats: PxtTeamSideStats, metric: PxtMetricKind): number {
  if (metric === 'pxt') return stats.pxt;
  if (metric === 'xt') return stats.xt;
  return stats.packing;
}

function formatMetric(value: number, metric: PxtMetricKind): string {
  if (metric === 'packing') return String(Math.round(value));
  if (metric === 'xt') return fmt3(value);
  return fmt2(value);
}

function metricLabel(metric: PxtMetricKind): string {
  if (metric === 'pxt') return 'PxT';
  if (metric === 'xt') return 'ΔxT';
  return 'Packing';
}

type Props = {
  allActions: Action[];
  allShots?: Shot[];
  allPkEntries?: PKEntry[];
  matchInfo: TeamInfo;
  selectedTeam: string;
  teamName: string;
  opponentName: string;
  players: Player[];
  playersIndex: ReturnType<typeof import('@/utils/playerUtils').buildPlayersIndex>;
  availableTeams?: Array<{ id: string; name: string; logo?: string }>;
};

type ToggleButtonVariant = 'segment' | 'metric';

function toggleButtonClass(variant: ToggleButtonVariant, active: boolean): string {
  const base = variant === 'segment' ? pageStyles.xgHalfButton : pageStyles.metricButton;
  return `${base} ${active ? pageStyles.active : ''}`.trim();
}

function ToggleFilterButton({
  active,
  onClick,
  children,
  title,
  variant = 'segment',
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  variant?: ToggleButtonVariant;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={toggleButtonClass(variant, active)}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ChartTooltip({ rows, label }: { rows: Array<{ color: string; label: string; value: string }>; label?: string }) {
  return (
    <div className={styles.tooltip}>
      {label ? <p className={styles.tooltipLabel}>{label}</p> : null}
      {rows.map((r, i) => (
        <p key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: r.color }} />
          <span className={styles.tooltipName}>{r.label}</span>
          <strong>{r.value}</strong>
        </p>
      ))}
    </div>
  );
}

function CombinedPxtDistributionCard({
  title,
  subtitle,
  rows,
  teamName,
  opponentName,
  metric,
}: {
  title: string;
  subtitle?: string;
  rows: PxtBreakdownRow[];
  teamName: string;
  opponentName: string;
  metric: PxtMetricKind;
}) {
  if (rows.length === 0) return null;
  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const chartRows = rows.map((r) => ({
    name: r.label,
    teamValue: r.teamValue,
    oppValue: r.oppValue,
    teamCount: r.teamCount,
    oppCount: r.oppCount,
  }));

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {subtitle ? <p className={styles.chartSubtitle}>{subtitle}</p> : null}
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={chartRows} margin={{ top: 6, right: 6, left: -10, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(148,163,184,0.10)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as (typeof chartRows)[0];
              return (
                <ChartTooltip
                  label={d.name}
                  rows={[
                    { color: TEAM_BLUE, label: teamShort, value: `${formatMetric(d.teamValue, metric)} · ${d.teamCount} akc.` },
                    { color: TEAM_RED, label: oppShort, value: `${formatMetric(d.oppValue, metric)} · ${d.oppCount} akc.` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="teamValue" name={teamShort} fill={TEAM_BLUE} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="oppValue" name={oppShort} fill={TEAM_RED} radius={[4, 4, 0, 0]} maxBarSize={26} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
      <div className={styles.miniLegend}>
        <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_BLUE }} />{teamShort}</span>
        <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_RED }} />{oppShort}</span>
      </div>
    </div>
  );
}

const START_FILTERS: { key: PxtPackingFilterKey; label: string }[] = [
  { key: 'p0start', label: 'P0 start' },
  { key: 'p1start', label: 'P1 start' },
  { key: 'p2start', label: 'P2 start' },
  { key: 'p3start', label: 'P3 start' },
];

const END_FILTERS: { key: PxtPackingFilterKey; label: string }[] = [
  { key: 'p0', label: 'P0' },
  { key: 'p1', label: 'P1' },
  { key: 'p2', label: 'P2' },
  { key: 'p3', label: 'P3' },
];

const RESULT_FILTERS: { key: PxtPackingFilterKey; label: string }[] = [
  { key: 'pk', label: 'PK' },
  { key: 'shot', label: 'Strzał' },
  { key: 'goal', label: 'Gol' },
];

function PxtMetricVisualization({
  metric,
  teamName,
  opponentName,
}: {
  metric: PxtComparisonMetric;
  teamName: string;
  opponentName: string;
}) {
  const total = metric.teamValue + metric.oppValue;
  const teamSharePct = total > 0 ? (metric.teamValue / total) * 100 : 0;
  const pieData = total > 0
    ? [
        { name: teamName, value: metric.teamValue, fill: TEAM_BLUE },
        { name: opponentName, value: metric.oppValue, fill: TEAM_RED },
      ]
    : [];

  return (
    <div className={styles.metricVizCard}>
      <h4 className={styles.metricVizTitle}>{metric.label}</h4>
      {metric.hint ? <p className={styles.metricVizHint}>{metric.hint}</p> : null}
      {total > 0 ? (
        <>
          <div className={styles.donutWrap}>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCenter} aria-hidden="true">
              <span className={styles.donutCenterPct}>{Math.round(teamSharePct)}%</span>
              <span className={styles.donutCenterLabel}>{shortTeamLabel(teamName)}</span>
            </div>
          </div>
          <p className={styles.metricVizFooter}>
            {shortTeamLabel(teamName)} {metric.teamDisplay} · {shortTeamLabel(opponentName)} {metric.oppDisplay}
          </p>
        </>
      ) : (
        <p className={styles.donutEmptyText}>Brak danych dla tego wskaźnika.</p>
      )}
    </div>
  );
}

export default function StatystykiZespoluPxtTab({
  allActions,
  allShots = [],
  allPkEntries = [],
  matchInfo,
  selectedTeam,
  teamName,
  opponentName,
  playersIndex,
  availableTeams,
}: Props) {
  const [half, setHalf] = useState<PxtHalfFilter>('all');
  const [metric, setMetric] = useState<PxtMetricKind>('pxt');
  const [filters, setFilters] = useState<PxtPackingFilterState>(DEFAULT_PXT_PACKING_FILTERS);
  const [view, setView] = useState<PxtView>('overview');
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState('total_pxt');
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({ column: 'pxt', dir: 'desc' });
  const [role, setRole] = useState<PxtRoleFilter>('sender');
  const [heatmapDirection, setHeatmapDirection] = useState<'from' | 'to'>('from');
  const [heatmapMode, setHeatmapMode] = useState<'pxt' | 'count'>('pxt');
  const [showAttackChannels, setShowAttackChannels] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hasVideoPanel, setHasVideoPanel] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [videoSeekTargetSeconds, setVideoSeekTargetSeconds] = useState<number | null>(null);
  const [videoSeekRequestId, setVideoSeekRequestId] = useState(0);

  const opponentId = resolveOpponentTeamId(matchInfo, selectedTeam);

  const teamRaw = useMemo(
    () => filterPackingActionsForTab(filterPackingByHalf(getTeamPackingActions(allActions, selectedTeam), half), filters),
    [allActions, selectedTeam, half, filters],
  );
  const oppRaw = useMemo(
    () => filterPackingActionsForTab(filterPackingByHalf(getOpponentPackingActions(allActions, selectedTeam, opponentId), half), filters),
    [allActions, selectedTeam, opponentId, half, filters],
  );

  const { team: teamStats, opponent: opponentStats } = useMemo(
    () => buildTeamAndOpponentPxtStats(allActions, matchInfo, selectedTeam, half, filters),
    [allActions, matchInfo, selectedTeam, half, filters],
  );

  const filterCounts = useMemo(() => buildPxtFilterCounts(teamRaw), [teamRaw]);

  const playerRows = useMemo(
    () => buildPlayerPxtRows(teamRaw, teamStats.pxt, (id) => getPlayerLabel(id, playersIndex)),
    [teamRaw, teamStats.pxt, playersIndex],
  );
  const opponentPlayerRows = useMemo(
    () => buildPlayerPxtRows(oppRaw, opponentStats.pxt, (id) => getPlayerLabel(id, playersIndex)),
    [oppRaw, opponentStats.pxt, playersIndex],
  );

  const sortedPlayers = useMemo(() => {
    const col = playerSort.column;
    const dir = playerSort.dir;
    return [...playerRows].sort((a, b) => {
      if (col === 'playerName') {
        const cmp = a.playerName.localeCompare(b.playerName, 'pl');
        return dir === 'asc' ? cmp : -cmp;
      }
      const va = Number(a[col as keyof PxtPlayerRow]) || 0;
      const vb = Number(b[col as keyof PxtPlayerRow]) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [playerRows, playerSort]);

  const cumulativeData = useMemo(
    () => buildCumulativePxtChartData(allActions, selectedTeam, opponentId),
    [allActions, selectedTeam, opponentId],
  );

  const intervalData = useMemo(
    () => buildPxt5MinChartData(allActions, selectedTeam, opponentId),
    [allActions, selectedTeam, opponentId],
  );

  const momentumData = useMemo(() => {
    const key = metric === 'pxt' ? 'teamPxt' : metric === 'xt' ? 'teamXt' : 'teamPacking';
    const oppKey = metric === 'pxt' ? 'oppPxt' : metric === 'xt' ? 'oppXt' : 'oppPacking';
    const rows = intervalData.map((d) => ({
      minute: d.minute,
      teamVal: d[key as keyof typeof d] as number,
      oppValNeg: -((d[oppKey as keyof typeof d] as number) ?? 0),
      teamTotal: d.teamPxt,
      oppTotal: d.oppPxt,
    }));
    let start = 0;
    let end = rows.length - 1;
    while (start < rows.length && rows[start].teamVal === 0 && rows[start].oppValNeg === 0) start += 1;
    while (end > start && rows[end].teamVal === 0 && rows[end].oppValNeg === 0) end -= 1;
    return rows.slice(start, end + 1);
  }, [intervalData, metric]);

  const hasMomentum = momentumData.some((d) => d.teamVal > 0 || d.oppValNeg < 0);
  const chartEvents = useMemo(
    () => buildChartMatchEvents(allShots, allPkEntries, matchInfo, selectedTeam, half),
    [allShots, allPkEntries, matchInfo, selectedTeam, half],
  );
  const momentumMarkerPoints = useMemo(
    () => buildIntervalMarkerPoints(chartEvents, momentumData, {
      variant: 'signed',
      teamValueKey: 'teamVal',
      oppValueKey: 'oppValNeg',
      valueKeys: ['teamVal', 'oppValNeg'],
    }),
    [chartEvents, momentumData],
  );
  const cumulativeMarkerPoints = useMemo(
    () => buildCumulativeMarkerPoints(chartEvents, cumulativeData, {
      teamValueKey: 'teamPxt',
      opponentValueKey: 'oppPxt',
    }),
    [chartEvents, cumulativeData],
  );

  const typeGrouped = useMemo(() => buildPxtTypeBreakdown(teamRaw, oppRaw, metric), [teamRaw, oppRaw, metric]);
  const outcomeGrouped = useMemo(() => buildPxtOutcomeBreakdown(teamRaw, oppRaw, metric), [teamRaw, oppRaw, metric]);
  const contactGrouped = useMemo(() => buildPxtContactBreakdown(teamRaw, oppRaw, metric), [teamRaw, oppRaw, metric]);

  const comparisonMetrics = useMemo(
    () => buildPxtComparisonMetrics(teamStats, opponentStats, fmt2, fmt3),
    [teamStats, opponentStats],
  );

  const KEY_METRIC_KEYS = ['total_pxt', 'pxt_dominance', 'total_xt', 'packing_pts', 'passes', 'pxt_per_pass', 'p2_p3'];
  const visibleMetrics = useMemo(
    () => (showAllMetrics ? comparisonMetrics : comparisonMetrics.filter((m) => KEY_METRIC_KEYS.includes(m.key))),
    [comparisonMetrics, showAllMetrics],
  );

  const selectedComparisonMetric = comparisonMetrics.find((m) => m.key === selectedMetricKey) ?? comparisonMetrics[0];

  const heatmapData = useMemo(
    () => buildPxtHeatmapData(teamRaw, role, heatmapDirection, heatmapMode),
    [teamRaw, role, heatmapDirection, heatmapMode],
  );

  const attackChannelStats = useMemo(
    () => buildPxtAttackChannelStats(teamRaw),
    [teamRaw],
  );

  const zoneRoleGroups = useMemo(
    () => (selectedZone ? buildPxtZoneRoleActionGroups(teamRaw, selectedZone) : null),
    [selectedZone, teamRaw],
  );

  const openActionVideo = useCallback(
    (action: Action) => {
      const videoSec = getVideoTimestampSeconds(action);
      if (!hasExternalVideoSource(matchInfo)) {
        toast.error('Brak wideo dla tego meczu.');
        return false;
      }
      if (videoSec === null) {
        toast.error('Brak znacznika czasu wideo dla tej akcji.');
        return false;
      }
      setHasVideoPanel(true);
      setIsVideoPanelOpen(true);
      setVideoSeekRequestId((id) => id + 1);
      setVideoSeekTargetSeconds(null);
      window.requestAnimationFrame(() => {
        setVideoSeekTargetSeconds(videoSec);
      });
      return true;
    },
    [matchInfo],
  );

  const topPlayersBarData = useMemo(
    () => sortedPlayers.slice(0, 8).map((p) => ({ name: p.playerName.split(' ').pop() ?? p.playerName, pxt: p.pxt, passes: p.passes })),
    [sortedPlayers],
  );

  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const pxtTotal = teamStats.pxt + opponentStats.pxt;
  const teamDomPct = pxtTotal > 0 ? (teamStats.pxt / pxtTotal) * 100 : 50;

  const halfLabel = half === 'all' ? 'cały mecz' : half === 'first' ? 'I połowa' : 'II połowa';
  const typeLabel = filters.actionType === 'all' ? 'wszystkie akcje' : filters.actionType === 'pass' ? 'podania' : 'dryblingi';
  const filterCount = filters.packingFilters.length;

  const togglePackingFilter = (key: PxtPackingFilterKey, group: 'start' | 'end' | 'result') => {
    setFilters((prev) => {
      const current = prev.packingFilters;
      const groupKeys =
        group === 'start'
          ? START_FILTERS.map((f) => f.key)
          : group === 'end'
            ? END_FILTERS.map((f) => f.key)
            : RESULT_FILTERS.map((f) => f.key);
      const withoutGroup = current.filter((f) => !groupKeys.includes(f));
      if (current.includes(key)) return { ...prev, packingFilters: withoutGroup };
      return { ...prev, packingFilters: [...withoutGroup, key] };
    });
  };

  const togglePlayerSort = (column: PlayerSortCol) => {
    setPlayerSort((prev) => ({
      column,
      dir: prev.column === column && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (allActions.length === 0) {
    return <div className={styles.emptyState} role="status">Brak akcji packing w wybranym meczu.</div>;
  }

  const VIEW_TABS: Array<{ id: PxtView; label: string }> = [
    { id: 'overview', label: 'Przegląd' },
    { id: 'players', label: 'Zawodnicy' },
    { id: 'distributions', label: 'Rozkłady' },
    { id: 'map', label: 'Mapa' },
  ];

  return (
    <div className={styles.section}>
      {hasVideoPanel ? (
        <MatchVideoFloatingPanel
          matchInfo={matchInfo}
          title={`${teamName} vs ${opponentName}`}
          isOpen={isVideoPanelOpen}
          seekTargetSeconds={videoSeekTargetSeconds}
          seekRequestId={videoSeekRequestId}
          onSeekTargetConsumed={() => setVideoSeekTargetSeconds(null)}
          onClose={() => {
            setVideoSeekTargetSeconds(null);
            setIsVideoPanelOpen(false);
          }}
        />
      ) : null}

      <div className={styles.scoreboard}>
        <div className={`${styles.scoreSide} ${styles.scoreSideTeam}`}>
          <span className={styles.scoreName}>{teamName}</span>
          <span className={styles.scoreXg}>{formatMetric(metricFromStats(teamStats, metric), metric)}</span>
          <span className={styles.scoreSub}>{teamStats.passCount} pod. · {teamStats.dribbleCount} dryb. · P2+P3 {teamStats.p2Count + teamStats.p3Count}</span>
        </div>
        <div className={styles.scoreCenter}>
          <span className={styles.scoreCenterLabel}>{metricLabel(metric)}</span>
          <div className={styles.domBar} role="img" aria-label={`Udział PxT: ${teamShort} ${Math.round(teamDomPct)}%`}>
            <span className={styles.domBarTeam} style={{ width: `${teamDomPct}%` }} />
            <span className={styles.domBarOpp} style={{ width: `${100 - teamDomPct}%` }} />
          </div>
          <span className={styles.scoreCenterPct}>{Math.round(teamDomPct)}% · {100 - Math.round(teamDomPct)}%</span>
        </div>
        <div className={`${styles.scoreSide} ${styles.scoreSideOpp}`}>
          <span className={styles.scoreName}>{opponentName}</span>
          <span className={styles.scoreXg}>{formatMetric(metricFromStats(opponentStats, metric), metric)}</span>
          <span className={styles.scoreSub}>{opponentStats.passCount} pod. · {opponentStats.dribbleCount} dryb.</span>
        </div>
      </div>

      <p className={styles.lead}>
        {halfLabel} · {typeLabel} · <strong>{teamRaw.length + oppRaw.length}</strong> akcji
        {filterCount > 0 ? ` · ${filterCount} filtrów aktywnych` : ''}
        {teamStats.possessionMin > 0 ? ` · ${fmt3(teamStats.pxtPerMinPossession)} PxT/min pos.` : ''}
      </p>

      <div className={styles.filterBar}>
        <div className={`${pageStyles.xgHalfSelector} ${styles.selectorInline}`}>
          <ToggleFilterButton active={half === 'all'} onClick={() => setHalf('all')}>Cały mecz</ToggleFilterButton>
          <ToggleFilterButton active={half === 'first'} onClick={() => setHalf('first')}>I połowa</ToggleFilterButton>
          <ToggleFilterButton active={half === 'second'} onClick={() => setHalf('second')}>II połowa</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={filters.actionType === 'all'} onClick={() => setFilters((p) => ({ ...p, actionType: 'all' }))} variant="metric">Wszystkie</ToggleFilterButton>
          <ToggleFilterButton active={filters.actionType === 'pass'} onClick={() => setFilters((p) => ({ ...p, actionType: 'pass' }))} variant="metric">Podanie</ToggleFilterButton>
          <ToggleFilterButton active={filters.actionType === 'dribble'} onClick={() => setFilters((p) => ({ ...p, actionType: 'dribble' }))} variant="metric">Drybling</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={metric === 'pxt'} onClick={() => setMetric('pxt')} variant="metric">PxT</ToggleFilterButton>
          <ToggleFilterButton active={metric === 'xt'} onClick={() => setMetric('xt')} variant="metric">ΔxT</ToggleFilterButton>
          <ToggleFilterButton active={metric === 'packing'} onClick={() => setMetric('packing')} variant="metric">Packing</ToggleFilterButton>
        </div>
      </div>

      <div className={styles.pxtFilterPanel} aria-label="Filtry wyniku akcji packing">
        <div className={styles.pxtFilterGroup}>
          <span className={styles.pxtFilterGroupLabel}>Start</span>
          {START_FILTERS.map(({ key, label }) => (
            <ToggleFilterButton
              key={key}
              active={filters.packingFilters.includes(key)}
              onClick={() => togglePackingFilter(key, 'start')}
              variant="metric"
              disabled={filterCounts[key] === 0}
            >
              {label} ({filterCounts[key]})
            </ToggleFilterButton>
          ))}
        </div>
        <div className={styles.pxtFilterGroup}>
          <span className={styles.pxtFilterGroupLabel}>Koniec</span>
          {END_FILTERS.map(({ key, label }) => (
            <ToggleFilterButton
              key={key}
              active={filters.packingFilters.includes(key)}
              onClick={() => togglePackingFilter(key, 'end')}
              variant="metric"
              disabled={filterCounts[key] === 0}
            >
              {label} ({filterCounts[key]})
            </ToggleFilterButton>
          ))}
        </div>
        <div className={styles.pxtFilterGroup}>
          <span className={styles.pxtFilterGroupLabel}>Skutek</span>
          {RESULT_FILTERS.map(({ key, label }) => (
            <ToggleFilterButton
              key={key}
              active={filters.packingFilters.includes(key)}
              onClick={() => togglePackingFilter(key, 'result')}
              variant="metric"
              disabled={filterCounts[key] === 0}
            >
              {label} ({filterCounts[key]})
            </ToggleFilterButton>
          ))}
          {filterCount > 0 ? (
            <button type="button" className={styles.pxtFilterClear} onClick={() => setFilters((p) => ({ ...p, packingFilters: [] }))}>
              Wyczyść filtry
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.viewNav} role="tablist" aria-label="Widoki PxT">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={`${styles.viewNavButton} ${view === tab.id ? styles.viewNavButtonActive : ''}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'overview' ? (
        <>
          {half === 'all' ? (
            <div className={styles.halfCompareGrid} aria-label="Porównanie połów">
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>I połowa</h4>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotTeam} />{teamShort}: PxT <strong>{fmt2(teamStats.firstHalf.pxt)}</strong> · {teamStats.firstHalf.passCount} pod.
                </p>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotOpp} />{oppShort}: PxT <strong>{fmt2(opponentStats.firstHalf.pxt)}</strong> · {opponentStats.firstHalf.passCount} pod.
                </p>
              </div>
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>II połowa</h4>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotTeam} />{teamShort}: PxT <strong>{fmt2(teamStats.secondHalf.pxt)}</strong> · {teamStats.secondHalf.passCount} pod.
                </p>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotOpp} />{oppShort}: PxT <strong>{fmt2(opponentStats.secondHalf.pxt)}</strong> · {opponentStats.secondHalf.passCount} pod.
                </p>
              </div>
            </div>
          ) : null}

          {cumulativeData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Skumulowane PxT</h3>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={cumulativeData} margin={{ top: 36, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pxtTeamFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAM_BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={TEAM_BLUE} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="pxtOppFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAM_RED} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={TEAM_RED} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis
                    dataKey="minute"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmt2} axisLine={false} tickLine={false} width={34} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { minute: number; teamPxt: number; oppPxt: number };
                      return (
                        <ChartTooltip
                          label={`${d.minute}'`}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: fmt2(d.teamPxt) },
                            { color: TEAM_RED, label: oppShort, value: fmt2(d.oppPxt) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="teamPxt" stroke={TEAM_BLUE} strokeWidth={2.5} fill="url(#pxtTeamFill)" name={teamShort} />
                  <Area type="monotone" dataKey="oppPxt" stroke={TEAM_RED} strokeWidth={2.5} fill="url(#pxtOppFill)" name={oppShort} />
                  {renderChartMatchEventMarkers({ points: cumulativeMarkerPoints })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {hasMomentum ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Momentum co 5 minut</h3>
              <p className={styles.chartSubtitle}>Góra: {teamShort} · dół: {oppShort} · {metricLabel(metric)}</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={momentumData} stackOffset="sign" margin={{ top: 36, right: 8, left: -8, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="minute" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={36} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v: number) => formatMetric(Math.abs(v), metric)} axisLine={false} tickLine={false} width={40} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { teamVal: number; oppValNeg: number };
                      return (
                        <ChartTooltip
                          label={String(label)}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: formatMetric(d.teamVal, metric) },
                            { color: TEAM_RED, label: oppShort, value: formatMetric(Math.abs(d.oppValNeg), metric) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="teamVal" stackId="s" fill={TEAM_BLUE} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="oppValNeg" stackId="s" fill={TEAM_RED} fillOpacity={0.75} radius={[0, 0, 3, 3]} />
                  {renderChartMatchEventMarkers({ points: momentumMarkerPoints })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className={styles.comparisonBlock}>
            <div className={styles.comparisonTableWrap}>
              <div className={styles.comparisonTable} role="grid" aria-label="Porównanie PxT">
                <div className={styles.comparisonHeader} role="row">
                  <span role="columnheader">Wskaźnik</span>
                  <span role="columnheader">{teamShort}</span>
                  <span role="columnheader">{oppShort}</span>
                </div>
                {visibleMetrics.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    role="row"
                    className={`${styles.comparisonRow} ${selectedMetricKey === row.key ? styles.comparisonRowActive : ''}`}
                    onClick={() => setSelectedMetricKey(row.key)}
                    aria-pressed={selectedMetricKey === row.key}
                  >
                    <span className={styles.comparisonMetric} role="cell">
                      {row.label}
                      {row.hint ? <span className={styles.comparisonMetricHint}>{row.hint}</span> : null}
                    </span>
                    <span className={`${styles.comparisonValue} ${styles.comparisonValueTeam}`} role="cell">{row.teamDisplay}</span>
                    <span className={`${styles.comparisonValue} ${styles.comparisonValueOpp}`} role="cell">{row.oppDisplay}</span>
                  </button>
                ))}
              </div>
              <button type="button" className={styles.showMoreButton} onClick={() => setShowAllMetrics((v) => !v)}>
                {showAllMetrics ? 'Pokaż mniej wskaźników' : `Pokaż wszystkie wskaźniki (${comparisonMetrics.length})`}
              </button>
            </div>
            {selectedComparisonMetric ? (
              <PxtMetricVisualization metric={selectedComparisonMetric} teamName={teamName} opponentName={opponentName} />
            ) : null}
          </div>
        </>
      ) : null}

      {view === 'players' ? (
        <>
          {topPlayersBarData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Top zawodnicy — PxT ({teamShort})</h3>
              <ResponsiveContainer width="100%" height={Math.max(140, topPlayersBarData.length * 28)}>
                <BarChart data={topPlayersBarData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; pxt: number; passes: number };
                      return <ChartTooltip label={d.name} rows={[{ color: TEAM_BLUE, label: 'PxT', value: `${fmt2(d.pxt)} · ${d.passes} pod.` }]} />;
                    }}
                  />
                  <Bar dataKey="pxt" fill={TEAM_BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <section className={styles.playersSection} aria-labelledby="pxt-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="pxt-players-title">{teamShort}</h3>
              <span className={styles.sectionMeta}>{sortedPlayers.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    {([
                      ['playerName', 'Zawodnik'],
                      ['pxtSharePct', 'Udział %'],
                      ['pxt', 'PxT'],
                      ['xt', 'ΔxT'],
                      ['packing', 'Pkt'],
                      ['passes', 'Podania'],
                      ['dribbles', 'Drybling'],
                      ['p2Count', 'P2'],
                      ['p3Count', 'P3'],
                    ] as [PlayerSortCol, string][]).map(([col, label]) => (
                      <th key={col} scope="col" className={styles.sortableTh} onClick={() => togglePlayerSort(col)} tabIndex={0}>
                        {label}{playerSort.column === col ? (playerSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.length === 0 ? (
                    <tr><td colSpan={9}>Brak danych.</td></tr>
                  ) : (
                    sortedPlayers.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>
                          <span className={styles.shareCell}>
                            <span className={styles.shareBar} style={{ width: `${Math.min(100, row.pxtSharePct)}%` }} aria-hidden="true" />
                            <span className={styles.shareCellValue}>{Math.round(row.pxtSharePct)}%</span>
                          </span>
                        </td>
                        <td>{fmt2(row.pxt)}</td>
                        <td>{fmt3(row.xt)}</td>
                        <td>{Math.round(row.packing)}</td>
                        <td>{row.passes}</td>
                        <td>{row.dribbles}</td>
                        <td>{row.p2Count}</td>
                        <td>{row.p3Count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.playersSection} aria-labelledby="pxt-opp-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="pxt-opp-players-title">{oppShort}</h3>
              <span className={styles.sectionMeta}>{opponentPlayerRows.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    <th scope="col">Zawodnik</th>
                    <th scope="col">Udział %</th>
                    <th scope="col">PxT</th>
                    <th scope="col">Podania</th>
                    <th scope="col">Drybling</th>
                  </tr>
                </thead>
                <tbody>
                  {opponentPlayerRows.length === 0 ? (
                    <tr><td colSpan={5}>Brak danych {oppShort} (brak teamId w akcjach).</td></tr>
                  ) : (
                    opponentPlayerRows.slice(0, 12).map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{Math.round(row.pxtSharePct)}%</td>
                        <td>{fmt2(row.pxt)}</td>
                        <td>{row.passes}</td>
                        <td>{row.dribbles}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {view === 'distributions' ? (
        <div className={styles.chartsGrid}>
          <CombinedPxtDistributionCard title="Typ akcji" rows={typeGrouped} teamName={teamName} opponentName={opponentName} metric={metric} />
          <CombinedPxtDistributionCard title="Wynik akcji (P / skutek)" rows={outcomeGrouped} teamName={teamName} opponentName={opponentName} metric={metric} />
          <CombinedPxtDistributionCard title="Kontakty" subtitle="Grupa kontaktów przy podaniu" rows={contactGrouped} teamName={teamName} opponentName={opponentName} metric={metric} />
        </div>
      ) : null}

      {view === 'map' ? (
        <section className={styles.mapSection} aria-labelledby="pxt-map-title">
          <h3 className={styles.mapSectionTitle} id="pxt-map-title">Heatmapa PxT — {teamShort}</h3>
          <div className={styles.filterBar} style={{ marginBottom: 12 }}>
            <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
              <ToggleFilterButton active={role === 'sender'} onClick={() => setRole('sender')} variant="metric">Podanie</ToggleFilterButton>
              <ToggleFilterButton active={role === 'receiver'} onClick={() => setRole('receiver')} variant="metric">Przyjęcie</ToggleFilterButton>
              <ToggleFilterButton active={role === 'dribbler'} onClick={() => setRole('dribbler')} variant="metric">Drybling</ToggleFilterButton>
            </div>
            {role !== 'dribbler' ? (
              <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
                <ToggleFilterButton active={heatmapDirection === 'from'} onClick={() => setHeatmapDirection('from')} variant="metric">Z strefy</ToggleFilterButton>
                <ToggleFilterButton active={heatmapDirection === 'to'} onClick={() => setHeatmapDirection('to')} variant="metric">Do strefy</ToggleFilterButton>
              </div>
            ) : null}
            <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
              <ToggleFilterButton active={heatmapMode === 'pxt'} onClick={() => setHeatmapMode('pxt')} variant="metric">PxT</ToggleFilterButton>
              <ToggleFilterButton active={heatmapMode === 'count'} onClick={() => setHeatmapMode('count')} variant="metric">Liczba</ToggleFilterButton>
            </div>
            <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
              <ToggleFilterButton
                active={showAttackChannels}
                onClick={() => setShowAttackChannels((v) => !v)}
                variant="metric"
                title="Nakładka: kierunek ataku (lewa / środek / prawa) wg końca akcji packing"
              >
                Kierunek ataku
              </ToggleFilterButton>
            </div>
          </div>
          <p className={styles.sectionMeta} style={{ marginBottom: 8 }}>
            {showAttackChannels
              ? 'Nakładka pokazuje sumę PxT/ΔxT oraz % akcji i % PxT w pasach A–B, C–F, G–H (koniec podania/dryblingu). Wyłącz „Kierunek ataku”, aby wrócić do heatmapy stref.'
              : 'Kliknij strefę na heatmapie — w panelu zobaczysz akcje w podaniu, przyjęciu i dryblingu. Wideo otwiera się po kliknięciu niebieskiej minuty.'}
          </p>
          <div className={styles.mainLayout}>
            <div className={styles.mapPanel}>
              <PlayerHeatmapPitch
                heatmapData={heatmapData}
                category={role}
                mode={heatmapMode}
                selectedZone={selectedZone}
                onZoneClick={(zoneName) => {
                  const normalized = typeof zoneName === 'string' ? zoneName.toUpperCase().replace(/\s+/g, '') : String(zoneName);
                  setSelectedZone(normalized === selectedZone ? null : normalized);
                }}
              >
                {showAttackChannels ? <PxtAttackChannelOverlay channels={attackChannelStats} /> : null}
              </PlayerHeatmapPitch>
            </div>
            <aside className={styles.shotPanel} aria-live="polite">
              {zoneRoleGroups ? (
                <>
                  <div className={styles.shotPanelHeader}>
                    <h4 className={styles.shotPanelTitle}>Strefa {selectedZone}</h4>
                    <button type="button" className={styles.shotPanelClose} onClick={() => setSelectedZone(null)} aria-label="Zamknij">×</button>
                  </div>
                  {zoneRoleGroups.map((group) => (
                    <div key={group.role} className={styles.pxtZoneRoleGroup}>
                      <h5 className={styles.pxtZoneRoleTitle}>{group.label}</h5>
                      {group.actions.length === 0 ? (
                        <p className={styles.pxtZoneRoleEmpty}>Brak akcji w tej roli.</p>
                      ) : (
                        <ul className={styles.pxtZoneActionsList}>
                          {group.actions.map((action) => {
                            const halfLabel = action.minute > 45 ? 'II' : 'I';
                            const videoSec = getVideoTimestampSeconds(action);
                            const canVideo = hasExternalVideoSource(matchInfo) && videoSec !== null;
                            const metrics = getPackingMetrics(action);
                            const playerLabel =
                              group.role === 'receiver' && action.receiverId
                                ? getPlayerLabel(action.receiverId, playersIndex)
                                : getPlayerLabel(action.senderId, playersIndex);
                            return (
                              <li key={`${group.role}-${action.id}`} className={styles.pxtZoneActionItem}>
                                {canVideo ? (
                                  <button
                                    type="button"
                                    className={styles.pxtZoneActionMinuteButton}
                                    onClick={() => openActionVideo(action)}
                                    title="Odtwórz wideo od tej akcji"
                                  >
                                    {halfLabel} {action.minute}&apos;
                                  </button>
                                ) : (
                                  <span className={styles.pxtZoneActionMinute}>
                                    {halfLabel} {action.minute}&apos;
                                  </span>
                                )}
                                <span className={styles.pxtZoneActionMeta}>
                                  {playerLabel} · {fmt2(metrics.pxt)} PxT
                                  {!hasExternalVideoSource(matchInfo) ? '' : videoSec === null ? ' · brak wideo' : ''}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <p className={styles.shotPanelEmpty}>Kliknij strefę na heatmapie, aby zobaczyć akcje w podaniu, przyjęciu i dryblingu.</p>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
