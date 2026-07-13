'use client';

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MatchVideoFloatingPanel from '@/components/MatchVideoFloatingPanel/MatchVideoFloatingPanel';
import XGPitch from '@/components/XGPitch/XGPitch';
import WiedzaShotsMapFiltersPanel, { WiedzaShotsMapLegend } from '@/components/WiedzaShotsTab/WiedzaShotsMapFiltersPanel';
import { getVideoTimestampSeconds } from '@/utils/actionVideoSeekSeconds';
import { hasExternalVideoSource } from '@/utils/externalVideoMatchInfo';
import type { Player, Shot, TeamInfo } from '@/types';
import { getPlayerLabel } from '@/utils/playerUtils';
import type { WiedzaShotBreakdownRow } from '@/utils/wiedzaShotsSummary';
import {
  DEFAULT_WIEDZA_SHOTS_FILTERS,
  filterShotsForWiedzaTab,
  type WiedzaShotsFilterState,
} from '@/utils/wiedzaShotsFilters';
import { filterShotsByMapSide, type TrendyMapSideFilter } from '@/utils/trendyMapFilters';
import { buildXgComparisonMetrics, type XgComparisonMetric } from '@/utils/statystykiZespoluXgComparison';
import {
  buildCumulativeXgChartData,
  buildPlayerXgRows,
  getDefenseShotsFaced,
  buildSideShotsSummary,
  buildSfgBreakdownRows,
  type SfgBreakdownRow,
  buildTeamAndOpponentStats,
  buildXg5MinChartData,
  filterShotsByCategory,
  filterShotsByHalf,
  getSideShots,
  type XgCategoryFilter,
  type XgHalfFilter,
  type XgPlayerRow,
  XG_PER_SHOT_KPI,
} from '@/utils/statystykiZespoluXgStats';
import { getShotLinePlayersCount } from '@/utils/shotLinePlayers';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from './StatystykiZespoluXgTab.module.css';

const TEAM_BLUE = '#2563eb';
const TEAM_RED = '#dc2626';

/** Wspólna paleta kategorii — ten sam kolor po obu stronach, kierunek (góra/dół) rozróżnia zespół. */
const CATEGORY_COLORS: Record<string, string> = {
  open_play: '#3b82f6',
  counter: '#f97316',
  sfg: '#8b5cf6',
  regain: '#10b981',
};

/** Maks. 2 miejsca po przecinku w całej zakładce. */
function fmt2(value: number): string {
  return Number(value).toFixed(2);
}

function chartTick(value: number): string {
  return Number.isInteger(value) ? String(value) : fmt2(value);
}

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt2(value)}`;
}

function shortTeamLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

function actionTypeLabel(actionType?: string): string {
  const map: Record<string, string> = {
    open_play: 'Otwarta gra',
    counter: 'Kontratak',
    corner: 'Rzut rożny',
    free_kick: 'Rzut wolny',
    direct_free_kick: 'Rzut wolny bezpośredni',
    penalty: 'Rzut karny',
    throw_in: 'Wrzut',
    regain: 'Odzyskanie',
  };
  return actionType ? (map[actionType] ?? actionType) : '—';
}

type Props = {
  allShots: Shot[];
  matchInfo: TeamInfo;
  selectedTeam: string;
  teamName: string;
  opponentName: string;
  players: Player[];
  playersIndex: ReturnType<typeof import('@/utils/playerUtils').buildPlayersIndex>;
  availableTeams: Array<{ id: string; name: string; logo?: string }>;
};

type PlayerSortCol = 'playerName' | 'xgSharePct' | 'xg' | 'xgOnTarget' | 'xgMinusGoals' | 'xgPerShot' | 'xgRegain' | 'xgSfg' | 'xgClean' | 'avgLinePlayers';

function xgotColumnTooltip(opponentName: string): string {
  const oppShort = shortTeamLabel(opponentName);
  return `xG OT — suma xG ze strzałów celnych i bramek.\nDla bramkarza: xG celnych strzałów ${oppShort} (strzały w obronie).`;
}

type ComparisonMetric = XgComparisonMetric & {
  teamClassName?: string;
  oppClassName?: string;
};

type XgView = 'overview' | 'players' | 'distributions' | 'map';

type GroupedRow = {
  key: string;
  name: string;
  teamXg: number;
  oppXg: number;
  teamShots: number;
  oppShots: number;
  teamGoals: number;
  oppGoals: number;
};

function mergeBreakdownRows(teamRows: WiedzaShotBreakdownRow[], oppRows: WiedzaShotBreakdownRow[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  const order: string[] = [];
  const ensure = (key: string, label: string) => {
    if (!map.has(key)) {
      map.set(key, { key, name: label, teamXg: 0, oppXg: 0, teamShots: 0, oppShots: 0, teamGoals: 0, oppGoals: 0 });
      order.push(key);
    }
    return map.get(key)!;
  };
  teamRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.teamXg += r.xg;
    g.teamShots += r.count;
    g.teamGoals += r.goals;
  });
  oppRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.oppXg += r.xg;
    g.oppShots += r.count;
    g.oppGoals += r.goals;
  });
  return order.map((k) => map.get(k)!);
}

function mergeSfgRows(teamRows: SfgBreakdownRow[], oppRows: SfgBreakdownRow[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  const order: string[] = [];
  const ensure = (key: string, label: string) => {
    if (!map.has(key)) {
      map.set(key, { key, name: label, teamXg: 0, oppXg: 0, teamShots: 0, oppShots: 0, teamGoals: 0, oppGoals: 0 });
      order.push(key);
    }
    return map.get(key)!;
  };
  teamRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.teamXg += r.xg;
    g.teamShots += r.shots;
  });
  oppRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.oppXg += r.xg;
    g.oppShots += r.shots;
  });
  return order.map((k) => map.get(k)!);
}

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
    <button
      type="button"
      className={toggleButtonClass(variant, active)}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/* ——— Wspólny, nowoczesny tooltip ——— */
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

/* ——— Karta rozkładu: jeden wykres + jedna tabela dla obu zespołów ——— */
function CombinedDistributionCard({
  title,
  subtitle,
  rows,
  teamName,
  opponentName,
  showGoals = true,
}: {
  title: string;
  subtitle?: string;
  rows: GroupedRow[];
  teamName: string;
  opponentName: string;
  showGoals?: boolean;
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
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={chartTick} axisLine={false} tickLine={false} width={32} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(148,163,184,0.10)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as GroupedRow;
              return (
                <ChartTooltip
                  label={d.name}
                  rows={[
                    { color: TEAM_BLUE, label: teamShort, value: `${fmt2(d.teamXg)} xG · ${d.teamShots} strz.${showGoals ? ` · ${d.teamGoals} g` : ''}` },
                    { color: TEAM_RED, label: oppShort, value: `${fmt2(d.oppXg)} xG · ${d.oppShots} strz.${showGoals ? ` · ${d.oppGoals} g` : ''}` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="teamXg" name={teamShort} fill={TEAM_BLUE} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="oppXg" name={oppShort} fill={TEAM_RED} radius={[4, 4, 0, 0]} maxBarSize={26} fillOpacity={0.85} />
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
              <th scope="col" className={styles.thTeam}>{teamShort} (n · xG{showGoals ? ' · g' : ''})</th>
              <th scope="col" className={styles.thOpp}>{oppShort} (n · xG{showGoals ? ' · g' : ''})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td className={styles.tdTeam}>{r.teamShots} · {fmt2(r.teamXg)}{showGoals ? ` · ${r.teamGoals}` : ''}</td>
                <td className={styles.tdOpp}>{r.oppShots} · {fmt2(r.oppXg)}{showGoals ? ` · ${r.oppGoals}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ——— Wizualizacja wybranego wskaźnika porównawczego ——— */
