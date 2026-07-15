'use client';

import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import AttackDefenseTilt from '@/components/AttackDefenseTilt/AttackDefenseTilt';
import MatchVideoFloatingPanel from '@/components/MatchVideoFloatingPanel/MatchVideoFloatingPanel';
import PlayerHeatmapPitch from '@/components/PlayerHeatmapPitch/PlayerHeatmapPitch';
import type { Action, PKEntry, Shot, TeamInfo } from '@/types';
import { getVideoTimestampSeconds } from '@/utils/actionVideoSeekSeconds';
import { hasExternalVideoSource } from '@/utils/externalVideoMatchInfo';
import { getPlayerLabel } from '@/utils/playerUtils';
import { buildLosesAfterStats } from '@/utils/statystykiZespoluRegainAfterStats';
import {
  REGAIN_LOSES_P_TILE_KEYS,
  toggleRegainLosesPFilter,
  type RegainLosesContextMode,
  type RegainLosesHalfPitchFilter,
  type RegainLosesHeatmapMode,
  type RegainLosesPFilterKey,
} from '@/utils/statystykiZespoluRegainLosesFilters';
import {
  LOSES_ATTACK_DEFENSE_TOOLTIP,
  LOSES_BYPASSED_TOOLTIP,
} from '@/utils/statystykiZespoluRegainLosesBypassed';
import {
  buildLosesHeatmapData,
  buildLosesPlayerRows,
  buildLosesTimelineXT,
  buildLosesZoneContextActionGroups,
  buildTeamLosesStats,
  filterLosesByMatchHalf,
  getLosesXtValues,
  type LosesMatchHalfFilter,
} from '@/utils/statystykiZespoluLosesStats';
import { renderChartMatchEventMarkers } from '@/components/ChartMatchEventMarkers/ChartMatchEventMarkers';
import {
  buildChartMatchEvents,
  buildIntervalMarkerPoints,
} from '@/utils/statystykiZespoluChartEvents';
import pageStyles from '@/app/statystyki-zespolu/statystyki-zespolu.module.css';
import styles from '../StatystykiZespoluXgTab/StatystykiZespoluXgTab.module.css';

const TEAM_BLUE = '#2563eb';
const TEAM_RED = '#dc2626';

type LosesView = 'overview' | 'players' | 'map';
type PlayerSortCol = 'playerName' | 'loses' | 'losesSharePct' | 'xtAttack' | 'xtDefense' | 'reaction5sCount' | 'badReaction5sCount';

type Props = {
  loseActions: Action[];
  regainActions: Action[];
  matchInfo: TeamInfo;
  selectedTeam: string;
  teamName: string;
  opponentName: string;
  playersIndex: ReturnType<typeof import('@/utils/playerUtils').buildPlayersIndex>;
  availableTeams: Array<{ id: string; name: string; logo?: string }>;
  allShots: Shot[];
  allPkEntries: PKEntry[];
  aggregatedPossession?: { teamMin: number; opponentMin: number } | null;
  totalMinutes: number;
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
    <button type="button" className={`${base} ${active ? pageStyles.active : ''}`.trim()} onClick={onClick} aria-pressed={active}>{children}</button>
  );
}

function loseReactionLabel(action: Action): string {
  if (action.isAut === true || (action as Action & { aut?: boolean }).aut === true) return 'Aut';
  if (action.isBadReaction5s === true || (action as Action & { isReaction5sNotApplicable?: boolean }).isReaction5sNotApplicable === true) return '✗ 5s';
  if (action.isReaction5s === true) return 'Reakcja 5s';
  return 'Brak reakcji';
}

