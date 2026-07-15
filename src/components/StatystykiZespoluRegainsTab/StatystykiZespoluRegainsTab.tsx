'use client';

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AttackDefenseTilt from '@/components/AttackDefenseTilt/AttackDefenseTilt';
import MatchVideoFloatingPanel from '@/components/MatchVideoFloatingPanel/MatchVideoFloatingPanel';
import PlayerHeatmapPitch from '@/components/PlayerHeatmapPitch/PlayerHeatmapPitch';
import type { Action, PKEntry, Shot, TeamInfo } from '@/types';
import { getVideoTimestampSeconds } from '@/utils/actionVideoSeekSeconds';
import { hasExternalVideoSource } from '@/utils/externalVideoMatchInfo';
import { getPlayerLabel } from '@/utils/playerUtils';
import { buildRegainAfterStats } from '@/utils/statystykiZespoluRegainAfterStats';
import {
  REGAIN_LOSES_P_TILE_KEYS,
  toggleRegainLosesPFilter,
  regainXtValues,
  type RegainLosesContextMode,
  type RegainLosesHalfPitchFilter,
  type RegainLosesHeatmapMode,
  type RegainLosesPFilterKey,
} from '@/utils/statystykiZespoluRegainLosesFilters';
import {
  REGAIN_ATTACK_DEFENSE_TOOLTIP,
  REGAIN_BYPASSED_TOOLTIP,
} from '@/utils/statystykiZespoluRegainLosesBypassed';
import {
  buildRegainHeatmapData,
  buildRegainPlayerRows,
  buildRegainTimelineXT,
  buildRegainZoneContextActionGroups,
  buildTeamRegainStats,
  filterRegainByMatchHalf,
  type RegainMatchHalfFilter,
} from '@/utils/statystykiZespoluRegainStats';
import { renderChartMatchEventMarkers } from '@/components/ChartMatchEventMarkers/ChartMatchEventMarkers';
import {
  buildChartMatchEvents,
  buildIntervalMarkerPoints,
} from '@/utils/statystykiZespoluChartEvents';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from '../StatystykiZespoluXgTab/StatystykiZespoluXgTab.module.css';

const TEAM_BLUE = '#2563eb';
const TEAM_RED = '#dc2626';

type RegainView = 'overview' | 'players' | 'map';
type PlayerSortCol = 'playerName' | 'regains' | 'regainSharePct' | 'xtAttack' | 'xtDefense' | 'p2Count' | 'p3Count';

type Props = {
  regainActions: Action[];
  matchInfo: TeamInfo;
  selectedTeam: string;
  teamName: string;
  opponentName: string;
  playersIndex: ReturnType<typeof import('@/utils/playerUtils').buildPlayersIndex>;
  availableTeams: Array<{ id: string; name: string; logo?: string }>;
  allActions: Action[];
  allShots: Shot[];
  allPkEntries: PKEntry[];
  allLosesActions: Action[];
  aggregatedPossession?: { teamMin: number; opponentMin: number } | null;
  totalMinutes: number;
  regainLosesTimeline?: Array<{ minute: string; regains: number; loses: number }>;
};

