'use client';

import React, { useMemo, useState } from 'react';
import XGPitch from '@/components/XGPitch/XGPitch';
import ZoomablePitchViewport from './ZoomablePitchViewport';
import WiedzaShotsMapFiltersPanel, { WiedzaShotsMapLegend } from './WiedzaShotsMapFiltersPanel';
import type { Player, TeamInfo } from '@/types';
import { collectMapShotsFromMatches, filterShotsByMapSide, type TrendyMapSideFilter } from '@/utils/trendyMapFilters';
import {
  DEFAULT_WIEDZA_SHOTS_FILTERS,
  filterShotsForWiedzaTab,
  WiedzaShotsFilterState,
} from '@/utils/wiedzaShotsFilters';
import { buildWiedzaShotsSummary, type WiedzaShotBreakdownRow } from '@/utils/wiedzaShotsSummary';
import {
  buildWiedzaShotMatchLabelLookup,
  getWiedzaShotMatchLabel,
} from '@/utils/wiedzaShotMatchLabels';
import wiedzaStyles from '@/app/admin/wiedza/wiedza.module.css';
import styles from './WiedzaShotsTab.module.css';
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

const PIE_COLORS = ['#2563eb', '#059669', '#f97316', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#94a3b8'];

type Props = {
  matches: TeamInfo[];
  players: Player[];
  teams: Array<{ id: string; name: string; logo?: string }>;
};

function BreakdownTable({
  title,
  rows,
  ariaLabel,
}: {
  title: string;
  rows: WiedzaShotBreakdownRow[];
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
              <th scope="col">Σ xG</th>
              <th scope="col">Śr. xG</th>
              <th scope="col">Gole</th>
              <th scope="col">Konw.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{row.count}</td>
                <td>{row.pct.toFixed(1)}%</td>
                <td>{row.xg.toFixed(2)}</td>
                <td>{row.avgXg.toFixed(3)}</td>
                <td>{row.goals}</td>
                <td>{row.conversionPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pieDataFromRows(rows: WiedzaShotBreakdownRow[]) {
  return rows.map((row) => ({ name: row.label, value: row.count, pct: row.pct }));
}

export default function WiedzaShotsTab({ matches, players, teams }: Props) {
  const [mapSide, setMapSide] = useState<TrendyMapSideFilter>('all');
  const [filters, setFilters] = useState<WiedzaShotsFilterState>(DEFAULT_WIEDZA_SHOTS_FILTERS);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>();

  const allShots = useMemo(() => collectMapShotsFromMatches(matches, 'both'), [matches]);

  const shotMatchLabels = useMemo(() => buildWiedzaShotMatchLabelLookup(matches, teams), [matches, teams]);

  const getShotMatchLabel = useMemo(
    () => (shot: { matchId?: string }) => getWiedzaShotMatchLabel(shot.matchId, shotMatchLabels),
    [shotMatchLabels],
  );

  const sideShots = useMemo(() => filterShotsByMapSide(allShots, mapSide), [allShots, mapSide]);

  const filteredShots = useMemo(() => filterShotsForWiedzaTab(sideShots, filters), [sideShots, filters]);

  const summary = useMemo(() => buildWiedzaShotsSummary(filteredShots), [filteredShots]);

  const matchCount = matches.length;
  const primaryTeamId = matches[0]?.team ?? teams[0]?.id ?? '';
  const primaryTeamName = teams.find((t) => t.id === primaryTeamId)?.name ?? 'Zespół';

  const pitchMatchInfo = useMemo(
    () => ({
      team: primaryTeamId,
      teamName: mapSide === 'defense' ? 'Przeciwnik' : primaryTeamName,
      opponentName: `${matchCount} ${matchCount === 1 ? 'mecz' : matchCount < 5 ? 'mecze' : 'meczów'}`,
    }),
    [primaryTeamId, primaryTeamName, matchCount, mapSide],
  );

  const actionPieData = useMemo(() => pieDataFromRows(summary.byActionCategory), [summary.byActionCategory]);
  const shotTypeBarData = useMemo(() => pieDataFromRows(summary.byShotType), [summary.byShotType]);
  const xgBucketBarData = useMemo(() => pieDataFromRows(summary.byXgBucket), [summary.byXgBucket]);

  if (matches.length === 0) {
    return (
      <div className={wiedzaStyles.correlationMergedPanel}>
        <h2 className={wiedzaStyles.correlationTabTitle}>Strzały</h2>
        <p className={wiedzaStyles.correlationTabLead}>
          Mapa strzałów z perspektywy POV (<code className={wiedzaStyles.inlineCode}>teamContext</code>): atak = nasz zespół,
          obrona = przeciwnik. Jedno kliknięcie wybiera kategorię — bez odznaczania wielu filtrów.
        </p>
        <div className={wiedzaStyles.emptyState} role="status">
          Wybierz zespoły, ustaw zakres dat i kliknij „Analizuj”, aby załadować strzały z meczów.
        </div>
      </div>
    );
  }

  if (allShots.length === 0) {
    return (
      <div className={wiedzaStyles.correlationMergedPanel}>
        <h2 className={wiedzaStyles.correlationTabTitle}>Strzały</h2>
        <p className={wiedzaStyles.correlationTabLead}>
          W wybranej próbie nie ma zapisanych strzałów. Upewnij się, że mecze mają oznaczone strzały w analizatorze.
        </p>
        <div className={wiedzaStyles.emptyState} role="status">
          Brak strzałów w {matchCount} pobranych meczach.
        </div>
      </div>
    );
  }

  return (
    <div className={wiedzaStyles.correlationMergedPanel}>
      <h2 className={wiedzaStyles.correlationTabTitle}>Strzały</h2>
      <p className={wiedzaStyles.correlationTabLead}>
        Próba: <strong>{matchCount}</strong> meczów, <strong>{allShots.length}</strong> strzałów łącznie. POV (
        <code className={wiedzaStyles.inlineCode}>teamContext</code>) określa stronę boiska. <strong>Akcja</strong> i{' '}
        <strong>wynik</strong> filtrują niezależnie (np. SFG + Gol). Mapę można powiększać kółkiem myszy, pinch-em lub
        przyciskami.
      </p>

      <div className={wiedzaStyles.summaryCards}>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Strzały (po filtrach)</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.totalShots}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Σ xG</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.totalXg.toFixed(2)}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Gole</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.goals}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Śr. xG / strzał</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.avgXg.toFixed(3)}</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Celne</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.onTargetPct.toFixed(1)}%</span>
        </div>
        <div className={wiedzaStyles.summaryCard}>
          <span className={wiedzaStyles.summaryCardLabel}>Konwersja</span>
          <span className={wiedzaStyles.summaryCardValue}>{summary.conversionPct.toFixed(1)}%</span>
        </div>
      </div>

      <WiedzaShotsMapFiltersPanel
        filters={filters}
        onChange={setFilters}
        mapSide={mapSide}
        onMapSideChange={setMapSide}
      />

      <div className={styles.mapFullWidth}>
        {filteredShots.length > 0 ? (
          <ZoomablePitchViewport>
            <div className={styles.pitchFullWidth}>
              <XGPitch
                shots={filteredShots}
                onShotAdd={() => {}}
                players={players}
                selectedShotId={selectedShotId}
                onShotClick={(shot) => setSelectedShotId(shot.id)}
                onPinTooltipChange={(shot) => setSelectedShotId(shot?.id)}
                getShotMatchLabel={getShotMatchLabel}
                pinTooltipOnClick
                matchInfo={pitchMatchInfo}
                allTeams={teams}
                hideToggleButton={true}
                hideTeamLogos={true}
              />
            </div>
          </ZoomablePitchViewport>
        ) : (
          <p className={styles.emptyPitch} role="status">
            Brak strzałów do wyświetlenia przy aktualnych filtrach.
          </p>
        )}
        <WiedzaShotsMapLegend
          filteredCount={filteredShots.length}
          totalCount={sideShots.length}
          countLabel="strona POV"
        />
      </div>

      <div className={styles.statsGrid}>
        {actionPieData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Rodzaj akcji (% strzałów)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={actionPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={78}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {actionPieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const pct = item?.payload?.pct;
                    return [`${value} (${typeof pct === 'number' ? pct.toFixed(1) : '—'}%)`, 'Strzały'];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {shotTypeBarData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Typ strzału</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shotTypeBarData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const pct = item?.payload?.pct;
                    return [`${value} (${typeof pct === 'number' ? pct.toFixed(1) : '—'}%)`, 'Strzały'];
                  }}
                />
                <Bar dataKey="value" name="Strzały" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {shotTypeBarData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {xgBucketBarData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Rozkład xG</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={xgBucketBarData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                  formatter={(value: number, _name, item) => {
                    const pct = item?.payload?.pct;
                    return [`${value} (${typeof pct === 'number' ? pct.toFixed(1) : '—'}%)`, 'Strzały'];
                  }}
                />
                <Bar dataKey="value" name="Strzały" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <BreakdownTable
          title="Szczegóły — rodzaj akcji"
          rows={summary.byActionCategory}
          ariaLabel="Tabela strzałów według rodzaju akcji"
        />
        <BreakdownTable
          title="Szczegóły — typ strzału"
          rows={summary.byShotType}
          ariaLabel="Tabela strzałów według typu"
        />
        <BreakdownTable
          title="Szczegóły — część ciała"
          rows={summary.byBodyPart}
          ariaLabel="Tabela strzałów według części ciała"
        />
        <BreakdownTable
          title="Szczegóły — przedziały xG"
          rows={summary.byXgBucket}
          ariaLabel="Tabela strzałów według przedziałów xG"
        />
      </div>
    </div>
  );
}