type ShareComparison = {
  teamSharePct: number;
  oppSharePct: number;
  leader: 'team' | 'opp' | 'tie';
};

function buildShareComparison(teamValue: number, oppValue: number): ShareComparison | null {
  const total = teamValue + oppValue;
  if (total <= 0) return null;
  const teamSharePct = (teamValue / total) * 100;
  const oppSharePct = (oppValue / total) * 100;
  return {
    teamSharePct,
    oppSharePct,
    leader: teamSharePct > oppSharePct + 0.05 ? 'team' : oppSharePct > teamSharePct + 0.05 ? 'opp' : 'tie',
  };
}

function ShareDonutVisualization({
  metric,
  teamName,
  opponentName,
}: {
  metric: ComparisonMetric;
  teamName: string;
  opponentName: string;
}) {
  const share = buildShareComparison(metric.teamValue, metric.oppValue);
  const diff = metric.teamValue - metric.oppValue;

  const pieData = share
    ? [
        { name: teamName, value: metric.teamValue, fill: TEAM_BLUE, sharePct: share.teamSharePct },
        { name: opponentName, value: metric.oppValue, fill: TEAM_RED, sharePct: share.oppSharePct },
      ]
    : [];

  return (
    <>
      <div className={styles.donutWrap} role="img" aria-label={`Udział ${teamName} ${share ? `${Math.round(share.teamSharePct)}%` : 'brak'} vs ${opponentName}`}>
        {share ? (
          <>
            <ResponsiveContainer width="100%" height={168}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={78}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const payload = item?.payload as { sharePct?: number; name?: string } | undefined;
                    const display =
                      metric.unit === 'int'
                        ? String(Math.round(value))
                        : metric.unit === 'pct'
                          ? `${fmt2(value)}%`
                          : fmt2(value);
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

      {metric.showKpiLine ? (
        <p className={styles.metricVizKpi}>KPI xG/strzał: {fmt2(XG_PER_SHOT_KPI)}</p>
      ) : null}

      <p className={styles.metricVizLead}>
        Δ <span className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : styles.neutral}>{formatSigned(diff)}</span>
      </p>
    </>
  );
}

function SignedDivergingVisualization({
  metric,
  teamName,
  opponentName,
}: {
  metric: ComparisonMetric;
  teamName: string;
  opponentName: string;
}) {
  const maxAbs = Math.max(Math.abs(metric.teamValue), Math.abs(metric.oppValue), 0.05);
  const teamPos = ((metric.teamValue + maxAbs) / (maxAbs * 2)) * 100;
  const oppPos = ((metric.oppValue + maxAbs) / (maxAbs * 2)) * 100;
  const diff = metric.teamValue - metric.oppValue;

  return (
    <>
      <div className={styles.signedTrackWrap} role="img" aria-label={`${teamName} ${metric.teamDisplay}, ${opponentName} ${metric.oppDisplay}`}>
        <div className={styles.signedTrack}>
          <span className={styles.signedTrackZero} aria-hidden="true" />
          <span
            className={`${styles.signedMarker} ${styles.signedMarkerTeam}`}
            style={{ left: `${teamPos}%` }}
            title={`${teamName}: ${metric.teamDisplay}`}
          />
          <span
            className={`${styles.signedMarker} ${styles.signedMarkerOpp}`}
            style={{ left: `${oppPos}%` }}
            title={`${opponentName}: ${metric.oppDisplay}`}
          />
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
          <strong className={metric.teamClassName}>{metric.teamDisplay}</strong>
        </span>
        <span className={styles.donutLegendItem}>
          <span className={styles.donutLegendDot} style={{ background: TEAM_RED }} />
          <span className={styles.donutLegendName}>{shortTeamLabel(opponentName)}</span>
          <strong className={metric.oppClassName}>{metric.oppDisplay}</strong>
        </span>
      </div>
      <p className={styles.metricVizHint}>Niżej = lepsza realizacja xG (więcej bramek niż oczekiwano)</p>
      <p className={styles.metricVizLead}>
        Δ <span className={diff > 0 ? styles.positive : diff < 0 ? styles.negative : styles.neutral}>{formatSigned(diff)}</span>
      </p>
    </>
  );
}

function MetricVisualization({
  metric,
  teamName,
  opponentName,
}: {
  metric: ComparisonMetric;
  teamName: string;
  opponentName: string;
}) {
  return (
    <div className={styles.metricVizCard} aria-live="polite">
      <h4 className={styles.metricVizTitle}>{typeof metric.label === 'string' ? metric.label : 'Wskaźnik'}</h4>
      {metric.hint && !metric.signedValues ? <p className={styles.metricVizHint}>{metric.hint}</p> : null}
      {metric.signedValues ? (
        <SignedDivergingVisualization metric={metric} teamName={teamName} opponentName={opponentName} />
      ) : (
        <ShareDonutVisualization metric={metric} teamName={teamName} opponentName={opponentName} />
      )}
    </div>
  );
}

export default function StatystykiZespoluXgTab({
  allShots,
  matchInfo,
  selectedTeam,
  teamName,
  opponentName,
  players,
  playersIndex,
  availableTeams,
}: Props) {
  const [view, setView] = useState<XgView>('overview');
  const [half, setHalf] = useState<XgHalfFilter>('all');
  const [category, setCategory] = useState<XgCategoryFilter>('all');
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [wiedzaMapFilters, setWiedzaMapFilters] = useState<WiedzaShotsFilterState>(DEFAULT_WIEDZA_SHOTS_FILTERS);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [hasVideoPanel, setHasVideoPanel] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [videoSeekTargetSeconds, setVideoSeekTargetSeconds] = useState<number | null>(null);
  const [videoSeekRequestId, setVideoSeekRequestId] = useState(0);
  const [mapSide, setMapSide] = useState<TrendyMapSideFilter>('all');
  const [selectedMetricKey, setSelectedMetricKey] = useState('total_xg');
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({
    column: 'xg',
    dir: 'desc',
  });

  const filteredForStats = useMemo(() => {
    let shots = filterShotsByHalf(allShots, half);
    shots = filterShotsByCategory(shots, category);
    return shots;
  }, [allShots, half, category]);

  const { teamStats, opponentStats } = useMemo(
    () => buildTeamAndOpponentStats(filteredForStats, matchInfo, selectedTeam, half),
    [filteredForStats, matchInfo, selectedTeam, half],
  );

  const teamShots = useMemo(
    () => getSideShots(filteredForStats, matchInfo, selectedTeam, 'team'),
    [filteredForStats, matchInfo, selectedTeam],
  );
  const opponentShots = useMemo(
    () => getSideShots(filteredForStats, matchInfo, selectedTeam, 'opponent'),
    [filteredForStats, matchInfo, selectedTeam],
  );

  const teamSummary = useMemo(
    () => buildSideShotsSummary(filteredForStats, matchInfo, selectedTeam, 'team'),
    [filteredForStats, matchInfo, selectedTeam],
  );
  const opponentSummary = useMemo(
    () => buildSideShotsSummary(filteredForStats, matchInfo, selectedTeam, 'opponent'),
    [filteredForStats, matchInfo, selectedTeam],
  );

  const povShots = useMemo(
    () => filterShotsByMapSide(filteredForStats, mapSide),
    [filteredForStats, mapSide],
  );

  const mapShots = useMemo(
    () => filterShotsForWiedzaTab(povShots, wiedzaMapFilters),
    [povShots, wiedzaMapFilters],
  );

  const controversialShots = useMemo(
    () => filteredForStats.filter((shot) => shot.isControversial),
    [filteredForStats],
  );

  const openShotVideo = useCallback(
    (shot: Shot) => {
      const videoSec = getVideoTimestampSeconds(shot);
      if (!hasExternalVideoSource(matchInfo)) {
        toast.error('Brak wideo dla tego meczu.');
        return false;
      }
      if (videoSec === null) {
        toast.error('Brak znacznika czasu wideo dla tego strzału.');
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

  const handleShotClick = useCallback(
    (shot: Shot) => {
      setSelectedShot(shot);
      openShotVideo(shot);
    },
    [openShotVideo],
  );

  const selectedShotHalf = selectedShot ? (selectedShot.minute > 45 ? 'II' : 'I') : null;
  const selectedShotVideoSec = selectedShot ? getVideoTimestampSeconds(selectedShot) : null;
  const canSelectedShotVideo = Boolean(
    selectedShot && hasExternalVideoSource(matchInfo) && selectedShotVideoSec !== null,
  );

  const teamDefenseShotsFaced = useMemo(
    () => getDefenseShotsFaced(filteredForStats, matchInfo, selectedTeam, 'team'),
    [filteredForStats, matchInfo, selectedTeam],
  );
  const opponentDefenseShotsFaced = useMemo(
    () => getDefenseShotsFaced(filteredForStats, matchInfo, selectedTeam, 'opponent'),
    [filteredForStats, matchInfo, selectedTeam],
  );

  const playerRows = useMemo(
    () => buildPlayerXgRows(teamShots, teamStats.xg, (id) => getPlayerLabel(id, playersIndex), teamDefenseShotsFaced),
    [teamShots, teamStats.xg, playersIndex, teamDefenseShotsFaced],
  );
  const opponentPlayerRows = useMemo(
    () => buildPlayerXgRows(opponentShots, opponentStats.xg, (id) => getPlayerLabel(id, playersIndex), opponentDefenseShotsFaced),
    [opponentShots, opponentStats.xg, playersIndex, opponentDefenseShotsFaced],
  );

  const teamSfgRows = useMemo(() => buildSfgBreakdownRows(teamStats), [teamStats]);
  const opponentSfgRows = useMemo(() => buildSfgBreakdownRows(opponentStats), [opponentStats]);

  const sortedPlayers = useMemo(() => {
    const col = playerSort.column;
    const dir = playerSort.dir;
    return [...playerRows].sort((a, b) => {
      if (col === 'playerName') {
        const cmp = a.playerName.localeCompare(b.playerName);
        return dir === 'asc' ? cmp : -cmp;
      }
      if (col === 'xgMinusGoals') {
        const va = a.xg - a.goals;
        const vb = b.xg - b.goals;
        return dir === 'asc' ? va - vb : vb - va;
      }
      const va = Number(a[col as keyof XgPlayerRow]) || 0;
      const vb = Number(b[col as keyof XgPlayerRow]) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [playerRows, playerSort]);

  const cumulativeData = useMemo(
    () => buildCumulativeXgChartData(filteredForStats, matchInfo, selectedTeam),
    [filteredForStats, matchInfo, selectedTeam],
  );

  const intervalData = useMemo(
    () => buildXg5MinChartData(filteredForStats, matchInfo, selectedTeam),
    [filteredForStats, matchInfo, selectedTeam],
  );

  /** Momentum diverging: zespół w górę (dodatnie), przeciwnik w dół (ujemne); kolory wspólne per kategoria. */
  const momentumData = useMemo(() => {
    const rows = intervalData.map((d) => ({
      minute: d.minute,
      teamOpenPlay: d.teamOpenPlay,
      teamCounter: d.teamCounter,
      teamSfg: d.teamSfg,
      teamRegain: d.teamRegain,
      oppOpenPlay: -d.opponentOpenPlay,
      oppCounter: -d.opponentCounter,
      oppSfg: -d.opponentSfg,
      oppRegain: -d.opponentRegain,
      teamTotal: d.teamXG,
      oppTotal: d.opponentXG,
    }));
    let start = 0;
    let end = rows.length - 1;
    while (start < rows.length && rows[start].teamTotal === 0 && rows[start].oppTotal === 0) start += 1;
    while (end > start && rows[end].teamTotal === 0 && rows[end].oppTotal === 0) end -= 1;
    return rows.slice(start, end + 1);
  }, [intervalData]);

  const hasMomentum = momentumData.some((d) => d.teamTotal > 0 || d.oppTotal > 0);

  const topPlayersBarData = useMemo(
    () => sortedPlayers.slice(0, 8).map((p) => ({ name: p.playerName.split(' ').pop() ?? p.playerName, xg: p.xg, shots: p.shots })),
    [sortedPlayers],
  );

  const actionGrouped = useMemo(
    () => mergeBreakdownRows(teamSummary.byActionCategory, opponentSummary.byActionCategory),
    [teamSummary.byActionCategory, opponentSummary.byActionCategory],
  );
  const shotTypeGrouped = useMemo(
    () => mergeBreakdownRows(teamSummary.byShotType, opponentSummary.byShotType),
    [teamSummary.byShotType, opponentSummary.byShotType],
  );
  const bodyPartGrouped = useMemo(
    () => mergeBreakdownRows(teamSummary.byBodyPart, opponentSummary.byBodyPart),
    [teamSummary.byBodyPart, opponentSummary.byBodyPart],
  );
  const bucketGrouped = useMemo(
    () => mergeBreakdownRows(teamSummary.byXgBucket, opponentSummary.byXgBucket),
    [teamSummary.byXgBucket, opponentSummary.byXgBucket],
  );
  const sfgGrouped = useMemo(() => mergeSfgRows(teamSfgRows, opponentSfgRows), [teamSfgRows, opponentSfgRows]);

  const comparisonMetrics = useMemo((): ComparisonMetric[] => {
    return buildXgComparisonMetrics(teamStats, opponentStats, fmt2, formatSigned).map((row) => {
      if (row.key === 'xg_diff') {
        return {
          ...row,
          teamClassName: teamStats.xgDiff > 0 ? styles.negative : teamStats.xgDiff < 0 ? styles.positive : undefined,
          oppClassName: opponentStats.xgDiff > 0 ? styles.negative : opponentStats.xgDiff < 0 ? styles.positive : undefined,
        };
      }
      if (row.key === 'xg_per_shot') {
        return {
          ...row,
          teamClassName: teamStats.xgPerShot >= XG_PER_SHOT_KPI ? styles.positive : styles.negative,
        };
      }
      return row;
    });
  }, [teamStats, opponentStats]);

  const KEY_METRIC_KEYS = ['total_xg', 'xg_dominance', 'efficiency', 'conversion', 'xg_per_shot', 'xg_diff'];
  const visibleMetrics = useMemo(
    () => (showAllMetrics ? comparisonMetrics : comparisonMetrics.filter((m) => KEY_METRIC_KEYS.includes(m.key))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparisonMetrics, showAllMetrics],
  );

  const selectedMetric = comparisonMetrics.find((m) => m.key === selectedMetricKey) ?? comparisonMetrics[0];

  const halfLabel = half === 'all' ? 'cały mecz' : half === 'first' ? 'I połowa' : 'II połowa';
  const categoryLabel = category === 'all' ? 'wszystkie akcje' : category === 'sfg' ? 'xG SFG' : 'xG otwarta gra';
  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const xgotTooltip = xgotColumnTooltip(opponentName);

  const xgTotal = teamStats.xg + opponentStats.xg;
  const teamDomPct = xgTotal > 0 ? (teamStats.xg / xgTotal) * 100 : 50;

  const togglePlayerSort = (column: PlayerSortCol) => {
    setPlayerSort((prev) => ({
      column,
      dir: prev.column === column && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (allShots.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        Brak strzałów w wybranym meczu.
      </div>
    );
  }

  const VIEW_TABS: Array<{ id: XgView; label: string }> = [
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

      {/* —— Scoreboard: najważniejsze liczby na górze —— */}
      <div className={styles.scoreboard}>
        <div className={`${styles.scoreSide} ${styles.scoreSideTeam}`}>
          <span className={styles.scoreName}>{teamName}</span>
          <span className={styles.scoreXg}>{fmt2(teamStats.xg)}</span>
          <span className={styles.scoreSub}>{teamStats.goals} g · {teamStats.shots} strz.</span>
        </div>
        <div className={styles.scoreCenter}>
          <span className={styles.scoreCenterLabel}>xG</span>
          <div className={styles.domBar} role="img" aria-label={`Udział xG: ${teamShort} ${Math.round(teamDomPct)}%`}>
            <span className={styles.domBarTeam} style={{ width: `${teamDomPct}%` }} />
            <span className={styles.domBarOpp} style={{ width: `${100 - teamDomPct}%` }} />
          </div>
          <span className={styles.scoreCenterPct}>{Math.round(teamDomPct)}% · {100 - Math.round(teamDomPct)}%</span>
        </div>
        <div className={`${styles.scoreSide} ${styles.scoreSideOpp}`}>
          <span className={styles.scoreName}>{opponentName}</span>
          <span className={styles.scoreXg}>{fmt2(opponentStats.xg)}</span>
          <span className={styles.scoreSub}>{opponentStats.goals} g · {opponentStats.shots} strz.</span>
        </div>
      </div>

      <p className={styles.lead}>
        {halfLabel} · {categoryLabel} · <strong>{filteredForStats.length}</strong> strzałów
      </p>

      {/* —— Filtry —— */}
      <div className={styles.filterBar}>
        <div className={`${pageStyles.xgHalfSelector} ${styles.selectorInline}`}>
          <ToggleFilterButton active={half === 'all'} onClick={() => setHalf('all')}>Cały mecz</ToggleFilterButton>
          <ToggleFilterButton active={half === 'first'} onClick={() => setHalf('first')}>I połowa</ToggleFilterButton>
          <ToggleFilterButton active={half === 'second'} onClick={() => setHalf('second')}>II połowa</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={category === 'all'} onClick={() => setCategory('all')}>Wszystkie</ToggleFilterButton>
          <ToggleFilterButton active={category === 'sfg'} onClick={() => setCategory('sfg')}>xG SFG</ToggleFilterButton>
          <ToggleFilterButton active={category === 'open_play'} onClick={() => setCategory('open_play')}>Otwarta gra</ToggleFilterButton>
        </div>
      </div>

      {/* —— Nawigacja widoków —— */}
      <div className={styles.viewNav} role="tablist" aria-label="Widoki statystyk xG">
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

      {/* ====================== PRZEGLĄD ====================== */}
      {view === 'overview' ? (
        <>
          {half === 'all' ? (
            <div className={styles.halfCompareGrid} aria-label="Porównanie połów">
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>I połowa</h4>
                <p className={styles.halfCompareLine}><span className={styles.dotTeam} />{teamShort}: xG <strong>{fmt2(teamStats.firstHalf.xg)}</strong> · {teamStats.firstHalf.goals} g · {teamStats.firstHalf.shots} strz.</p>
                <p className={styles.halfCompareLine}><span className={styles.dotOpp} />{oppShort}: xG <strong>{fmt2(opponentStats.firstHalf.xg)}</strong> · {opponentStats.firstHalf.goals} g · {opponentStats.firstHalf.shots} strz.</p>
              </div>
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>II połowa</h4>
                <p className={styles.halfCompareLine}><span className={styles.dotTeam} />{teamShort}: xG <strong>{fmt2(teamStats.secondHalf.xg)}</strong> · {teamStats.secondHalf.goals} g · {teamStats.secondHalf.shots} strz.</p>
                <p className={styles.halfCompareLine}><span className={styles.dotOpp} />{oppShort}: xG <strong>{fmt2(opponentStats.secondHalf.xg)}</strong> · {opponentStats.secondHalf.goals} g · {opponentStats.secondHalf.shots} strz.</p>
              </div>
            </div>
          ) : null}

          {cumulativeData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Skumulowane xG</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cumulativeData} margin={{ top: 6, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="xgTeamFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAM_BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={TEAM_BLUE} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="xgOppFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAM_RED} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={TEAM_RED} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={chartTick} axisLine={false} tickLine={false} width={34} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <ChartTooltip
                          label={`${d.minute}'`}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: `${fmt2(d.teamXG)} (${d.teamGoals} g)` },
                            { color: TEAM_RED, label: oppShort, value: `${fmt2(d.opponentXG)} (${d.opponentGoals} g)` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="teamXG" stroke={TEAM_BLUE} strokeWidth={2.5} fill="url(#xgTeamFill)" name={teamShort} />
                  <Area type="monotone" dataKey="opponentXG" stroke={TEAM_RED} strokeWidth={2.5} fill="url(#xgOppFill)" name={oppShort} />
                </AreaChart>
              </ResponsiveContainer>
              <div className={styles.miniLegend}>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_BLUE }} />{teamShort}</span>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: TEAM_RED }} />{oppShort}</span>
              </div>
            </div>
          ) : null}

          {hasMomentum ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Momentum xG co 5 minut</h3>
              <p className={styles.chartSubtitle}>Góra: {teamShort} · dół: {oppShort} · kolory = rodzaj akcji</p>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={momentumData} stackOffset="sign" margin={{ top: 4, right: 8, left: -8, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="minute" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" height={36} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v: number) => chartTick(Math.abs(v))} axisLine={false} tickLine={false} width={34} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { teamTotal: number; oppTotal: number };
                      return (
                        <ChartTooltip
                          label={`${label}'`}
                          rows={[
                            { color: TEAM_BLUE, label: teamShort, value: `${fmt2(d.teamTotal)} xG` },
                            { color: TEAM_RED, label: oppShort, value: `${fmt2(d.oppTotal)} xG` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="teamOpenPlay" stackId="s" fill={CATEGORY_COLORS.open_play} />
                  <Bar dataKey="teamCounter" stackId="s" fill={CATEGORY_COLORS.counter} />
                  <Bar dataKey="teamSfg" stackId="s" fill={CATEGORY_COLORS.sfg} />
                  <Bar dataKey="teamRegain" stackId="s" fill={CATEGORY_COLORS.regain} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="oppOpenPlay" stackId="s" fill={CATEGORY_COLORS.open_play} fillOpacity={0.55} />
                  <Bar dataKey="oppCounter" stackId="s" fill={CATEGORY_COLORS.counter} fillOpacity={0.55} />
                  <Bar dataKey="oppSfg" stackId="s" fill={CATEGORY_COLORS.sfg} fillOpacity={0.55} />
                  <Bar dataKey="oppRegain" stackId="s" fill={CATEGORY_COLORS.regain} fillOpacity={0.55} radius={[0, 0, 3, 3]} />
                </BarChart>
              </ResponsiveContainer>
              <div className={styles.miniLegend}>
                {[['open_play', 'Otwarta gra'], ['counter', 'Kontra'], ['sfg', 'SFG'], ['regain', 'Regain']].map(([k, label]) => (
                  <span key={k} className={styles.miniLegendItem}>
                    <span className={styles.miniLegendDot} style={{ background: CATEGORY_COLORS[k] }} />{label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tabela porównawcza + wizualizacja wybranego wiersza */}
          <div className={styles.comparisonBlock}>
            <div className={styles.comparisonTableWrap}>
              <div className={styles.comparisonTable} role="grid" aria-label="Porównanie xG — kliknij wiersz, aby zmienić wykres">
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
                    aria-label={`${typeof row.label === 'string' ? row.label : row.key}: ${row.teamDisplay} vs ${row.oppDisplay}`}
                  >
                    <span className={styles.comparisonMetric} role="cell">
                      {row.label}
                      {row.hint ? <span className={styles.comparisonMetricHint}>{row.hint}</span> : null}
                    </span>
                    <span className={`${styles.comparisonValue} ${styles.comparisonValueTeam} ${row.teamClassName ?? ''}`} role="cell">{row.teamDisplay}</span>
                    <span className={`${styles.comparisonValue} ${styles.comparisonValueOpp} ${row.oppClassName ?? ''}`} role="cell">{row.oppDisplay}</span>
                  </button>
                ))}
              </div>
              <button type="button" className={styles.showMoreButton} onClick={() => setShowAllMetrics((v) => !v)}>
                {showAllMetrics ? 'Pokaż mniej wskaźników' : `Pokaż wszystkie wskaźniki (${comparisonMetrics.length})`}
              </button>
            </div>
            {selectedMetric ? (
              <MetricVisualization metric={selectedMetric} teamName={teamName} opponentName={opponentName} />
            ) : null}
          </div>
        </>
      ) : null}

      {/* ====================== ZAWODNICY ====================== */}
      {view === 'players' ? (
        <>
          {topPlayersBarData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Wkład zawodników (xG) — {teamShort}</h3>
              <ResponsiveContainer width="100%" height={Math.max(140, topPlayersBarData.length * 28)}>
                <BarChart data={topPlayersBarData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={chartTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; xg: number; shots: number };
                      return <ChartTooltip label={d.name} rows={[{ color: TEAM_BLUE, label: 'xG', value: `${fmt2(d.xg)} · ${d.shots} strz.` }]} />;
                    }}
                  />
                  <Bar dataKey="xg" fill={TEAM_BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <section className={styles.playersSection} aria-labelledby="xg-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="xg-players-title">{teamShort}</h3>
              <span className={styles.sectionMeta}>{sortedPlayers.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    {([
                      ['playerName', 'Zawodnik', undefined],
                      ['xgSharePct', 'Udział %', undefined],
                      ['xg', 'xG', undefined],
                      ['xgOnTarget', 'xG OT', xgotTooltip],
                      ['xgMinusGoals', 'xG − g', undefined],
                      ['xgPerShot', 'xG / strzał', undefined],
                      ['xgClean', 'Clean xG', undefined],
                      ['avgLinePlayers', 'Linia', undefined],
                      ['xgRegain', 'xG Regain', undefined],
                      ['xgSfg', 'xG SFG', undefined],
                    ] as [PlayerSortCol, string, string | undefined][]).map(([col, label, tooltip]) => (
                      <th
                        key={col}
                        scope="col"
                        className={styles.sortableTh}
                        onClick={() => togglePlayerSort(col)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlayerSort(col); } }}
                        tabIndex={0}
                        aria-sort={playerSort.column === col ? (playerSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        title={tooltip}
                      >
                        {tooltip ? (
                          <span className={styles.tooltipTrigger} data-tooltip={tooltip}>{label}</span>
                        ) : (
                          label
                        )}
                        {playerSort.column === col ? (playerSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.length === 0 ? (
                    <tr><td colSpan={10}>Brak danych.</td></tr>
                  ) : (
                    sortedPlayers.map((row) => {
                      const xgMinusGoals = row.xg - row.goals;
                      return (
                        <tr key={row.playerId}>
                          <td>{row.playerName}</td>
                          <td>
                            <span className={styles.shareCell}>
                              <span className={styles.shareBar} style={{ width: `${Math.min(100, row.xgSharePct)}%` }} aria-hidden="true" />
                              <span className={styles.shareCellValue}>{Math.round(row.xgSharePct)}%</span>
                            </span>
                          </td>
                          <td>{fmt2(row.xg)} ({row.shots})</td>
                          <td title={xgotTooltip}>{fmt2(row.xgOnTarget)} ({row.shotsOnTarget} celn.)</td>
                          <td className={xgMinusGoals >= 0 ? styles.negative : styles.positive}>{formatSigned(xgMinusGoals)}</td>
                          <td className={row.xgPerShot >= XG_PER_SHOT_KPI ? styles.positive : styles.negative}>{fmt2(row.xgPerShot)}</td>
                          <td>{fmt2(row.xgClean)}</td>
                          <td>{fmt2(row.avgLinePlayers)}</td>
                          <td>{fmt2(row.xgRegain)}</td>
                          <td>{fmt2(row.xgSfg)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.playersSection} aria-labelledby="xg-opponent-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="xg-opponent-players-title">{oppShort}</h3>
              <span className={styles.sectionMeta}>{opponentPlayerRows.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    <th scope="col">Zawodnik</th>
                    <th scope="col">Udział %</th>
                    <th scope="col">xG</th>
                    <th scope="col" title={xgotTooltip}>
                      <span className={styles.tooltipTrigger} data-tooltip={xgotTooltip}>xG OT</span>
                    </th>
                    <th scope="col">xG − g</th>
                    <th scope="col">xG / strzał</th>
                  </tr>
                </thead>
                <tbody>
                  {opponentPlayerRows.length === 0 ? (
                    <tr><td colSpan={6}>Brak danych.</td></tr>
                  ) : (
                    opponentPlayerRows.slice(0, 12).map((row) => {
                      const xgMinusGoals = row.xg - row.goals;
                      return (
                        <tr key={row.playerId}>
                          <td>{row.playerName}</td>
                          <td>{Math.round(row.xgSharePct)}%</td>
                          <td>{fmt2(row.xg)} ({row.shots})</td>
                          <td title={xgotTooltip}>{fmt2(row.xgOnTarget)} ({row.shotsOnTarget} celn.)</td>
                          <td className={xgMinusGoals >= 0 ? styles.negative : styles.positive}>{formatSigned(xgMinusGoals)}</td>
                          <td>{fmt2(row.xgPerShot)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {/* ====================== ROZKŁADY ====================== */}
      {view === 'distributions' ? (
        <div className={styles.chartsGrid}>
          <CombinedDistributionCard title="Rodzaj akcji" rows={actionGrouped} teamName={teamName} opponentName={opponentName} />
          <CombinedDistributionCard title="Typ strzału" rows={shotTypeGrouped} teamName={teamName} opponentName={opponentName} />
          <CombinedDistributionCard title="Przedziały xG" subtitle="Σ xG w przedziale prawdopodobieństwa" rows={bucketGrouped} teamName={teamName} opponentName={opponentName} />
          <CombinedDistributionCard title="Część ciała" rows={bodyPartGrouped} teamName={teamName} opponentName={opponentName} />
          <CombinedDistributionCard title="SFG — stałe fragmenty gry" rows={sfgGrouped} teamName={teamName} opponentName={opponentName} showGoals={false} />
        </div>
      ) : null}

      {/* ====================== MAPA ====================== */}
      {view === 'map' ? (
        <>
          {controversialShots.length > 0 ? (
            <section className={styles.controversialSection} aria-label="Strzały kontrowersyjne">
              <h3 className={styles.playersTitle}>Strzały kontrowersyjne ({controversialShots.length})</h3>
              <ul className={styles.controversialList}>
                {controversialShots.map((shot) => (
                  <li key={shot.id}>
                    {shot.minute}&apos; · xG {fmt2(Number(shot.xG))} · {getPlayerLabel(shot.playerId, playersIndex)}
                    {shot.controversyNote ? ` — ${shot.controversyNote}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.mapSection} aria-labelledby="xg-map-title">
            <h3 className={styles.mapSectionTitle} id="xg-map-title">Mapa strzałów</h3>

            <WiedzaShotsMapFiltersPanel
              filters={wiedzaMapFilters}
              onChange={setWiedzaMapFilters}
              mapSide={mapSide}
              onMapSideChange={setMapSide}
            />

            <div className={styles.mainLayout}>
              <div className={styles.mapPanel}>
                <XGPitch
                  shots={mapShots}
                  onShotAdd={() => {}}
                  players={players}
                  onShotClick={handleShotClick}
                  selectedShotId={selectedShot?.id}
                  matchInfo={matchInfo}
                  allTeams={availableTeams}
                  hideToggleButton
                />
                <WiedzaShotsMapLegend
                  filteredCount={mapShots.length}
                  totalCount={povShots.length}
                  countLabel="strona POV"
                  className={styles.mapLegend}
                />
              </div>
              <aside className={styles.shotPanel} aria-live="polite">
                {selectedShot ? (
                  <>
                    <div className={styles.shotPanelHeader}>
                      {canSelectedShotVideo ? (
                        <button
                          type="button"
                          className={styles.shotPanelMinuteButton}
                          onClick={() => openShotVideo(selectedShot)}
                          title="Odtwórz wideo od tego strzału"
                        >
                          {selectedShotHalf} {selectedShot.minute}&apos;
                        </button>
                      ) : (
                        <h4 className={styles.shotPanelTitle}>
                          {selectedShotHalf} {selectedShot.minute}&apos;
                          {!hasExternalVideoSource(matchInfo)
                            ? ' · brak wideo'
                            : selectedShotVideoSec === null
                              ? ' · brak czasu wideo'
                              : ''}
                        </h4>
                      )}
                      <button type="button" className={styles.shotPanelClose} onClick={() => setSelectedShot(null)} aria-label="Zamknij">×</button>
                    </div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>Zawodnik</span><span className={styles.shotPanelValue}>{getPlayerLabel(selectedShot.playerId, playersIndex)}</span></div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>xG</span><span className={styles.shotPanelValue}>{fmt2(Number(selectedShot.xG))}</span></div>
                    <div className={styles.shotPanelRow}>
                      <span className={styles.shotPanelLabel}>Wynik</span>
                      <span className={styles.shotPanelValue}>
                        {selectedShot.isGoal ? 'Gol' : selectedShot.shotType === 'on_target' ? 'Celny' : selectedShot.shotType === 'off_target' ? 'Niecelny' : selectedShot.shotType === 'blocked' ? 'Zablokowany' : '—'}
                      </span>
                    </div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>Akcja</span><span className={styles.shotPanelValue}>{actionTypeLabel(selectedShot.actionType)}</span></div>
                    <div className={styles.shotPanelRow}><span className={styles.shotPanelLabel}>Na linii</span><span className={styles.shotPanelValue}>{getShotLinePlayersCount(selectedShot)}</span></div>
                  </>
                ) : (
                  <p className={styles.shotPanelEmpty}>Kliknij strzał na mapie, aby zobaczyć szczegóły.</p>
                )}
              </aside>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