export default function StatystykiZespoluLosesTab({
  loseActions,
  regainActions,
  matchInfo,
  selectedTeam,
  teamName,
  opponentName,
  playersIndex,
  allShots,
  allPkEntries,
  aggregatedPossession,
  totalMinutes,
}: Props) {
  const [view, setView] = useState<LosesView>('overview');
  const [matchHalf, setMatchHalf] = useState<LosesMatchHalfFilter>('all');
  const [pitchHalf, setPitchHalf] = useState<RegainLosesHalfPitchFilter>('all');
  const [pFilters, setPFilters] = useState<RegainLosesPFilterKey[]>([]);
  const [contextMode, setContextMode] = useState<RegainLosesContextMode>('attack');
  const [heatmapMode, setHeatmapMode] = useState<RegainLosesHeatmapMode>('xt');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hasVideoPanel, setHasVideoPanel] = useState(false);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const [videoSeekTargetSeconds, setVideoSeekTargetSeconds] = useState<number | null>(null);
  const [videoSeekRequestId, setVideoSeekRequestId] = useState(0);
  const [playerSort, setPlayerSort] = useState<{ column: PlayerSortCol; dir: 'asc' | 'desc' }>({ column: 'loses', dir: 'desc' });

  const filteredByMatchHalf = useMemo(() => filterLosesByMatchHalf(loseActions, matchHalf), [loseActions, matchHalf]);
  const teamStats = useMemo(() => buildTeamLosesStats(filteredByMatchHalf, pitchHalf, pFilters), [filteredByMatchHalf, pitchHalf, pFilters]);
  const afterStats = useMemo(
    () => buildLosesAfterStats(matchInfo, selectedTeam, filteredByMatchHalf, regainActions, allShots, allPkEntries, pitchHalf, pFilters),
    [matchInfo, selectedTeam, filteredByMatchHalf, regainActions, allShots, allPkEntries, pitchHalf, pFilters],
  );
  const heatmapData = useMemo(
    () => buildLosesHeatmapData(filteredByMatchHalf, pitchHalf, pFilters, contextMode, heatmapMode),
    [filteredByMatchHalf, pitchHalf, pFilters, contextMode, heatmapMode],
  );
  const timeline = useMemo(() => buildLosesTimelineXT(filteredByMatchHalf), [filteredByMatchHalf]);
  const chartEvents = useMemo(() => {
    const loseHalf = matchHalf === 'first' ? 'first' : matchHalf === 'second' ? 'second' : 'all';
    return buildChartMatchEvents(allShots, allPkEntries, matchInfo, selectedTeam, loseHalf);
  }, [allShots, allPkEntries, matchInfo, selectedTeam, matchHalf]);
  const timelineMarkerPoints = useMemo(
    () => buildIntervalMarkerPoints(chartEvents, timeline, { valueKeys: ['loses', 'xtAttack', 'xtDefense'] }),
    [chartEvents, timeline],
  );
  const playerRows = useMemo(
    () => buildLosesPlayerRows(filteredByMatchHalf, teamStats.visibleLosesCount, (id) => getPlayerLabel(id, playersIndex)),
    [filteredByMatchHalf, teamStats.visibleLosesCount, playersIndex],
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
    () => (selectedZone ? buildLosesZoneContextActionGroups(filteredByMatchHalf, selectedZone, pitchHalf, pFilters) : null),
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
  const losesPer90 = totalMinutes > 0 ? (teamStats.visibleLosesCount * 90) / totalMinutes : 0;

  if (loseActions.length === 0) {
    return <div className={styles.emptyState} role="status">Brak strat w wybranym meczu.</div>;
  }

  const VIEW_TABS: Array<{ id: LosesView; label: string }> = [
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
          <span className={styles.scoreCenterLabel}>Straty</span>
          <span className={styles.scoreName}>{teamName}</span>
          <span className={styles.scoreXg}>{teamStats.visibleLosesCount}</span>
          <span className={styles.scoreSub}>{fmt3(teamStats.losesXTInAttack)} xT atk · {fmt3(teamStats.losesXTInDefense)} xT obr</span>
        </div>
      </div>

      <p className={styles.lead}>
        {matchHalf === 'all' ? 'cały mecz' : matchHalf === 'first' ? 'I połowa' : 'II połowa'}
        {' · '}
        <strong>{teamStats.visibleLosesCount}</strong> strat na mapie
        {teamStats.visibleAutCount > 0 ? ` · w tym auty: ${teamStats.visibleAutCount}` : ''}
        {' · '}
        {losesPer90.toFixed(1)} / 90 min
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

      <div className={styles.viewNav} role="tablist" aria-label="Widoki strat">
        {VIEW_TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={`${styles.viewNavButton} ${view === tab.id ? styles.viewNavButtonActive : ''}`} onClick={() => setView(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {view === 'overview' ? (
        <>
          <div className={styles.overviewStatsGrid}>
            <section className={styles.overviewStatsCard} aria-label="Kluczowe wskaźniki strat">
              <h3 className={styles.overviewStatsTitle}>Kluczowe wskaźniki</h3>
              <ul className={styles.overviewStatsList}>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>Straty / min posiadania</span>
                    <span className={styles.overviewStatsValue}>
                      {aggregatedPossession && aggregatedPossession.teamMin > 0
                        ? (teamStats.visibleLosesCount / aggregatedPossession.teamMin).toFixed(2)
                        : '—'}
                    </span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>xT obrona / min posiadania</span>
                    <span className={styles.overviewStatsValue}>
                      {aggregatedPossession && aggregatedPossession.teamMin > 0
                        ? (teamStats.losesXTInDefense / aggregatedPossession.teamMin).toFixed(3)
                        : '—'}
                    </span>
                  </div>
                </li>
                <li className={`${styles.overviewStatsItem} ${styles.overviewStatsItemWide}`}>
                  <div className={styles.overviewStatsItemMain}>
                    <span
                      className={`${styles.overviewStatsLabel} ${styles.tooltipTrigger}`}
                      data-tooltip={LOSES_ATTACK_DEFENSE_TOOLTIP}
                    >
                      Suma xT atak / obrona
                    </span>
                    <span className={styles.overviewStatsValue}>{teamStats.visibleLosesCount}</span>
                  </div>
                  <AttackDefenseTilt
                    variant="dualXt"
                    totalActions={teamStats.visibleLosesCount}
                    attackCount={teamStats.losesAttackCount}
                    defenseCount={teamStats.losesDefenseCount}
                    attackXt={teamStats.losesXTInAttack}
                    defenseXt={teamStats.losesXTInDefense}
                    hint="Każda strata ma xT w strefie ataku i obrony. Waga pokazuje, która suma xT jest większa."
                  />
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span
                      className={`${styles.overviewStatsLabel} ${styles.tooltipTrigger}`}
                      data-tooltip={LOSES_BYPASSED_TOOLTIP}
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
                      Brak oznaczeń w analizatorze — zaznacz miniętych przy każdej stracie.
                    </p>
                  )}
                </li>
                {teamStats.allLosesNoPCount > 0 ? (
                  <li className={styles.overviewStatsItem}>
                    <div className={styles.overviewStatsItemMain}>
                      <span className={styles.overviewStatsLabel}>Bez P0–P3</span>
                      <span className={styles.overviewStatsValue}>{teamStats.allLosesNoPCount}</span>
                    </div>
                  </li>
                ) : null}
              </ul>
            </section>

            <section className={styles.overviewStatsCard} aria-label="Konsekwencje strat">
              <h3 className={styles.overviewStatsTitle}>Konsekwencje strat</h3>
              <ul className={styles.overviewStatsList}>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>Kontrpressing 5s</span>
                    <span className={styles.overviewStatsValue}>{afterStats.reaction5sPct.toFixed(1)}%</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={styles.overviewStatsChip}>{afterStats.reaction5sGood}/{afterStats.reaction5sTotal} ✓</span>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipTeam}`}>{afterStats.totalOpponentRegains5s} nasz regain</span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>{oppShort} · 8s po stracie</span>
                    <span className={styles.overviewStatsValue}>{fmt2(afterStats.totalOpponentXG8s)} xG</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={styles.overviewStatsChip}>{afterStats.totalOpponentShots8s} strz.</span>
                    <span className={styles.overviewStatsChip}>{afterStats.totalOpponentPKEntries8s} PK</span>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipOpp}`}>{afterStats.totalOpponentRegains8s} regain</span>
                  </div>
                </li>
                <li className={styles.overviewStatsItem}>
                  <div className={styles.overviewStatsItemMain}>
                    <span className={styles.overviewStatsLabel}>{oppShort} · 15s po stracie</span>
                    <span className={styles.overviewStatsValue}>{fmt2(afterStats.totalOpponentXG15s)} xG</span>
                  </div>
                  <div className={styles.overviewStatsChips}>
                    <span className={styles.overviewStatsChip}>{afterStats.totalOpponentShots15s} strz.</span>
                    <span className={styles.overviewStatsChip}>{afterStats.totalOpponentPKEntries15s} PK</span>
                    <span className={`${styles.overviewStatsChip} ${styles.overviewStatsChipOpp}`}>{afterStats.totalOpponentRegains15s} regain</span>
                  </div>
                </li>
              </ul>
            </section>
          </div>
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Straty i xT co 5 min — {teamShort}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={timeline} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="minute" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip />
                <Legend iconSize={10} />
                <Bar yAxisId="left" dataKey="loses" name="Straty" fill={TEAM_BLUE} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="xtAttack" name="xT atak" fill={TEAM_RED} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="xtDefense" name="xT obrona" fill="#6b7280" radius={[4, 4, 0, 0]} />
                {renderChartMatchEventMarkers({ points: timelineMarkerPoints, yAxisId: 'left' })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}

      {view === 'players' ? (
        <section className={styles.playersSection}>
          <div className={styles.playersTableWrap}>
            <table className={styles.playersTable}>
              <thead>
                <tr>
                  {([['playerName', 'Zawodnik'], ['loses', 'Straty'], ['losesSharePct', 'Udział %'], ['xtAttack', 'xT atak'], ['xtDefense', 'xT obrona'], ['reaction5sCount', '✓ 5s'], ['badReaction5sCount', '✗ 5s']] as [PlayerSortCol, string][]).map(([col, label]) => (
                    <th key={col} scope="col" className={styles.sortableTh} onClick={() => setPlayerSort((p) => ({ column: col, dir: p.column === col && p.dir === 'desc' ? 'asc' : 'desc' }))}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.playerName}</td>
                    <td>{row.loses}</td>
                    <td>{fmt2(row.losesSharePct)}%</td>
                    <td>{fmt3(row.xtAttack)}</td>
                    <td>{fmt3(row.xtDefense)}</td>
                    <td>{row.reaction5sCount}</td>
                    <td>{row.badReaction5sCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === 'map' ? (
        <section className={styles.mapSection} aria-labelledby="loses-map-title">
          <h3 className={styles.mapSectionTitle} id="loses-map-title">Heatmapa strat — {teamShort}</h3>
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
            Kliknij strefę na heatmapie — w panelu zobaczysz straty w ataku i w obronie. Wideo otwiera się po kliknięciu niebieskiej minuty.
          </p>
          <div className={styles.mainLayout}>
            <div className={styles.mapPanel}>
              <PlayerHeatmapPitch
                heatmapData={heatmapData}
                category="loses"
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
                        <p className={styles.pxtZoneRoleEmpty}>Brak strat w tym kontekście.</p>
                      ) : (
                        <ul className={styles.pxtZoneActionsList}>
                          {group.actions.map((action) => {
                            const halfLabel = action.minute > 45 ? 'II' : 'I';
                            const videoSec = getVideoTimestampSeconds(action);
                            const canVideo = hasExternalVideoSource(matchInfo) && videoSec !== null;
                            const { attackXt, defenseXt } = getLosesXtValues(action);
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
                                  {getPlayerLabel(action.senderId, playersIndex)} · xT {fmt3(xtLabel)} · {loseReactionLabel(action)}
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
                <p className={styles.shotPanelEmpty}>Kliknij strefę na heatmapie, aby zobaczyć straty w ataku i w obronie.</p>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </div>
  );
}
