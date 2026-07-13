'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TeamInfo } from '@/types';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from '../StatystykiZespoluXgTab/StatystykiZespoluXgTab.module.css';
import {
  buildGpsHalfCompare,
  buildGpsPlayerRows,
  buildGpsPositionBreakdown,
  buildGpsTeamStats,
  buildGpsTopPlayersChartData,
  formatGpsDistance,
  formatGpsNum,
  getAvailableGpsPositions,
  getGpsMetricSharePct,
  GPS_CHART_METRICS,
  type GpsChartMetricKey,
  type GpsMatchDayEntry,
  type GpsPeriod,
  type GpsPlayerRow,
  type GpsValueMode,
} from '@/utils/statystykiZespoluGpsStats';

const TEAM_BLUE = '#2563eb';
const INTENSITY_COLORS = {
  hsr: '#3b82f6',
  sprintDistance: '#f97316',
  hmlDistance: '#8b5cf6',
  acc56: '#10b981',
  dec56: '#ef4444',
};

const POSITION_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#be123c'];

type GpsView = 'overview' | 'players' | 'distributions' | 'table';
type PlayerSortCol = GpsChartMetricKey | 'playerName' | 'minutes' | 'position';

type Props = {
  gpsData: GpsMatchDayEntry[];
  matchInfo: TeamInfo;
  teamName: string;
  isLoading?: boolean;
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

function ChartTooltip({ rows, label }: { rows: Array<{ color: string; label: string; value: string }>; label?: string }) {
  return (
    <div className={styles.tooltip}>
      {label ? <p className={styles.tooltipLabel}>{label}</p> : null}
      {rows.map((row) => (
        <p key={row.label} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: row.color }} aria-hidden />
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </p>
      ))}
    </div>
  );
}

function formatMetricValue(metric: GpsChartMetricKey, value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (metric === 'totalDistance' || metric === 'hsr' || metric === 'sprintDistance' || metric === 'hmlDistance') {
    return formatGpsDistance(value);
  }
  if (metric === 'maxSpeed') return `${formatGpsNum(value)} km/h`;
  if (metric === 'distancePerMin') return `${formatGpsNum(value)} m/min`;
  return formatGpsNum(value);
}

function shortPositionLabel(position: string): string {
  return position === 'Skrzydłowi' ? 'W' : position;
}

