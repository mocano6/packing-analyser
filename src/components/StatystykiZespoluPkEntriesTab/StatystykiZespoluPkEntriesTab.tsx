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
import PKEntriesPitch from '@/components/PKEntriesPitch/PKEntriesPitch';
import type { PKEntry, Player, Shot, TeamInfo } from '@/types';
import { getVideoTimestampSeconds } from '@/utils/actionVideoSeekSeconds';
import { hasExternalVideoSource } from '@/utils/externalVideoMatchInfo';
import { getPlayerLabel } from '@/utils/playerUtils';
import { buildPkComparisonMetrics, type PkComparisonMetric } from '@/utils/statystykiZespoluPkComparison';
import {
  buildCumulativePkChartData,
  buildPk5MinChartData,
  buildPkTabSummary,
  buildPlayerPkRows,
  buildTeamAndOpponentPkStats,
  filterPkEntriesForTab,
  getMatchPkEntries,
  getSidePkEntries,
  mergePkBreakdownRows,
  type GroupedPkRow,
  type PkHalfFilter,
  type PkPlayerRow,
} from '@/utils/statystykiZespoluPkStats';
import {
  DEFAULT_WIEDZA_PK_ENTRIES_FILTERS,
  WIEDZA_PK_ENTRY_TYPE_OPTIONS,
  WIEDZA_PK_OUTCOME_OPTIONS,
  type WiedzaPkEntriesFilterState,
  type WiedzaPkEntryTypeFilter,
  type WiedzaPkOutcomeFilter,
} from '@/utils/wiedzaPkEntriesFilters';
import {
  buildChartMatchEvents,
  buildCumulativeMarkerPoints,
  buildIntervalMarkerPoints,
} from '@/utils/statystykiZespoluChartEvents';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from '../StatystykiZespoluXgTab/StatystykiZespoluXgTab.module.css';

const TEAM_BLUE = '#2563eb';
const TEAM_RED = '#dc2626';
const TEAM_GREEN = '#059669';

const ENTRY_TYPE_COLORS: Record<string, string> = {
  pass: '#dc2626',
  dribble: '#1e40af',
  sfg: '#059669',
};

const PIE_COLORS = ['#2563eb', '#dc2626', '#059669', '#f97316', '#7c3aed', '#0891b2'];

