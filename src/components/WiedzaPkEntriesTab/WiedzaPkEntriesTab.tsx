'use client';

import React, { useMemo, useState } from 'react';
import PKEntriesPitch from '@/components/PKEntriesPitch/PKEntriesPitch';
import ZoomablePitchViewport from '@/components/WiedzaShotsTab/ZoomablePitchViewport';
import type { Player, TeamInfo } from '@/types';
import { collectMapPkEntriesFromMatches, TrendyMapSide } from '@/utils/trendyMapFilters';
import {
  DEFAULT_WIEDZA_PK_ENTRIES_FILTERS,
  filterPkEntriesForWiedzaTab,
  WIEDZA_PK_ENTRY_TYPE_OPTIONS,
  WIEDZA_PK_OUTCOME_OPTIONS,
  WiedzaPkEntriesFilterState,
  WiedzaPkEntryTypeFilter,
  WiedzaPkOutcomeFilter,
} from '@/utils/wiedzaPkEntriesFilters';
import { buildWiedzaPkEntriesSummary, type WiedzaPkBreakdownRow } from '@/utils/wiedzaPkEntriesSummary';
import wiedzaStyles from '@/app/admin/wiedza/wiedza.module.css';
import styles from '../WiedzaShotsTab/WiedzaShotsTab.module.css';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const TEAM_STATS_GREEN = '#059669';
const TEAM_STATS_RED = '#dc2626';