export default function StatystykiZespoluGpsTab({
  gpsData,
  matchInfo,
  teamName,
  isLoading = false,
}: Props) {
  const [view, setView] = useState<GpsView>('overview');
  const [period, setPeriod] = useState<GpsPeriod>('total');
  const [positionFilter, setPositionFilter] = useState('all');
  const [valueMode, setValueMode] = useState<GpsValueMode>('raw');
  const [selectedMetricKey, setSelectedMetricKey] = useState<GpsChartMetricKey>('totalDistance');
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({
    column: 'totalDistance',
    dir: 'desc',
  });

  const availablePositions = useMemo(() => getAvailableGpsPositions(matchInfo), [matchInfo]);

  const playerRows = useMemo(
    () => buildGpsPlayerRows(gpsData, matchInfo, period, valueMode, positionFilter),
    [gpsData, matchInfo, period, valueMode, positionFilter],
  );

  const teamStats = useMemo(() => buildGpsTeamStats(playerRows), [playerRows]);
  const halfCompare = useMemo(
    () => buildGpsHalfCompare(gpsData, matchInfo, positionFilter, valueMode),
    [gpsData, matchInfo, positionFilter, valueMode],
  );
  const positionBreakdown = useMemo(() => buildGpsPositionBreakdown(playerRows), [playerRows]);

  const topPlayersChartData = useMemo(
    () => buildGpsTopPlayersChartData(playerRows, selectedMetricKey, 8),
    [playerRows, selectedMetricKey],
  );

  const intensityChartData = useMemo(
    () =>
      [...playerRows]
        .filter((r) => Number.isFinite(r.hsr) || Number.isFinite(r.sprintDistance) || Number.isFinite(r.hmlDistance))
        .sort((a, b) => (b.hsr + b.sprintDistance) - (a.hsr + a.sprintDistance))
        .slice(0, 8)
        .map((r) => ({
          name: r.playerName.split(' ').pop() ?? r.playerName,
          hsr: Number.isFinite(r.hsr) ? r.hsr : 0,
          sprintDistance: Number.isFinite(r.sprintDistance) ? r.sprintDistance : 0,
          hmlDistance: Number.isFinite(r.hmlDistance) ? r.hmlDistance : 0,
        })),
    [playerRows],
  );

  const accDecChartData = useMemo(
    () =>
      [...playerRows]
        .filter((r) => Number.isFinite(r.acc56) || Number.isFinite(r.dec56))
        .sort((a, b) => b.acc56 - a.acc56)
        .slice(0, 8)
        .map((r) => ({
          name: r.playerName.split(' ').pop() ?? r.playerName,
          acc56: Number.isFinite(r.acc56) ? r.acc56 : 0,
          dec56: Number.isFinite(r.dec56) ? r.dec56 : 0,
        })),
    [playerRows],
  );

  const sortedPlayers = useMemo(() => {
    const col = playerSort.column;
    const dir = playerSort.dir;
    return [...playerRows].sort((a, b) => {
      if (col === 'playerName') {
        const cmp = a.playerName.localeCompare(b.playerName, 'pl', { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      }
      if (col === 'position') {
        const cmp = a.position.localeCompare(b.position, 'pl', { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      }
      const va = Number(a[col as keyof GpsPlayerRow]) || 0;
      const vb = Number(b[col as keyof GpsPlayerRow]) || 0;
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0;
      if (!Number.isFinite(va)) return 1;
      if (!Number.isFinite(vb)) return -1;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [playerRows, playerSort]);

  const selectedMetric = GPS_CHART_METRICS.find((m) => m.key === selectedMetricKey) ?? GPS_CHART_METRICS[0];

  const periodLabel = period === 'total' ? 'cały mecz' : period === 'firstHalf' ? 'I połowa' : 'II połowa';
  const valueModeLabel = valueMode === 'raw' ? 'wartości bezwzględne' : 'na minutę gry';
  const positionLabel = positionFilter === 'all' ? 'wszystkie pozycje' : shortPositionLabel(positionFilter);

  const togglePlayerSort = (column: PlayerSortCol) => {
    setPlayerSort((prev) => ({
      column,
      dir: prev.column === column && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (isLoading) {
    return (
      <div className={styles.emptyState} role="status">
        Ładowanie danych GPS...
      </div>
    );
  }

  if (gpsData.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        Brak danych GPS dla dnia meczowego (MD) w dniu wybranego meczu.
      </div>
    );
  }

  const VIEW_TABS: Array<{ id: GpsView; label: string }> = [
    { id: 'overview', label: 'Przegląd' },
    { id: 'players', label: 'Zawodnicy' },
    { id: 'distributions', label: 'Rozkłady' },
    { id: 'table', label: 'Tabela' },
  ];

  return (
    <div className={styles.section}>
      <div className={styles.scoreboard}>
        <div className={`${styles.scoreSide} ${styles.scoreSideTeam}`}>
          <span className={styles.scoreName}>{teamName}</span>
          <span className={styles.scoreXg}>{formatGpsDistance(teamStats.totalDistance)}</span>
          <span className={styles.scoreSub}>
            {teamStats.playerCount} zaw. · {formatGpsNum(teamStats.sprints)} sprintów
          </span>
        </div>
        <div className={styles.scoreCenter}>
          <span className={styles.scoreCenterLabel}>Obciążenie</span>
          <div className={styles.domBar} role="img" aria-label={`HSR: ${formatGpsDistance(teamStats.hsr)}, sprint: ${formatGpsDistance(teamStats.sprintDistance)}`}>
            <span
              className={styles.domBarTeam}
              style={{
                width: `${teamStats.totalDistance > 0 ? Math.min(100, (teamStats.hsr / teamStats.totalDistance) * 100 * 4) : 50}%`,
              }}
            />
            <span
              className={styles.domBarOpp}
              style={{
                width: `${teamStats.totalDistance > 0 ? Math.min(100, (teamStats.sprintDistance / teamStats.totalDistance) * 100 * 6) : 50}%`,
              }}
            />
          </div>
          <span className={styles.scoreCenterPct}>
            HSR {formatGpsDistance(teamStats.hsr)} · Sprint {formatGpsDistance(teamStats.sprintDistance)}
          </span>
        </div>
        <div className={`${styles.scoreSide} ${styles.scoreSideOpp}`}>
          <span className={styles.scoreName}>Intensywność</span>
          <span className={styles.scoreXg}>
            {Number.isFinite(teamStats.teamMaxSpeed) ? `${formatGpsNum(teamStats.teamMaxSpeed)}` : '—'}
          </span>
          <span className={styles.scoreSub}>
            km/h max · HML {formatGpsDistance(teamStats.hmlDistance)}
          </span>
        </div>
      </div>

      <p className={styles.lead}>
        {periodLabel} · {positionLabel} · {valueModeLabel} · <strong>{playerRows.length}</strong> zawodników z danymi GPS
      </p>

      <div className={styles.filterBar}>
        <div className={`${pageStyles.xgHalfSelector} ${styles.selectorInline}`}>
          <ToggleFilterButton active={period === 'total'} onClick={() => setPeriod('total')}>Cały mecz</ToggleFilterButton>
          <ToggleFilterButton active={period === 'firstHalf'} onClick={() => setPeriod('firstHalf')}>I połowa</ToggleFilterButton>
          <ToggleFilterButton active={period === 'secondHalf'} onClick={() => setPeriod('secondHalf')}>II połowa</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={positionFilter === 'all'} onClick={() => setPositionFilter('all')}>Wszystkie</ToggleFilterButton>
          {availablePositions.map((pos) => (
            <ToggleFilterButton key={pos} active={positionFilter === pos} onClick={() => setPositionFilter(pos)}>
              {shortPositionLabel(pos)}
            </ToggleFilterButton>
          ))}
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={valueMode === 'raw'} onClick={() => setValueMode('raw')} variant="metric">Dane</ToggleFilterButton>
          <ToggleFilterButton active={valueMode === 'perMinute'} onClick={() => setValueMode('perMinute')} variant="metric">Na minutę</ToggleFilterButton>
        </div>
      </div>

      <div className={styles.viewNav} role="tablist" aria-label="Widoki statystyk GPS">
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
          {period === 'total' ? (
            <div className={styles.halfCompareGrid} aria-label="Porównanie połów">
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>I połowa</h4>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotTeam} />
                  Dystans <strong>{formatGpsDistance(halfCompare.firstHalf.totalDistance)}</strong>
                  · HSR <strong>{formatGpsDistance(halfCompare.firstHalf.hsr)}</strong>
                </p>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotOpp} />
                  Sprint <strong>{formatGpsDistance(halfCompare.firstHalf.sprintDistance)}</strong>
                  · ACC <strong>{formatGpsNum(halfCompare.firstHalf.acc56)}</strong>
                </p>
              </div>
              <div className={styles.halfCompareCard}>
                <h4 className={styles.halfCompareTitle}>II połowa</h4>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotTeam} />
                  Dystans <strong>{formatGpsDistance(halfCompare.secondHalf.totalDistance)}</strong>
                  · HSR <strong>{formatGpsDistance(halfCompare.secondHalf.hsr)}</strong>
                </p>
                <p className={styles.halfCompareLine}>
                  <span className={styles.dotOpp} />
                  Sprint <strong>{formatGpsDistance(halfCompare.secondHalf.sprintDistance)}</strong>
                  · ACC <strong>{formatGpsNum(halfCompare.secondHalf.acc56)}</strong>
                </p>
              </div>
            </div>
          ) : null}

          {topPlayersChartData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Top zawodnicy — {selectedMetric.label}</h3>
              <ResponsiveContainer width="100%" height={Math.max(160, topPlayersChartData.length * 30)}>
                <BarChart data={topPlayersChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; value: number; position: string };
                      return (
                        <ChartTooltip
                          label={d.name}
                          rows={[{ color: TEAM_BLUE, label: selectedMetric.label, value: formatMetricValue(selectedMetricKey, d.value) }]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="value" fill={TEAM_BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className={styles.comparisonBlock}>
            <div className={styles.comparisonTableWrap}>
              <div className={styles.comparisonTable} role="grid" aria-label="Wskaźniki GPS zespołu — kliknij wiersz, aby zmienić wykres">
                <div className={styles.comparisonHeader} role="row">
                  <span role="columnheader">Wskaźnik</span>
                  <span role="columnheader">Zespół</span>
                  <span role="columnheader">Średnia / zaw.</span>
                </div>
                {GPS_CHART_METRICS.map((metric) => {
                  const total = teamStats[metric.key] as number;
                  const avg = teamStats.playerCount > 0 && Number.isFinite(total) ? total / teamStats.playerCount : NaN;
                  return (
                    <button
                      key={metric.key}
                      type="button"
                      role="row"
                      className={`${styles.comparisonRow} ${selectedMetricKey === metric.key ? styles.comparisonRowActive : ''}`}
                      onClick={() => setSelectedMetricKey(metric.key)}
                      aria-pressed={selectedMetricKey === metric.key}
                    >
                      <span className={styles.comparisonMetric} role="cell">{metric.label}</span>
                      <span className={`${styles.comparisonValue} ${styles.comparisonValueTeam}`} role="cell">
                        {formatMetricValue(metric.key, total)}
                      </span>
                      <span className={`${styles.comparisonValue} ${styles.comparisonValueOpp}`} role="cell">
                        {formatMetricValue(metric.key, avg)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {positionBreakdown.length > 0 ? (
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Udział dystansu wg pozycji</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={positionBreakdown}
                      dataKey="totalDistance"
                      nameKey="position"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {positionBreakdown.map((entry, index) => (
                        <Cell key={entry.position} fill={POSITION_COLORS[index % POSITION_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { position: string; totalDistance: number; sharePct: number };
                        return (
                          <ChartTooltip
                            label={shortPositionLabel(d.position)}
                            rows={[
                              { color: TEAM_BLUE, label: 'Dystans', value: formatGpsDistance(d.totalDistance) },
                              { color: '#64748b', label: 'Udział', value: `${Math.round(d.sharePct)}%` },
                            ]}
                          />
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.miniLegend}>
                  {positionBreakdown.map((row, index) => (
                    <span key={row.position} className={styles.miniLegendItem}>
                      <span className={styles.miniLegendDot} style={{ background: POSITION_COLORS[index % POSITION_COLORS.length] }} />
                      {shortPositionLabel(row.position)} ({Math.round(row.sharePct)}%)
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {view === 'players' ? (
        <>
          {topPlayersChartData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Wkład zawodników — {selectedMetric.label}</h3>
              <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`} style={{ marginBottom: 8 }}>
                {GPS_CHART_METRICS.filter((m) => m.key !== 'distancePerMin').map((metric) => (
                  <ToggleFilterButton
                    key={metric.key}
                    active={selectedMetricKey === metric.key}
                    onClick={() => setSelectedMetricKey(metric.key)}
                    variant="metric"
                  >
                    {metric.label}
                  </ToggleFilterButton>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={Math.max(160, topPlayersChartData.length * 30)}>
                <BarChart data={topPlayersChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { name: string; value: number };
                      return <ChartTooltip label={d.name} rows={[{ color: TEAM_BLUE, label: selectedMetric.label, value: formatMetricValue(selectedMetricKey, d.value) }]} />;
                    }}
                  />
                  <Bar dataKey="value" fill={TEAM_BLUE} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <section className={styles.playersSection} aria-labelledby="gps-players-title">
            <div className={styles.playersHeader}>
              <h3 className={styles.playersTitle} id="gps-players-title">{teamName}</h3>
              <span className={styles.sectionMeta}>{sortedPlayers.length} zawodników</span>
            </div>
            <div className={styles.playersTableWrap}>
              <table className={styles.playersTable}>
                <thead>
                  <tr>
                    {([
                      ['playerName', 'Zawodnik'],
                      ['position', 'Poz.'],
                      ['minutes', 'Min'],
                      ['totalDistance', 'Dystans'],
                      ['hsr', 'HSR'],
                      ['sprintDistance', 'Sprint dist.'],
                      ['sprints', 'Sprinty'],
                      ['maxSpeed', 'Max km/h'],
                      ['acc56', 'ACC 5-6'],
                      ['dec56', 'DCC 5-6'],
                      ['hmlDistance', 'HML'],
                    ] as [PlayerSortCol, string][]).map(([col, label]) => (
                      <th
                        key={col}
                        scope="col"
                        className={styles.sortableTh}
                        onClick={() => togglePlayerSort(col)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlayerSort(col); } }}
                        tabIndex={0}
                        aria-sort={playerSort.column === col ? (playerSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      >
                        {label}
                        {playerSort.column === col ? (playerSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.length === 0 ? (
                    <tr><td colSpan={11}>Brak danych.</td></tr>
                  ) : (
                    sortedPlayers.map((row) => {
                      const sharePct = getGpsMetricSharePct(row, 'totalDistance', teamStats.totalDistance);
                      return (
                        <tr key={row.playerId}>
                          <td>{row.playerName}</td>
                          <td>{shortPositionLabel(row.position)}</td>
                          <td>{formatGpsNum(row.minutes)}</td>
                          <td>
                            <span className={styles.shareCell}>
                              <span className={styles.shareBar} style={{ width: `${sharePct}%` }} aria-hidden="true" />
                              <span className={styles.shareCellValue}>{formatGpsDistance(row.totalDistance)}</span>
                            </span>
                          </td>
                          <td>{formatGpsDistance(row.hsr)}</td>
                          <td>{formatGpsDistance(row.sprintDistance)}</td>
                          <td>{formatGpsNum(row.sprints)}</td>
                          <td>{formatGpsNum(row.maxSpeed)}</td>
                          <td>{formatGpsNum(row.acc56)}</td>
                          <td>{formatGpsNum(row.dec56)}</td>
                          <td>{formatGpsDistance(row.hmlDistance)}</td>
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

      {view === 'distributions' ? (
        <>
          {intensityChartData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Profil intensywności zawodników</h3>
              <p className={styles.chartSubtitle}>HSR · dystans sprintu · HML Distance</p>
              <ResponsiveContainer width="100%" height={Math.max(180, intensityChartData.length * 34)}>
                <BarChart data={intensityChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { hsr: number; sprintDistance: number; hmlDistance: number };
                      return (
                        <ChartTooltip
                          label={String(label)}
                          rows={[
                            { color: INTENSITY_COLORS.hsr, label: 'HSR', value: formatGpsDistance(d.hsr) },
                            { color: INTENSITY_COLORS.sprintDistance, label: 'Sprint dist.', value: formatGpsDistance(d.sprintDistance) },
                            { color: INTENSITY_COLORS.hmlDistance, label: 'HML', value: formatGpsDistance(d.hmlDistance) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="hsr" stackId="i" fill={INTENSITY_COLORS.hsr} />
                  <Bar dataKey="sprintDistance" stackId="i" fill={INTENSITY_COLORS.sprintDistance} />
                  <Bar dataKey="hmlDistance" stackId="i" fill={INTENSITY_COLORS.hmlDistance} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className={styles.miniLegend}>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: INTENSITY_COLORS.hsr }} />HSR</span>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: INTENSITY_COLORS.sprintDistance }} />Sprint dist.</span>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: INTENSITY_COLORS.hmlDistance }} />HML</span>
              </div>
            </div>
          ) : null}

          {accDecChartData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Przyspieszenia vs hamowania (strefy 5-6)</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, accDecChartData.length * 34)}>
                <BarChart data={accDecChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { acc56: number; dec56: number };
                      return (
                        <ChartTooltip
                          label={String(label)}
                          rows={[
                            { color: INTENSITY_COLORS.acc56, label: 'ACC 5-6', value: formatGpsNum(d.acc56) },
                            { color: INTENSITY_COLORS.dec56, label: 'DCC 5-6', value: formatGpsNum(d.dec56) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="acc56" fill={INTENSITY_COLORS.acc56} radius={[0, 4, 4, 0]} maxBarSize={12} />
                  <Bar dataKey="dec56" fill={INTENSITY_COLORS.dec56} radius={[0, 4, 4, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
              <div className={styles.miniLegend}>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: INTENSITY_COLORS.acc56 }} />ACC 5-6</span>
                <span className={styles.miniLegendItem}><span className={styles.miniLegendDot} style={{ background: INTENSITY_COLORS.dec56 }} />DCC 5-6</span>
              </div>
            </div>
          ) : null}

          {positionBreakdown.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Dystans i HSR wg pozycji</h3>
              <ResponsiveContainer width="100%" height={Math.max(160, positionBreakdown.length * 36)}>
                <BarChart data={positionBreakdown.map((r) => ({ ...r, position: shortPositionLabel(r.position) }))} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="position" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as { totalDistance: number; hsr: number; sprintDistance: number };
                      return (
                        <ChartTooltip
                          label={String(label)}
                          rows={[
                            { color: TEAM_BLUE, label: 'Dystans', value: formatGpsDistance(d.totalDistance) },
                            { color: INTENSITY_COLORS.hsr, label: 'HSR', value: formatGpsDistance(d.hsr) },
                            { color: INTENSITY_COLORS.sprintDistance, label: 'Sprint', value: formatGpsDistance(d.sprintDistance) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="totalDistance" fill={TEAM_BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="hsr" fill={INTENSITY_COLORS.hsr} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </>
      ) : null}

      {view === 'table' ? (
        <section className={styles.playersSection} aria-labelledby="gps-full-table-title">
          <div className={styles.playersHeader}>
            <h3 className={styles.playersTitle} id="gps-full-table-title">Pełna tabela GPS</h3>
            <span className={styles.sectionMeta}>{sortedPlayers.length} zawodników</span>
          </div>
          <div className={styles.playersTableWrap}>
            <table className={styles.playersTable}>
              <thead>
                <tr>
                  {([
                    ['playerName', 'Zawodnik'],
                    ['minutes', 'Min'],
                    ['acc56', 'ACC 5-6'],
                    ['dec56', 'DCC 5-6'],
                    ['totalDistance', 'Dystans'],
                    ['sprintDistance', 'Sprint dist.'],
                    ['sprints', 'Sprinty'],
                    ['maxSpeed', 'Max km/h'],
                    ['distancePerMin', 'Dist./min'],
                    ['hsr', 'HSR (m)'],
                    ['hibSeconds', 'HIB (s)'],
                    ['hibCount', 'HIB (n)'],
                    ['hmlDistance', 'HML'],
                  ] as [PlayerSortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      scope="col"
                      className={styles.sortableTh}
                      onClick={() => togglePlayerSort(col)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlayerSort(col); } }}
                      tabIndex={0}
                      aria-sort={playerSort.column === col ? (playerSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {label}
                      {playerSort.column === col ? (playerSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.playerName}</td>
                    <td>{formatGpsNum(row.minutes)}</td>
                    <td>{formatGpsNum(row.acc56)}</td>
                    <td>{formatGpsNum(row.dec56)}</td>
                    <td>{formatGpsDistance(row.totalDistance)}</td>
                    <td>{formatGpsDistance(row.sprintDistance)}</td>
                    <td>{formatGpsNum(row.sprints)}</td>
                    <td>{formatGpsNum(row.maxSpeed)}</td>
                    <td>{formatGpsNum(row.distancePerMin)}</td>
                    <td>{formatGpsDistance(row.hsr)}</td>
                    <td>{formatGpsNum(row.hibSeconds)}</td>
                    <td>{formatGpsNum(row.hibCount)}</td>
                    <td>{formatGpsDistance(row.hmlDistance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