function fmt2(value: number): string {
  return Number(value).toFixed(2);
}

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt2(value)}`;
}

function shortTeamLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

type Props = {
  allPkEntries: PKEntry[];
  allShots?: Shot[];
  matchInfo: TeamInfo;
  selectedTeam: string;
  teamName: string;
  opponentName: string;
  players: Player[];
  playersIndex: ReturnType<typeof import('@/utils/playerUtils').buildPlayersIndex>;
  availableTeams: Array<{ id: string; name: string; logo?: string }>;
};

type PkView = 'overview' | 'players' | 'distributions' | 'map';
type PlayerSortCol = 'playerName' | 'entriesSharePct' | 'entries' | 'goals' | 'shots' | 'regains' | 'sfgEntries' | 'shotPct';

type ComparisonMetric = PkComparisonMetric;

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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  variant?: ToggleButtonVariant;
}) {
  return (
    <button type="button" className={toggleButtonClass(variant, active)} onClick={onClick} title={title} aria-pressed={active}>
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

type ShareComparison = {
  teamSharePct: number;
  oppSharePct: number;
  ratio: number | null;
  advantagePp: number;
  leader: 'team' | 'opp' | 'tie';
};

function buildShareComparison(teamValue: number, oppValue: number): ShareComparison | null {
  const total = teamValue + oppValue;
  if (total <= 0) return null;
  const teamSharePct = (teamValue / total) * 100;
  const oppSharePct = (oppValue / total) * 100;
  const ratio = oppValue > 0.0001 ? teamValue / oppValue : teamValue > 0 ? null : null;
  return {
    teamSharePct,
    oppSharePct,
    ratio,
    advantagePp: teamSharePct - 50,
    leader: teamSharePct > oppSharePct + 0.05 ? 'team' : oppSharePct > teamSharePct + 0.05 ? 'opp' : 'tie',
  };
}

function formatAdvantageRatio(ratio: number | null, teamValue: number, oppValue: number): string | null {
  if (teamValue > 0 && oppValue <= 0.0001) return 'pełna';
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return null;
  return ratio >= 10 ? `×${ratio.toFixed(1)}` : `×${fmt2(ratio)}`;
}

function ShareDonutVisualization({ metric, teamName, opponentName }: { metric: ComparisonMetric; teamName: string; opponentName: string }) {
  const share = buildShareComparison(metric.teamValue, metric.oppValue);
  const diff = metric.teamValue - metric.oppValue;
  const ratioLabel = share ? formatAdvantageRatio(share.ratio, metric.teamValue, metric.oppValue) : null;
  const pieData = share
    ? [
        { name: teamName, value: metric.teamValue, fill: TEAM_BLUE, sharePct: share.teamSharePct },
        { name: opponentName, value: metric.oppValue, fill: TEAM_RED, sharePct: share.oppSharePct },
      ]
    : [];
  const leaderLabel = share?.leader === 'team' ? shortTeamLabel(teamName) : share?.leader === 'opp' ? shortTeamLabel(opponentName) : null;

  return (
    <>
      <div className={styles.donutWrap} role="img" aria-label={`Udział ${teamName} ${share ? `${Math.round(share.teamSharePct)}%` : 'brak'}`}>
        {share ? (
          <>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={78} paddingAngle={2} startAngle={90} endAngle={-270} stroke="none">
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const payload = item?.payload as { sharePct?: number; name?: string } | undefined;
                    const display = metric.unit === 'int' ? String(Math.round(value)) : metric.unit === 'pct' ? `${fmt2(value)}%` : fmt2(value);
                    const pct = payload?.sharePct != null ? ` (${fmt2(payload.sharePct)}%)` : '';
                    return [`${display}${pct}`, payload?.name ?? ''];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCenter} aria-hidden="true">
              <span className={`${styles.donutCenterPct} ${share.leader === 'team' ? styles.donutCenterPctTeam : share.leader === 'opp' ? styles.donutCenterPctOpp : ''}`}>
                {Math.round(share.teamSharePct)}%
              </span>
              <span className={styles.donutCenterLabel}>{shortTeamLabel(teamName)}</span>
            </div>
          </>
        ) : (
          <div className={styles.donutEmpty} role="status">
            <span className={styles.donutEmptyRing} />
            <span className={styles.donutEmptyText}>Brak danych</span>
          </div>
        )}
      </div>
      {share ? (
        <div className={styles.advantageBadge}>
          {share.leader === 'tie' ? (
            <span className={styles.advantageNeutral}>Równowaga 50/50</span>
          ) : (
            <>
              <span className={share.leader === 'team' ? styles.advantageTeam : styles.advantageOpp}>{leaderLabel} +{fmt2(Math.abs(share.advantagePp))} pp</span>
              {ratioLabel ? <span className={styles.advantageRatio}>{ratioLabel}</span> : null}
            </>
          )}
        </div>
      ) : null}
      <div className={styles.donutLegend}>
        <span className={styles.donutLegendItem}>
          <span className={styles.donutLegendDot} style={{ background: TEAM_BLUE }} />
          <span className={styles.donutLegendName}>{shortTeamLabel(teamName)}</span>
          <strong>{metric.teamDisplay}</strong>
          {share ? <span className={styles.donutLegendPct}>{fmt2(share.teamSharePct)}%</span> : null}
        </span>
        <span className={styles.donutLegendItem}>
          <span className={styles.donutLegendDot} style={{ background: TEAM_RED }} />
          <span className={styles.donutLegendName}>{shortTeamLabel(opponentName)}</span>
          <strong>{metric.oppDisplay}</strong>
          {share ? <span className={styles.donutLegendPct}>{fmt2(share.oppSharePct)}%</span> : null}
        </span>
      </div>
      <p className={styles.metricVizLead}>
        Δ <span className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : styles.neutral}>{formatSigned(diff)}</span>
      </p>
    </>
  );
}

function SignedDivergingVisualization({ metric, teamName, opponentName }: { metric: ComparisonMetric; teamName: string; opponentName: string }) {
  const maxAbs = Math.max(Math.abs(metric.teamValue), Math.abs(metric.oppValue), 0.05);
  const teamPos = ((metric.teamValue + maxAbs) / (maxAbs * 2)) * 100;
  const oppPos = ((metric.oppValue + maxAbs) / (maxAbs * 2)) * 100;
  const diff = metric.teamValue - metric.oppValue;

  return (
    <>
      <div className={styles.signedTrackWrap} role="img" aria-label={`${teamName} ${metric.teamDisplay}, ${opponentName} ${metric.oppDisplay}`}>
        <div className={styles.signedTrack}>
          <span className={styles.signedTrackZero} aria-hidden="true" />
          <span className={`${styles.signedMarker} ${styles.signedMarkerTeam}`} style={{ left: `${teamPos}%` }} title={`${teamName}: ${metric.teamDisplay}`} />
          <span className={`${styles.signedMarker} ${styles.signedMarkerOpp}`} style={{ left: `${oppPos}%` }} title={`${opponentName}: ${metric.oppDisplay}`} />
        </div>
        <div className={styles.signedTrackLabels}>
          <span>−{fmt2(maxAbs)}</span>
          <span>0</span>
          <span>+{fmt2(maxAbs)}</span>
        </div>
      </div>
      <div className={styles.donutLegend}>
        <span className={styles.donutLegendItem}>
          <span className={styles.donutLegendDot} style={{ background: TEAM_BLUE }} />
          <span className={styles.donutLegendName}>{shortTeamLabel(teamName)}</span>
          <strong>{metric.teamDisplay}</strong>
        </span>
        <span className={styles.donutLegendItem}>
          <span className={styles.donutLegendDot} style={{ background: TEAM_RED }} />
          <span className={styles.donutLegendName}>{shortTeamLabel(opponentName)}</span>
          <strong>{metric.oppDisplay}</strong>
        </span>
      </div>
      <p className={styles.metricVizHint}>Wyżej = większa przewaga liczebna partnerów w PK</p>
      <p className={styles.metricVizLead}>
        Δ <span className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : styles.neutral}>{formatSigned(diff)}</span>
      </p>
    </>
  );
}

function MetricVisualization({ metric, teamName, opponentName }: { metric: ComparisonMetric; teamName: string; opponentName: string }) {
  return (
    <div className={styles.metricVizCard} aria-live="polite">
      <h4 className={styles.metricVizTitle}>{metric.label}</h4>
      {metric.hint && !metric.signedValues ? <p className={styles.metricVizHint}>{metric.hint}</p> : null}
      {metric.signedValues ? (
        <SignedDivergingVisualization metric={metric} teamName={teamName} opponentName={opponentName} />
      ) : (
        <ShareDonutVisualization metric={metric} teamName={teamName} opponentName={opponentName} />
      )}
    </div>
  );
}

function CombinedDistributionCard({
  title,
  subtitle,
  rows,
  teamName,
  opponentName,
}: {
  title: string;
  subtitle?: string;
  rows: GroupedPkRow[];
  teamName: string;
  opponentName: string;
}) {
  if (rows.length === 0) return null;
  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {subtitle ? <p className={styles.chartSubtitle}>{subtitle}</p> : null}
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={rows} margin={{ top: 6, right: 6, left: -10, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(148,163,184,0.10)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as GroupedPkRow;
              return (
                <ChartTooltip
                  label={d.name}
                  rows={[
                    { color: TEAM_BLUE, label: teamShort, value: `${d.teamCount} wej. · ${d.teamShots} strz. · ${d.teamGoals} g` },
                    { color: TEAM_RED, label: oppShort, value: `${d.oppCount} wej. · ${d.oppShots} strz. · ${d.oppGoals} g` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="teamCount" name={teamShort} fill={TEAM_BLUE} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="oppCount" name={oppShort} fill={TEAM_RED} radius={[4, 4, 0, 0]} maxBarSize={26} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
      <div className={styles.miniLegend}>
        <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_BLUE }} />{teamShort}</span>
        <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_RED }} />{oppShort}</span>
      </div>
      <div className={styles.breakdownTableWrap}>
        <table className={styles.breakdownTable} aria-label={title}>
          <thead>
            <tr>
              <th scope="col">Kategoria</th>
              <th scope="col" className={styles.thTeam}>{teamShort}</th>
              <th scope="col" className={styles.thOpp}>{oppShort}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td className={styles.tdTeam}>{r.teamCount} · {r.teamShots} strz. · {r.teamGoals} g</td>
                <td className={styles.tdOpp}>{r.oppCount} · {r.oppShots} strz. · {r.oppGoals} g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function entryTypeLabel(entryType?: string): string {
  const map: Record<string, string> = { pass: 'Podanie', dribble: 'Drybling', sfg: 'SFG', regain: 'Regain' };
  return entryType ? (map[entryType] ?? entryType) : '—';
}

export default function StatystykiZespoluPkEntriesTab({
  allPkEntries,
  allShots = [],
  matchInfo,
  selectedTeam,
  teamName,
  opponentName,
  players,
  playersIndex,
  availableTeams,
}: Props) {
  const [view, setView] = useState<PkView>('overview');
  const [half, setHalf] = useState<PkHalfFilter>('all');
  const [filters, setFilters] = useState<WiedzaPkEntriesFilterState>(DEFAULT_WIEDZA_PK_ENTRIES_FILTERS);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState('total_entries');
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [hasVideoPanel, setHasVideoPanel] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [videoSeekTargetSeconds, setVideoSeekTargetSeconds] = useState<number | null>(null);
  const [videoSeekRequestId, setVideoSeekRequestId] = useState(0);
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({ column: 'entries', dir: 'desc' });

  const matchEntries = useMemo(() => getMatchPkEntries(allPkEntries, selectedTeam), [allPkEntries, selectedTeam]);
  const filteredForStats = useMemo(
    () => filterPkEntriesForTab(matchEntries, half, filters),
    [matchEntries, half, filters],
  );

  const { teamStats, opponentStats } = useMemo(
    () => buildTeamAndOpponentPkStats(filteredForStats, matchInfo, selectedTeam, half),
    [filteredForStats, matchInfo, selectedTeam, half],
  );

  const teamEntries = useMemo(() => getSidePkEntries(filteredForStats, 'team'), [filteredForStats]);
  const opponentEntries = useMemo(() => getSidePkEntries(filteredForStats, 'opponent'), [filteredForStats]);

  const teamSummary = useMemo(() => buildPkTabSummary(teamEntries), [teamEntries]);
  const opponentSummary = useMemo(() => buildPkTabSummary(opponentEntries), [opponentEntries]);
  const matchSummary = useMemo(() => buildPkTabSummary(filteredForStats), [filteredForStats]);

  const playerRows = useMemo(
    () => buildPlayerPkRows(teamEntries, teamStats.entries, (id) => getPlayerLabel(id, playersIndex)),
    [teamEntries, teamStats.entries, playersIndex],
  );
  const opponentPlayerRows = useMemo(
    () => buildPlayerPkRows(opponentEntries, opponentStats.entries, (id) => getPlayerLabel(id, playersIndex)),
    [opponentEntries, opponentStats.entries, playersIndex],
  );

  const sortedPlayers = useMemo(() => {
    const col = playerSort.column;
    const dir = playerSort.dir;
    return [...playerRows].sort((a, b) => {
      if (col === 'playerName') {
        const cmp = a.playerName.localeCompare(b.playerName);
        return dir === 'asc' ? cmp : -cmp;
      }
      const va = Number(a[col as keyof PkPlayerRow]) || 0;
      const vb = Number(b[col as keyof PkPlayerRow]) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [playerRows, playerSort]);

  const cumulativeData = useMemo(() => buildCumulativePkChartData(filteredForStats, selectedTeam), [filteredForStats, selectedTeam]);
  const intervalData = useMemo(() => buildPk5MinChartData(filteredForStats, selectedTeam), [filteredForStats, selectedTeam]);

  const momentumData = useMemo(() => {
    const rows = intervalData.map((d) => ({
      ...d,
      oppPassNeg: -d.oppPass,
      oppDribbleNeg: -d.oppDribble,
      oppSfgNeg: -d.oppSfg,
    }));
    let start = 0;
    let end = rows.length - 1;
    while (start < rows.length && rows[start].teamTotal === 0 && rows[start].oppTotal === 0) start += 1;
    while (end > start && rows[end].teamTotal === 0 && rows[end].oppTotal === 0) end -= 1;
    return rows.slice(start, end + 1);
  }, [intervalData]);

  const hasMomentum = momentumData.some((d) => d.teamTotal > 0 || d.oppTotal > 0);
  const chartEvents = useMemo(
    () => buildChartMatchEvents(allShots, allPkEntries, matchInfo, selectedTeam, half),
    [allShots, allPkEntries, matchInfo, selectedTeam, half],
  );
  const momentumMarkerPoints = useMemo(
    () => buildIntervalMarkerPoints(chartEvents, momentumData, {
      variant: 'signed',
      teamValueKey: 'teamTotal',
      oppValueKey: 'oppTotal',
      valueKeys: ['teamTotal', 'oppTotal'],
    }),
    [chartEvents, momentumData],
  );
  const cumulativeMarkerPoints = useMemo(
    () => buildCumulativeMarkerPoints(chartEvents, cumulativeData, {
      teamValueKey: 'teamEntries',
      opponentValueKey: 'opponentEntries',
    }),
    [chartEvents, cumulativeData],
  );

  const actionGrouped = useMemo(() => mergePkBreakdownRows(teamSummary.byEntryType, opponentSummary.byEntryType), [teamSummary, opponentSummary]);
  const outcomeGrouped = useMemo(() => mergePkBreakdownRows(teamSummary.byOutcome, opponentSummary.byOutcome), [teamSummary, opponentSummary]);

  const topPlayersBarData = useMemo(
    () => sortedPlayers.slice(0, 8).map((p) => ({ name: p.playerName.split(' ').pop() ?? p.playerName, entries: p.entries, goals: p.goals })),
    [sortedPlayers],
  );

  const comparisonMetrics = useMemo(
    () => buildPkComparisonMetrics(teamStats, opponentStats, fmt2, formatSigned),
    [teamStats, opponentStats],
  );

  const KEY_METRIC_KEYS = ['total_entries', 'entries_dominance', 'goals', 'shots', 'shot_pct', 'regain_pct', 'pk_advantage'];
  const visibleMetrics = useMemo(
    () => (showAllMetrics ? comparisonMetrics : comparisonMetrics.filter((m) => KEY_METRIC_KEYS.includes(m.key))),
    [comparisonMetrics, showAllMetrics],
  );

  const selectedMetric = comparisonMetrics.find((m) => m.key === selectedMetricKey) ?? comparisonMetrics[0];
  const selectedEntry = useMemo(
    () => (selectedEntryId ? filteredForStats.find((e) => e.id === selectedEntryId) ?? null : null),
    [filteredForStats, selectedEntryId],
  );

  const openEntryVideo = useCallback(
    (entry: PKEntry) => {
      const videoSec = getVideoTimestampSeconds(entry);
      if (!hasExternalVideoSource(matchInfo)) {
        toast.error('Brak wideo dla tego meczu.');
        return false;
      }
      if (videoSec === null) {
        toast.error('Brak znacznika czasu wideo dla tego wejścia.');
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

  const handleEntryClick = useCallback(
    (entry: PKEntry) => {
      setSelectedEntryId(entry.id);
      openEntryVideo(entry);
    },
    [openEntryVideo],
  );

  const selectedEntryHalf = selectedEntry ? (selectedEntry.minute > 45 ? 'II' : 'I') : null;
  const selectedEntryVideoSec = selectedEntry ? getVideoTimestampSeconds(selectedEntry) : null;
  const canSelectedEntryVideo = Boolean(
    selectedEntry && hasExternalVideoSource(matchInfo) && selectedEntryVideoSec !== null,
  );

  const controversialEntries = useMemo(() => filteredForStats.filter((e) => e.isControversial), [filteredForStats]);

  const halfLabel = half === 'all' ? 'cały mecz' : half === 'first' ? 'I połowa' : 'II połowa';
  const filterLabel = filters.entryType === 'all' && filters.outcome === 'all'
    ? 'wszystkie wejścia'
    : `${WIEDZA_PK_ENTRY_TYPE_OPTIONS.find((o) => o.value === filters.entryType)?.label ?? ''} · ${WIEDZA_PK_OUTCOME_OPTIONS.find((o) => o.value === filters.outcome)?.label ?? ''}`.trim();

  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const entriesTotal = teamStats.entries + opponentStats.entries;
  const teamDomPct = entriesTotal > 0 ? (teamStats.entries / entriesTotal) * 100 : 50;

  const togglePlayerSort = (column: PlayerSortCol) => {
    setPlayerSort((prev) => ({
      column,
      dir: prev.column === column && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (allPkEntries.length === 0) {
    return <div className={styles.emptyState} role="status">Brak wejść w PK w wybranym meczu.</div>;
  }

  const VIEW_TABS: Array<{ id: PkView; label: string }> = [
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
          <span className={styles.scoreXg}>{teamStats.entries}</span>
          <span className={styles.scoreSub}>{teamStats.goals} g · {teamStats.shots} strz.</span>
        </div>
        <div className={styles.scoreCenter}>
          <span className={styles.scoreCenterLabel}>Wejścia PK</span>
          <div className={styles.domBar} role="img" aria-label={`Udział wejść: ${teamShort} ${Math.round(teamDomPct)}%`}>
            <span className={styles.domBarTeam} style={{ width: `${teamDomPct}%` }} />
            <span className={styles.domBarOpp} style={{ width: `${100 - teamDomPct}%` }} />
          </div>
          <span className={styles.scoreCenterPct}>{Math.round(teamDomPct)}% · {100 - Math.round(teamDomPct)}%</span>
        </div>
        <div className={`${styles.scoreSide} ${styles.scoreSideOpp}`}>
          <span className={styles.scoreName}>{opponentName}</span>
          <span className={styles.scoreXg}>{opponentStats.entries}</span>
          <span className={styles.scoreSub}>{opponentStats.goals} g · {opponentStats.shots} strz.</span>
        </div>
      </div>

      <p className={styles.lead}>
        {halfLabel} · {filterLabel} · <strong>{filteredForStats.length}</strong> wejść
        {matchSummary.regainPct > 0 ? ` · po regainie ${fmt2(matchSummary.regainPct)}%` : ''}
      </p>

      <div className={styles.filterBar}>
        <div className={`${pageStyles.xgHalfSelector} ${styles.selectorInline}`}>
          <ToggleFilterButton active={half === 'all'} onClick={() => setHalf('all')}>Cały mecz</ToggleFilterButton>
          <ToggleFilterButton active={half === 'first'} onClick={() => setHalf('first')}>I połowa</ToggleFilterButton>
          <ToggleFilterButton active={half === 'second'} onClick={() => setHalf('second')}>II połowa</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          {WIEDZA_PK_ENTRY_TYPE_OPTIONS.map(({ value, label }) => (
            <ToggleFilterButton
              key={value}
              active={filters.entryType === value}
              onClick={() => setFilters((prev) => ({ ...prev, entryType: value as WiedzaPkEntryTypeFilter }))}
              variant="metric"
            >
              {label}
            </ToggleFilterButton>
          ))}
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          {WIEDZA_PK_OUTCOME_OPTIONS.map(({ value, label }) => (
            <ToggleFilterButton
              key={`out-${value}`}
              active={filters.outcome === value}
              onClick={() => setFilters((prev) => ({ ...prev, outcome: value as WiedzaPkOutcomeFilter }))}
              variant="metric"
            >
              {label}
            </ToggleFilterButton>
          ))}
        </div>
      </div>

      <div className={styles.viewNav} role="tablist" aria-label="Widoki wejść w PK">
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
                <p className={styles.halfCompareLine}><span className={styles.dotTeam} />{teamShort}: <strong>{teamStats.firstHalf.entries}</strong> wej. · {teamStats.firstHalf.goals} g · {teamStats.firstHalf.shots} strz.</p>
                <p className={styles.halfCompareLine}><span className={styles.dotOpp} />{oppShort}: <strong>{opponentStats.firstHalf.entries}</strong> wej. · {opponentStats.firstHalf.goals} g · {opponentStats.firstHalf.shots} strz.</p>
              </div>
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>II połowa</h4>
                <p className={styles.halfCompareLine}><span className={styles.dotTeam} />{teamShort}: <strong>{teamStats.secondHalf.entries}</strong> wej. · {teamStats.secondHalf.goals} g · {teamStats.secondHalf.shots} strz.</p>
                <p className={styles.halfCompareLine}><span className={styles.dotOpp} />{oppShort}: <strong>{opponentStats.secondHalf.entries}</strong> wej. · {opponentStats.secondHalf.goals} g · {opponentStats.secondHalf.shots} strz.</p>
              </div>
            </div>
          ) : null}

          {cumulativeData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Skumulowane wejścia w PK</h3>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={cumulativeData} margin={{ top: 36, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pkTeamFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAM_BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={TEAM_BLUE} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="pkOppFill" x1="0" y1="0" x2="0" y2="1">
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
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={34} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <ChartTooltip
                          label={`${d.minute}'`}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: `${d.teamEntries} wej. (${d.teamGoals} g)` },
                            { color: TEAM_RED, label: oppShort, value: `${d.opponentEntries} wej. (${d.opponentGoals} g)` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="teamEntries" stroke={TEAM_BLUE} strokeWidth={2.5} fill="url(#pkTeamFill)" name={teamShort} />
                  <Area type="monotone" dataKey="opponentEntries" stroke={TEAM_RED} strokeWidth={2.5} fill="url(#pkOppFill)" name={oppShort} />
                  {renderChartMatchEventMarkers({ points: cumulativeMarkerPoints })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {hasMomentum ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Momentum wejść co 5 minut</h3>
              <p className={styles.chartSubtitle}>Góra: {teamShort} · dół: {oppShort} · kolory = typ wejścia</p>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={momentumData} stackOffset="sign" margin={{ top: 36, right: 8, left: -8, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="minute" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={36} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { teamTotal: number; oppTotal: number };
                      return (
                        <ChartTooltip
                          label={`${label}'`}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: `${d.teamTotal} wej.` },
                            { color: TEAM_RED, label: oppShort, value: `${d.oppTotal} wej.` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="teamPass" stackId="s" fill={ENTRY_TYPE_COLORS.pass} />
                  <Bar dataKey="teamDribble" stackId="s" fill={ENTRY_TYPE_COLORS.dribble} />
                  <Bar dataKey="teamSfg" stackId="s" fill={ENTRY_TYPE_COLORS.sfg} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="oppPassNeg" stackId="s" fill={ENTRY_TYPE_COLORS.pass} fillOpacity={0.55} />
                  <Bar dataKey="oppDribbleNeg" stackId="s" fill={ENTRY_TYPE_COLORS.dribble} fillOpacity={0.55} />
                  <Bar dataKey="oppSfgNeg" stackId="s" fill={ENTRY_TYPE_COLORS.sfg} fillOpacity={0.55} radius={[0, 0, 3, 3]} />
                  {renderChartMatchEventMarkers({ points: momentumMarkerPoints })}
                </ComposedChart>
              </ResponsiveContainer>
              <div className={styles.miniLegend}>
                {[['pass', 'Podanie'], ['dribble', 'Drybling'], ['sfg', 'SFG']].map(([k, label]) => (
                  <span key={k} className={styles.miniLegendItem}>
                    <span className={styles.miniLegendDot} style={{ background: ENTRY_TYPE_COLORS[k] }} />{label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.comparisonBlock}>
            <div className={styles.comparisonTableWrap}>
              <div className={styles.comparisonTable} role="grid" aria-label="Porównanie wejść PK">
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
            {selectedMetric ? <MetricVisualization metric={selectedMetric} teamName={teamName} opponentName={opponentName} /> : null}
          </div>
        </>
      ) : null}

      {view === 'players' ? (
        <>
          {topPlayersBarData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Wkład zawodników — {teamShort}</h3>
              <ResponsiveContainer width="100%" height={Math.max(140, topPlayersBarData.length * 28)}>
                <BarChart data={topPlayersBarData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; entries: number; goals: number };
                      return <ChartTooltip label={d.name} rows={[{ color: TEAM_BLUE, label: 'Wejścia', value: `${d.entries} · ${d.goals} g` }]} />;
                    }}
                  />
                  <Bar dataKey="entries" fill={TEAM_BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <section className={styles.playersSection} aria-labelledby="pk-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="pk-players-title">{teamShort}</h3>
              <span className={styles.sectionMeta}>{sortedPlayers.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    {([
                      ['playerName', 'Zawodnik'],
                      ['entriesSharePct', 'Udział %'],
                      ['entries', 'Wejścia'],
                      ['goals', 'Gole'],
                      ['shots', 'Strzały'],
                      ['regains', 'Po regainie'],
                      ['sfgEntries', 'SFG'],
                      ['shotPct', 'Wej.→strzał'],
                    ] as [PlayerSortCol, string][]).map(([col, label]) => (
                      <th key={col} scope="col" className={styles.sortableTh} onClick={() => togglePlayerSort(col)} tabIndex={0}
                        aria-sort={playerSort.column === col ? (playerSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {label}{playerSort.column === col ? (playerSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.length === 0 ? (
                    <tr><td colSpan={8}>Brak danych.</td></tr>
                  ) : (
                    sortedPlayers.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>
                          <span className={styles.shareCell}>
                            <span className={styles.shareBar} style={{ width: `${Math.min(100, row.entriesSharePct)}%` }} aria-hidden="true" />
                            <span className={styles.shareCellValue}>{Math.round(row.entriesSharePct)}%</span>
                          </span>
                        </td>
                        <td>{row.entries}</td>
                        <td>{row.goals}</td>
                        <td>{row.shots}</td>
                        <td>{row.regains}</td>
                        <td>{row.sfgEntries}</td>
                        <td>{fmt2(row.shotPct)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.playersSection} aria-labelledby="pk-opp-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="pk-opp-players-title">{oppShort}</h3>
              <span className={styles.sectionMeta}>{opponentPlayerRows.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    <th scope="col">Zawodnik</th>
                    <th scope="col">Udział %</th>
                    <th scope="col">Wejścia</th>
                    <th scope="col">Gole</th>
                    <th scope="col">Strzały</th>
                  </tr>
                </thead>
                <tbody>
                  {opponentPlayerRows.length === 0 ? (
                    <tr><td colSpan={5}>Brak danych.</td></tr>
                  ) : (
                    opponentPlayerRows.slice(0, 12).map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{Math.round(row.entriesSharePct)}%</td>
                        <td>{row.entries}</td>
                        <td>{row.goals}</td>
                        <td>{row.shots}</td>
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
          <CombinedDistributionCard title="Typ wejścia" rows={actionGrouped} teamName={teamName} opponentName={opponentName} />
          <CombinedDistributionCard title="Skutek po wejściu" rows={outcomeGrouped} teamName={teamName} opponentName={opponentName} />
          {matchSummary.byEntryType.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Typ wejścia — mecz (%)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={matchSummary.byEntryType.map((r) => ({ name: r.label, value: r.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2}>
                    {matchSummary.byEntryType.map((entry, i) => <Cell key={entry.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => [String(v), 'Wejścia']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      ) : null}

      {view === 'map' ? (
        <>
          {controversialEntries.length > 0 ? (
            <section className={styles.controversialSection} aria-label="Kontrowersyjne wejścia PK">
              <h3 className={styles.playersTitle}>Kontrowersyjne ({controversialEntries.length})</h3>
              <ul className={styles.controversialList}>
                {controversialEntries.map((entry) => (
                  <li key={entry.id}>
                    {entry.minute}&apos; · {entryTypeLabel(entry.entryType)}
                    {entry.controversyNote ? ` — ${entry.controversyNote}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.mapSection} aria-labelledby="pk-map-title">
            <h3 className={styles.mapSectionTitle} id="pk-map-title">Mapa wejść w PK</h3>
            <div className={styles.miniLegend} style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
              <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_RED }} />Podanie</span>
              <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: '#1e40af' }} />Drybling</span>
              <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_GREEN }} />SFG</span>
              <span className={styles.sectionMeta}>{filteredForStats.length} wejść na mapie</span>
            </div>
            <div className={styles.mainLayout}>
              <div className={styles.mapPanel}>
                <PKEntriesPitch
                  pkEntries={filteredForStats}
                  players={players}
                  playersIndex={playersIndex}
                  onEntryClick={handleEntryClick}
                  selectedEntryId={selectedEntryId}
                  matchInfo={matchInfo}
                  allTeams={availableTeams}
                  hideInstructions
                />
              </div>
              <aside className={styles.shotPanel} aria-live="polite">
                {selectedEntry ? (
                  <>
                    <div className={styles.shotPanelHeader}>
                      {canSelectedEntryVideo ? (
                        <button
                          type="button"
                          className={styles.shotPanelMinuteButton}
                          onClick={() => openEntryVideo(selectedEntry)}
                          title="Odtwórz wideo od tego wejścia"
                        >
                          {selectedEntryHalf} {selectedEntry.minute}&apos;
                        </button>
                      ) : (
                        <h4 className={styles.shotPanelTitle}>
                          {selectedEntryHalf} {selectedEntry.minute}&apos;
                          {!hasExternalVideoSource(matchInfo)
                            ? ' · brak wideo'
                            : selectedEntryVideoSec === null
                              ? ' · brak czasu wideo'
                              : ''}
                        </h4>
                      )}
                      <button type="button" className={styles.shotPanelClose} onClick={() => setSelectedEntryId(undefined)} aria-label="Zamknij">×</button>
                    </div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>Typ</span><span className={styles.shotPanelValue}>{entryTypeLabel(selectedEntry.entryType)}</span></div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>Strona</span><span className={styles.shotPanelValue}>{(selectedEntry.teamContext ?? 'attack') === 'attack' ? teamShort : oppShort}</span></div>
                    <div className={styles.shotPanelRow}>
                      <span className={styles.shotPanelLabel}>Skutek</span>
                      <span className={styles.shotPanelValue}>
                        {selectedEntry.isGoal ? 'Gol' : selectedEntry.isShot ? 'Strzał' : '—'}
                      </span>
                    </div>
                    {selectedEntry.isRegain ? (
                      <div className={styles.shotPanelRow}>
                        <span className={styles.shotPanelLabel}>Po regainie</span>
                        <span className={styles.shotPanelValue}>Tak</span>
                      </div>
                    ) : null}
                    {(selectedEntry.senderId || selectedEntry.receiverId) ? (
                      <div className={styles.shotPanelRow}>
                        <span className={styles.shotPanelLabel}>Zawodnicy</span>
                        <span className={styles.shotPanelValue}>
                          {getPlayerLabel(selectedEntry.senderId, playersIndex)}
                          {selectedEntry.receiverId ? ` → ${getPlayerLabel(selectedEntry.receiverId, playersIndex)}` : ''}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>W PK</span><span className={styles.shotPanelValue}>{selectedEntry.pkPlayersCount ?? 0} / {selectedEntry.opponentsInPKCount ?? 0}</span></div>
                  </>
                ) : (
                  <p className={styles.shotPanelEmpty}>Kliknij wejście na mapie, aby zobaczyć szczegóły.</p>
                )}
              </aside>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