const PIE_COLORS = ['#2563eb', '#059669', '#f97316', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#94a3b8'];

type Props = {
  matches: TeamInfo[];
  players: Player[];
  teams: Array<{ id: string; name: string; logo?: string }>;
};

function FilterSegment({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.filterSegment}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.chipRow}>{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function BreakdownTable({
  title,
  rows,
  ariaLabel,
}: {
  title: string;
  rows: WiedzaPkBreakdownRow[];
  ariaLabel: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.breakdownTableWrap}>
        <table className={styles.breakdownTable} aria-label={ariaLabel}>
          <thead>
            <tr>
              <th scope="col">Kategoria</th>
              <th scope="col">n</th>
              <th scope="col">%</th>
              <th scope="col">Strzały</th>
              <th scope="col">Gole</th>
              <th scope="col">Po regainie</th>
              <th scope="col">% strzał</th>
              <th scope="col">Gol/strzał</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{row.count}</td>
                <td>{row.pct.toFixed(1)}%</td>
                <td>{row.shots}</td>
                <td>{row.goals}</td>
                <td>{row.regains}</td>
                <td>{row.shotPct.toFixed(1)}%</td>
                <td>{row.goalFromShotPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pieDataFromRows(rows: WiedzaPkBreakdownRow[]) {
  return rows.map((row) => ({ name: row.label, value: row.count, pct: row.pct }));
}

export default function WiedzaPkEntriesTab({ matches, players, teams }: Props) {
  const [mapSide, setMapSide] = useState<TrendyMapSide>('attack');
  const [filters, setFilters] = useState<WiedzaPkEntriesFilterState>(DEFAULT_WIEDZA_PK_ENTRIES_FILTERS);
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();

  const allEntries = useMemo(() => collectMapPkEntriesFromMatches(matches, 'both'), [matches]);

  const sideEntries = useMemo(
    () => allEntries.filter((entry) => (entry.teamContext ?? 'attack') === mapSide),
    [allEntries, mapSide],
  );

  const filteredEntries = useMemo(
    () => filterPkEntriesForWiedzaTab(sideEntries, filters),
    [sideEntries, filters],
  );

  const summary = useMemo(() => buildWiedzaPkEntriesSummary(filteredEntries), [filteredEntries]);

  const matchCount = matches.length;
  const primaryTeamId = matches[0]?.team ?? teams[0]?.id ?? '';
  const primaryTeamName = teams.find((t) => t.id === primaryTeamId)?.name ?? 'Zespół';

  const pitchMatchInfo = useMemo(
    () => ({
      team: primaryTeamId,
      teamName: mapSide === 'attack' ? primaryTeamName : 'Przeciwnik',
      opponentName: `${matchCount} ${matchCount === 1 ? 'mecz' : matchCount < 5 ? 'mecze' : 'meczów'}`,
    }),
    [primaryTeamId, primaryTeamName, matchCount, mapSide],
  );

  const entryTypePieData = useMemo(() => pieDataFromRows(summary.byEntryType), [summary.byEntryType]);
  const outcomeBarData = useMemo(() => pieDataFromRows(summary.byOutcome), [summary.byOutcome]);

  if (matches.length === 0) {
    return (
      <div className={wiedzaStyles.correlationMergedPanel}>
        <h2 className={wiedzaStyles.correlationTabTitle}>Wejścia w pole karne</h2>
        <p className={wiedzaStyles.correlationTabLead}>
          Mapa wejść w PK z perspektywy POV (<code className={wiedzaStyles.inlineCode}>teamContext</code>): atak = nasz
          zespół, obrona = przeciwnik.
        </p>
        <div className={wiedzaStyles.emptyState} role="status">
          Wybierz zespoły, ustaw zakres dat i kliknij „Analizuj”, aby załadować wejścia z meczów.
        </div>
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className={wiedzaStyles.correlationMergedPanel}>
        <h2 className={wiedzaStyles.correlationTabTitle}>Wejścia w pole karne</h2>
        <p className={wiedzaStyles.correlationTabLead}>
          W wybranej próbie nie ma zapisanych wejść w pole karne. Upewnij się, że mecze mają oznaczone wejścia PK w
          analizatorze.
        </p>
        <div className={wiedzaStyles.emptyState} role="status">
          Brak wejść w PK w {matchCount} pobranych meczach.
        </div>
      </div>
    );
  }

  return (
    <div className={wiedzaStyles.correlationMergedPanel}>
      <h2 className={wiedzaStyles.correlationTabTitle}>Wejścia w pole karne</h2>
      <p className={wiedzaStyles.correlationTabLead}>
        Próba: <strong>{matchCount}</strong> meczów, <strong>{allEntries.length}</strong> wejść łącznie. POV (
        <code className={wiedzaStyles.inlineCode}>teamContext</code>) określa stronę boiska. <strong>Typ</strong> i{' '}
        <strong>skutek</strong> filtrują niezależnie (np. SFG + Gol). Mapę można powiększać kółkiem myszy, pinch-em lub
        przyciskami.
      </p>

      <div className={wiedzaStyles.summaryCards}>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Wejścia (po filtrach)</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.totalEntries}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Strzały po wejściu</span>
          <span className={wiedzaStyles.summaryCardValue}>
            {summary.shots} ({summary.shotPct.toFixed(1)}%)
          </span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Gole po wejściu</span>
          <span className={wiedzaStyles.summaryCardValue}>
            {summary.goals}
            {summary.shots > 0 ? ` (${summary.goalFromShotPct.toFixed(1)}% ze strzałów)` : ''}
          </span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Wejścia po regainie</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.regainPct.toFixed(1)}%</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Śr. partnerzy w PK</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.avgPartners.toFixed(2)}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Śr. przeciwnicy w PK</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.avgOpponents.toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.filtersPanel}>
        <div className={styles.legendRow} aria-label="Legenda mapy wejść w pole karne">
          <span className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: TEAM_STATS_RED }} />
            Podanie
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: '#1e40af' }} />
            Drybling
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: TEAM_STATS_GREEN }} />
            SFG
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotGoalRing}`} />
            Gol
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#111827', border: '1px solid #fff' }} />
            Strzał
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: 'white', border: '1.5px solid #f59e0b', boxSizing: 'border-box' }}
            />
            Po regainie
          </span>
          <span className={styles.mapCount} title="Wyświetlane / strona POV">
            {filteredEntries.length}/{sideEntries.length}
          </span>
        </div>

        <div className={styles.filtersRow}>
          <FilterSegment label="POV">
            <FilterChip active={mapSide === 'attack'} onClick={() => setMapSide('attack')}>
              Nasz zespół
            </FilterChip>
            <FilterChip active={mapSide === 'defense'} onClick={() => setMapSide('defense')}>
              Przeciwnik
            </FilterChip>
          </FilterSegment>

          <FilterSegment label="Typ">
            {WIEDZA_PK_ENTRY_TYPE_OPTIONS.map(({ value, label }) => (
              <FilterChip
                key={value}
                active={filters.entryType === value}
                onClick={() => setFilters((prev) => ({ ...prev, entryType: value as WiedzaPkEntryTypeFilter }))}
              >
                {label}
              </FilterChip>
            ))}
          </FilterSegment>

          <FilterSegment label="Skutek">
            {WIEDZA_PK_OUTCOME_OPTIONS.map(({ value, label }) => (
              <FilterChip
                key={value}
                active={filters.outcome === value}
                onClick={() => setFilters((prev) => ({ ...prev, outcome: value as WiedzaPkOutcomeFilter }))}
              >
                {label}
              </FilterChip>
            ))}
          </FilterSegment>
        </div>
      </div>

      <div className={styles.mapFullWidth}>
        {filteredEntries.length > 0 ? (
          <ZoomablePitchViewport>
            <div className={styles.pitchFullWidth}>
              <PKEntriesPitch
                pkEntries={filteredEntries}
                players={players}
                selectedEntryId={selectedEntryId}
                onEntryClick={(entry) => setSelectedEntryId(entry.id)}
                matchInfo={pitchMatchInfo}
                allTeams={teams}
                hideTeamLogos={true}
                hideFlipButton={true}
                hideInstructions={true}
              />
            </div>
          </ZoomablePitchViewport>
        ) : (
          <p className={styles.emptyPitch} role="status">
            Brak wejść w PK do wyświetlenia przy aktualnych filtrach.
          </p>
        )}
      </div>

      <div className={styles.statsGrid}>
        {entryTypePieData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Typ wejścia (% wszystkich)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={entryTypePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={78}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {entryTypePieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const pct = item?.payload?.pct;
                    return [`${value} (${typeof pct === 'number' ? pct.toFixed(1) : '—'}%)`, 'Wejścia'];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {outcomeBarData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Skutek po wejściu</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outcomeBarData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const pct = item?.payload?.pct;
                    return [`${value} (${typeof pct === 'number' ? pct.toFixed(1) : '—'}%)`, 'Wejścia'];
                  }}
                />
                <Bar dataKey="value" name="Wejścia" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {outcomeBarData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <BreakdownTable
          title="Szczegóły — typ wejścia"
          rows={summary.byEntryType}
          ariaLabel="Tabela wejść według typu"
        />
        <BreakdownTable
          title="Szczegóły — skutek po wejściu"
          rows={summary.byOutcome}
          ariaLabel="Tabela wejść według skutku"
        />
      </div>
    </div>
  );
}