function fmt2(v: number) { return Number(v).toFixed(2); }
function fmt3(v: number) { return Number(v).toFixed(3); }
function shortTeamLabel(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

function pitchHalfFilterLabel(h: 'all' | 'own' | 'opponent' | 'pm'): string {
  if (h === 'all') return 'Całe boisko';
  if (h === 'own') return 'Własna połowa.';
  if (h === 'opponent') return 'Połowę przeciwnika.';
  return 'PM Area';
}

function ToggleFilterButton({ active, onClick, children, variant = 'segment' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; variant?: 'segment' | 'metric';
}) {
  const base = variant === 'segment' ? pageStyles.xgHalfButton : pageStyles.metricButton;
  return (
    <button type="button" className={`${base} ${active ? pageStyles.active : ''}`.trim()} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

export default function StatystykiZespoluRegainsTab({
  regainActions,
  matchInfo,
  selectedTeam,
  teamName,
  opponentName,
  playersIndex,
  allActions,
  allShots,
  allPkEntries,
  allLosesActions,
  aggregatedPossession,
  totalMinutes,
  regainLosesTimeline = [],
}: Props) {
  const [view, setView] = useState<RegainView>('overview');
  const [matchHalf, setMatchHalf] = useState<RegainMatchHalfFilter>('all');
  const [pitchHalf, setPitchHalf] = useState<RegainLosesHalfPitchFilter>('all');
  const [pFilters, setPFilters] = useState<RegainLosesPFilterKey[]>([]);
  const [contextMode, setContextMode] = useState<RegainLosesContextMode>('defense');
  const [heatmapMode, setHeatmapMode] = useState<RegainLosesHeatmapMode>('xt');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hasVideoPanel, setHasVideoPanel] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [videoSeekTargetSeconds, setVideoSeekTargetSeconds] = useState<number | null>(null);
  const [videoSeekRequestId, setVideoSeekRequestId] = useState(0);
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({ column: 'regains', dir: 'desc' });

  const filteredByMatchHalf = useMemo(
    () => filterRegainByMatchHalf(regainActions, matchHalf),
    [regainActions, matchHalf],
  );

  const teamStats = useMemo(
    () => buildTeamRegainStats(filteredByMatchHalf, pitchHalf, pFilters),
    [filteredByMatchHalf, pitchHalf, pFilters],
  );
  const afterStats = useMemo(
    () => buildRegainAfterStats(matchInfo, filteredByMatchHalf, allActions, allShots, allPkEntries, allLosesActions, pitchHalf, pFilters),
    [matchInfo, filteredByMatchHalf, allActions, allShots, allPkEntries, allLosesActions, pitchHalf, pFilters],
  );
  const heatmapData = useMemo(
    () => buildRegainHeatmapData(filteredByMatchHalf, pitchHalf, pFilters, contextMode, heatmapMode),
    [filteredByMatchHalf, pitchHalf, pFilters, contextMode, heatmapMode],
  );
  const timeline = useMemo(() => buildRegainTimelineXT(filteredByMatchHalf), [filteredByMatchHalf]);
  const chartEvents = useMemo(() => {
    const regainHalf = matchHalf === 'first' ? 'first' : matchHalf === 'second' ? 'second' : 'all';
    return buildChartMatchEvents(allShots, allPkEntries, matchInfo, selectedTeam, regainHalf);
  }, [allShots, allPkEntries, matchInfo, selectedTeam, matchHalf]);
  const timelineMarkerPoints = useMemo(
    () => buildIntervalMarkerPoints(chartEvents, timeline, { valueKeys: ['regains', 'xtAttack', 'xtDefense'] }),
    [chartEvents, timeline],
  );
  const regainLosesMarkerPoints = useMemo(
    () => buildIntervalMarkerPoints(chartEvents, regainLosesTimeline, { valueKeys: ['regains', 'loses'] }),
    [chartEvents, regainLosesTimeline],
  );
  const playerRows = useMemo(
    () => buildRegainPlayerRows(filteredByMatchHalf, teamStats.totalRegains, (id) => getPlayerLabel(id, playersIndex)),
    [filteredByMatchHalf, teamStats.totalRegains, playersIndex],
  );
  const sortedPlayers = useMemo(() => {
    const col = playerSort.column;
    const dir = playerSort.dir;
    return [...playerRows].sort((a, b) => {
      if (col === 'playerName') {
        const cmp = a.playerName.localeCompare(b.playerName, 'pl');
        return dir === 'asc' ? cmp : -cmp;
      }
      const va = Number(a[col]) || 0;
      const vb = Number(b[col]) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    });
  }, [playerRows, playerSort]);

  const zoneContextGroups = useMemo(
    () => (selectedZone ? buildRegainZoneContextActionGroups(filteredByMatchHalf, selectedZone, pitchHalf, pFilters) : null),
    [selectedZone, filteredByMatchHalf, pitchHalf, pFilters],
  );

  const openActionVideo = useCallback((action: Action) => {
    const videoSec = getVideoTimestampSeconds(action);
    if (!hasExternalVideoSource(matchInfo)) { toast.error('Brak wideo dla tego meczu.'); return false; }
    if (videoSec === null) { toast.error('Brak znacznika czasu wideo dla tej akcji.'); return false; }
    setHasVideoPanel(true);
    setIsVideoPanelOpen(true);
    setVideoSeekRequestId((id) => id + 1);
    setVideoSeekTargetSeconds(null);
    window.requestAnimationFrame(() => setVideoSeekTargetSeconds(videoSec));
    return true;
  }, [matchInfo]);

  const teamShort = shortTeamLabel(teamName);
  const oppShort = shortTeamLabel(opponentName);
  const regainsPer90 = totalMinutes > 0 ? (teamStats.visibleRegainsCount * 90) / totalMinutes : 0;

  if (regainActions.length === 0) {
    return <div className={styles.emptyState} role="status">Brak przechwytów w wybranym meczu.</div>;
  }

  const VIEW_TABS: Array<{ id: RegainView; label: string }> = [
    { id: 'overview', label: 'Przegląd' },
    { id: 'players', label: 'Zawodnicy' },
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
          onClose={() => { setVideoSeekTargetSeconds(null); setIsVideoPanelOpen(false); }}
        />
      ) : null}

      <div className={`${styles.scoreboard} ${styles.scoreboardSolo}`}>
        <div className={styles.scoreSoloBlock}>
          <span className={styles.scoreCenterLabel}>Przechwyty</span>
          <span className={styles.scoreName}>{teamName}</span>
          <span className={styles.scoreXg}>{teamStats.visibleRegainsCount}</span>
          <span className={styles.scoreSub}>{fmt3(teamStats.regainXTInAttack)} xT atk · {fmt3(teamStats.regainXTInDefense)} xT obr</span>
        </div>
      </div>

      <p className={styles.lead}>
        {matchHalf === 'all' ? 'cały mecz' : matchHalf === 'first' ? 'I połowa' : 'II połowa'}
        {' · '}
        <strong>{teamStats.visibleRegainsCount}</strong> przechwytów na mapie
        {' · '}
        {regainsPer90.toFixed(1)} / 90 min
      </p>

      <div className={styles.filterBarPanel}>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          <ToggleFilterButton active={matchHalf === 'all'} onClick={() => setMatchHalf('all')} variant="segment">Cały mecz</ToggleFilterButton>
          <ToggleFilterButton active={matchHalf === 'first'} onClick={() => setMatchHalf('first')} variant="segment">I połowa.</ToggleFilterButton>
          <ToggleFilterButton active={matchHalf === 'second'} onClick={() => setMatchHalf('second')} variant="segment">II połowa.</ToggleFilterButton>
        </div>
        <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
          {(['all', 'own', 'opponent', 'pm'] as const).map((h) => (
            <ToggleFilterButton key={h} active={pitchHalf === h} onClick={() => setPitchHalf(h)} variant="metric">
              {pitchHalfFilterLabel(h)}
            </ToggleFilterButton>
          ))}
        </div>
      </div>

      <div className={styles.pxtFilterPanel} style={{ marginBottom: 12 }}>
        <div className={pageStyles.countItemsWrapper}>
          {REGAIN_LOSES_P_TILE_KEYS.map((key) => {
            const count = teamStats.pCounts[key].total;
            const isActive = pFilters.includes(key);
            return (
              <div
                key={key}
                role="button"
                tabIndex={count === 0 ? -1 : 0}
                className={`${pageStyles.countItem} ${isActive ? pageStyles.countItemSelected : ''} ${count === 0 ? pageStyles.countItemDisabled : ''}`}
                onClick={() => { if (count === 0) return; setPFilters((prev) => toggleRegainLosesPFilter(prev, key)); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (count > 0) setPFilters((prev) => toggleRegainLosesPFilter(prev, key)); } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span className={pageStyles.countLabel}>{key.toUpperCase()}:</span>
                  <span className={pageStyles.countValue}>{count}</span>
                </div>
                <div className={pageStyles.zoneBreakdown}>
                  <span className={pageStyles.zoneLabel}>Strefy boczne:</span>
                  <span className={pageStyles.zoneValue}>{teamStats.pCounts[key].lateral}</span>
                  <span className={pageStyles.zoneLabel}>Strefy centralne:</span>
                  <span className={pageStyles.zoneValue}>{teamStats.pCounts[key].central}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.viewNav} role="tablist" aria-label="Widoki przechwytów">
        {VIEW_TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={`${styles.viewNavButton} ${view === tab.id ? styles.viewNavButtonActive : ''}`} onClick={() => setView(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'overview' ? (
        <>
          <div className={styles.overviewStatsGrid}>
            <section className={styles.overviewStatsCard} aria-label="Kluczowe wskaźniki przechwytów">
              <h3 className={styles.overviewStatsTitle}>Kluczowe wskaźniki</h3>
              <ul className={styles.overviewStatsList}>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>Na połowie {oppShort}</span>
                    <span className={styles.overviewStatsValue}>{teamStats.visibleRegainsOpponentHalf}</span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>Przechwyty / min pos. {oppShort}</span>
                    <span className={styles.overviewStatsValue}>
                      {aggregatedPossession && aggregatedPossession.opponentMin > 0
                        ? (teamStats.visibleRegainsCount / aggregatedPossession.opponentMin).toFixed(2)
                        : '—'}
                    </span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>xT obrona / min pos. {oppShort}</span>
                    <span className={styles.overviewStatsValue}>
                      {aggregatedPossession && aggregatedPossession.opponentMin > 0
                        ? (teamStats.regainXTInDefense / aggregatedPossession.opponentMin).toFixed(3)
                        : '—'}
                    </span>
                  </div>
                </li>
                <li className={`${styles.overviewStatsItem} ${styles.overviewStatsItemWide}`}>
                  <div className={styles.overviewStatsItemMain}>
                    <span
                      className={`${styles.overviewStatsLabel} ${styles.tooltipTrigger}`}
                      data-tooltip={REGAIN_ATTACK_DEFENSE_TOOLTIP}
                    >
                      Suma xT atak / obrona
                    </span>
                    <span className={styles.overviewStatsValue}>{teamStats.totalRegains}</span>
                  </div>
                  <AttackDefenseTilt
                    variant="dualXt"
                    totalActions={teamStats.totalRegains}
                    attackCount={teamStats.regainAttackCount}
                    defenseCount={teamStats.regainDefenseCount}
                    attackXt={teamStats.regainXTInAttack}
                    defenseXt={teamStats.regainXTInDefense}
                    hint="Każdy przechwyt ma xT w strefie ataku i obrony. Waga pokazuje, która suma xT jest większa."
                  />
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span
                      className={`${styles.overviewStatsLabel} ${styles.tooltipTrigger}`}
                      data-tooltip={REGAIN_BYPASSED_TOOLTIP}
                    >
                      Minięci przeciwnicy
                    </span>
                    <span className={styles.overviewStatsValue}>
                      {teamStats.bypassedOpponents.recordedCount > 0
                        ? teamStats.bypassedOpponents.avgBypassed.toFixed(1)
                        : '—'}
                    </span>
                  </div>
                  {teamStats.bypassedOpponents.recordedCount > 0 ? (
                    <div className={styles.overviewStatsChips}>
                      <span className={styles.overviewStatsChip}>
                        łącznie {teamStats.bypassedOpponents.totalBypassed}
                      </span>
                      <span className={styles.overviewStatsChip}>
                        z {teamStats.bypassedOpponents.recordedCount} zdarzeń
                      </span>
                    </div>
                  ) : (
                    <p className={styles.overviewStatsHint}>
                      Brak oznaczeń w analizatorze — zaznacz miniętych przy każdym przechwycie.
                    </p>
                  )}
                </li>
                {teamStats.allRegainNoPCount > 0 ? (
                  <li className={styles.overviewStatsItem}>
                    <div className={styles.overviewStatsItemMain}>
                      <span className={styles.overviewStatsLabel}>Bez P0–P3</span>
                      <span className={styles.overviewStatsValue}>{teamStats.allRegainNoPCount}</span>
                    </div>
                  </li>
                ) : null}
              </ul>
            </section>

            <section className={styles.overviewStatsCard} aria-label="Konsekwencje przechwytów">
              <h3 className={styles.overviewStatsTitle}>Konsekwencje przechwytów</h3>
              <ul className={styles.overviewStatsList}>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>8s od przechwytu</span>
                    <span className={styles.overviewStatsValue}>{fmt2(afterStats.totalXG8s)} xG</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={styles.overviewStatsChip}>{afterStats.totalShots8s} strz.</span>
                    <span className={styles.overviewStatsChip}>{afterStats.totalPKEntries8s} PK</span>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipTeam}`}>{fmt3(afterStats.totalPXT8s)} PxT</span>
                    <span className={styles.overviewStatsChip}>{afterStats.totalPasses8s} pod.</span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>Counterpressing 5s</span>
                    <span className={styles.overviewStatsValue}>{afterStats.losesAfterRegain5sPct.toFixed(1)}%</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipOpp}`}>{afterStats.totalLosesAfterRegain5s} strat</span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>15s od przechwytu</span>
                    <span className={styles.overviewStatsValue}>{fmt2(afterStats.totalXG15s)} xG</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={styles.overviewStatsChip}>{afterStats.totalShots15s} strz.</span>
                    <span className={styles.overviewStatsChip}>{afterStats.totalPKEntries15s} PK</span>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipTeam}`}>{fmt3(afterStats.totalPXT15s)} PxT</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Przechwyty i xT co 5 min — {teamShort}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={timeline} margin={{ top: 22, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="minute" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Legend iconSize={10} />
                <Bar yAxisId="left" dataKey="regains" name="Przechwyty" fill={TEAM_BLUE} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="xtAttack" name="xT atak" fill={TEAM_RED} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="xtDefense" name="xT obrona" fill="#6b7280" radius={[4, 4, 0, 0]} />
                {renderChartMatchEventMarkers({ points: timelineMarkerPoints, yAxisId: 'left' })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {regainLosesTimeline.length > 0 ? (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Przechwyty vs straty co 5 min</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={regainLosesTimeline} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="minute" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend iconSize={10} />
                  <Bar dataKey="regains" name="Przechwyty" fill={TEAM_BLUE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="loses" name="Straty" fill={TEAM_RED} radius={[4, 4, 0, 0]} />
                  {renderChartMatchEventMarkers({ points: regainLosesMarkerPoints })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </>
      ) : null}

      {view === 'players' ? (
        <section className={styles.playersSection}>
          <div className={styles.playersTableWrap}>
          <table className={styles.playersTable}>
            <thead>
              <tr>
                {([['playerName', 'Zawodnik'], ['regains', 'Przechwyty'], ['regainSharePct', 'Udział %'], ['xtAttack', 'xT atak'], ['xtDefense', 'xT obrona'], ['p2Count', 'P2'], ['p3Count', 'P3']] as [PlayerSortCol, string][]).map(([col, label]) => (
                  <th key={col}>
                    <span className={styles.sortableTh} onClick={() => setPlayerSort((p) => ({ column: col, dir: p.column === col && p.dir === 'desc' ? 'asc' : 'desc' }))} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setPlayerSort((p) => ({ column: col, dir: p.column === col && p.dir === 'desc' ? 'asc' : 'desc' })); }}>{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.playerName}</td>
                  <td>{row.regains}</td>
                  <td>{fmt2(row.regainSharePct)}%</td>
                  <td>{fmt3(row.xtAttack)}</td>
                  <td>{fmt3(row.xtDefense)}</td>
                  <td>{row.p2Count}</td>
                  <td>{row.p3Count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      {view === 'map' ? (
        <section className={styles.mapSection} aria-labelledby="regain-map-title">
          <h3 className={styles.mapSectionTitle} id="regain-map-title">Heatmapa przechwytów — {teamShort}</h3>
          <div className={styles.filterBar} style={{ marginBottom: 12 }}>
            <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
              <ToggleFilterButton active={contextMode === 'defense'} onClick={() => setContextMode('defense')} variant="metric">W obronie</ToggleFilterButton>
              <ToggleFilterButton active={contextMode === 'attack'} onClick={() => setContextMode('attack')} variant="metric">W ataku</ToggleFilterButton>
            </div>
            <div className={`${pageStyles.xgFilterContainer} ${styles.selectorInline}`}>
              <ToggleFilterButton active={heatmapMode === 'xt'} onClick={() => setHeatmapMode('xt')} variant="metric">xT</ToggleFilterButton>
              <ToggleFilterButton active={heatmapMode === 'count'} onClick={() => setHeatmapMode('count')} variant="metric">Liczba</ToggleFilterButton>
            </div>
          </div>
          <p className={styles.sectionMeta} style={{ marginBottom: 8 }}>
            Kliknij strefę na heatmapie — w panelu zobaczysz przechwyty w ataku i w obronie. Wideo otwiera się po kliknięciu niebieskiej minuty.
          </p>
          <div className={styles.mainLayout}>
            <div className={styles.mapPanel}>
              <PlayerHeatmapPitch
                heatmapData={heatmapData}
                category="regains"
                mode={heatmapMode === 'xt' ? 'pxt' : 'count'}
                selectedZone={selectedZone}
                onZoneClick={(zoneName) => {
                  const normalized = typeof zoneName === 'string' ? zoneName.toUpperCase().replace(/\s+/g, '') : String(zoneName);
                  setSelectedZone(normalized === selectedZone ? null : normalized);
                }}
              />
            </div>
            <aside className={styles.shotPanel} aria-live="polite">
              {zoneContextGroups ? (
                <>
                  <div className={styles.shotPanelHeader}>
                    <h4 className={styles.shotPanelTitle}>Strefa {selectedZone}</h4>
                    <button type="button" className={styles.shotPanelClose} onClick={() => setSelectedZone(null)} aria-label="Zamknij">×</button>
                  </div>
                  {zoneContextGroups.map((group) => (
                    <div key={group.context} className={styles.pxtZoneRoleGroup}>
                      <h5 className={styles.pxtZoneRoleTitle}>{group.label}</h5>
                      {group.actions.length === 0 ? (
                        <p className={styles.pxtZoneRoleEmpty}>Brak przechwytów w tym kontekście.</p>
                      ) : (
                        <ul className={styles.pxtZoneActionsList}>
                          {group.actions.map((action) => {
                            const halfLabel = action.minute > 45 ? 'II' : 'I';
                            const videoSec = getVideoTimestampSeconds(action);
                            const canVideo = hasExternalVideoSource(matchInfo) && videoSec !== null;
                            const { attackXt, defenseXt } = regainXtValues(action);
                            const xtLabel = group.context === 'attack' ? attackXt : defenseXt;
                            return (
                              <li key={`${group.context}-${action.id}`} className={styles.pxtZoneActionItem}>
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
                                  {getPlayerLabel(action.senderId, playersIndex)} · xT {fmt3(xtLabel)}
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
                <p className={styles.shotPanelEmpty}>Kliknij strefę na heatmapie, aby zobaczyć przechwyty w ataku i w obronie.</p>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
