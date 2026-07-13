'use client';

import React from 'react';
import { TrendyMapSideFilter, TrendyXgMapBodyPartFilter } from '@/utils/trendyMapFilters';
import {
  WIEDZA_SFG_PHASE_OPTIONS,
  WIEDZA_SFG_SUBTYPE_OPTIONS,
  WIEDZA_SFG_TYPE_OPTIONS,
  WIEDZA_SHOT_ACTION_CATEGORY_OPTIONS,
  WIEDZA_SHOT_OUTCOME_OPTIONS,
  WiedzaSfgPhaseFilter,
  WiedzaSfgSubtypeFilter,
  WiedzaSfgTypeFilter,
  WiedzaShotsFilterState,
  withWiedzaShotActionCategory,
} from '@/utils/wiedzaShotsFilters';
import styles from './WiedzaShotsTab.module.css';

const TEAM_STATS_GREEN = '#059669';
const TEAM_STATS_RED = '#dc2626';

const BODY_PART_OPTIONS: { value: TrendyXgMapBodyPartFilter; label: string }[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'foot', label: 'Noga' },
  { value: 'foot_left', label: 'Lewa' },
  { value: 'foot_right', label: 'Prawa' },
  { value: 'head', label: 'Głowa' },
  { value: 'other', label: 'Inne' },
];

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

function parseXgRangeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

function formatXgRangeInput(value: number | null): string {
  return value === null ? '' : String(value);
}

function XgRangeFilterSegment({
  xgMin,
  xgMax,
  onChange,
}: {
  xgMin: number | null;
  xgMax: number | null;
  onChange: (next: { xgMin: number | null; xgMax: number | null }) => void;
}) {
  const rangeActive = xgMin !== null || xgMax !== null;

  return (
    <FilterSegment label="xG">
      <div className={styles.xgRangeRow}>
        <label className={styles.xgRangeField}>
          <span className={styles.xgRangeFieldLabel}>Od</span>
          <input
            type="number"
            className={styles.xgRangeInput}
            min={0}
            max={1}
            step={0.01}
            inputMode="decimal"
            placeholder="0"
            value={formatXgRangeInput(xgMin)}
            onChange={(event) => onChange({ xgMin: parseXgRangeInput(event.target.value), xgMax })}
            aria-label="Minimalne xG"
          />
        </label>
        <span className={styles.xgRangeSep} aria-hidden="true">
          –
        </span>
        <label className={styles.xgRangeField}>
          <span className={styles.xgRangeFieldLabel}>Do</span>
          <input
            type="number"
            className={styles.xgRangeInput}
            min={0}
            max={1}
            step={0.01}
            inputMode="decimal"
            placeholder="1"
            value={formatXgRangeInput(xgMax)}
            onChange={(event) => onChange({ xgMin, xgMax: parseXgRangeInput(event.target.value) })}
            aria-label="Maksymalne xG"
          />
        </label>
        <FilterChip
          active={!rangeActive}
          onClick={() => onChange({ xgMin: null, xgMax: null })}
          title="Pokaż strzały z dowolnym xG"
        >
          Wszystkie
        </FilterChip>
      </div>
    </FilterSegment>
  );
}

type MapLegendProps = {
  filteredCount: number;
  totalCount: number;
  countLabel?: string;
  className?: string;
};

export function WiedzaShotsMapLegend({
  filteredCount,
  totalCount,
  countLabel = 'na mapie',
  className,
}: MapLegendProps) {
  return (
    <div className={`${styles.legendRow} ${styles.legendBelowMap} ${className ?? ''}`} aria-label="Legenda mapy xG">
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: TEAM_STATS_GREEN }} />
        Niski xG
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: '#fbbf24' }} />
        Średni xG
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: TEAM_STATS_RED }} />
        Wysoki xG
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.legendDot} ${styles.legendDotGoalRing}`} />
        Gol
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.legendDot} ${styles.legendDotHex}`} style={{ background: '#94a3b8' }} />
        SFG
      </span>
      <span className={styles.mapCount} title={`Wyświetlane / ${countLabel}`}>
        {filteredCount}/{totalCount}
      </span>
    </div>
  );
}

type Props = {
  filters: WiedzaShotsFilterState;
  onChange: (next: WiedzaShotsFilterState | ((prev: WiedzaShotsFilterState) => WiedzaShotsFilterState)) => void;
  mapSide?: TrendyMapSideFilter;
  onMapSideChange?: (side: TrendyMapSideFilter) => void;
  className?: string;
};

export default function WiedzaShotsMapFiltersPanel({
  filters,
  onChange,
  mapSide,
  onMapSideChange,
  className,
}: Props) {
  const showSfgSubtypeRow =
    filters.actionCategory === 'sfg' && filters.sfgType !== 'all' && filters.sfgType !== 'penalty';
  const showSfgPhaseRow = filters.actionCategory === 'sfg' && filters.sfgType !== 'penalty';

  return (
    <div className={`${styles.filtersPanel} ${className ?? ''}`}>
      <div className={styles.filtersRow}>
        <FilterSegment label="Ciało">
          {BODY_PART_OPTIONS.map(({ value, label }) => (
            <FilterChip
              key={value}
              active={filters.bodyPart === value}
              onClick={() => onChange((prev) => ({ ...prev, bodyPart: value }))}
            >
              {label}
            </FilterChip>
          ))}
        </FilterSegment>

        <FilterSegment label="Akcja">
          {WIEDZA_SHOT_ACTION_CATEGORY_OPTIONS.map(({ value, label }) => (
            <FilterChip
              key={value}
              active={filters.actionCategory === value}
              onClick={() => onChange((prev) => withWiedzaShotActionCategory(prev, value))}
            >
              {label}
            </FilterChip>
          ))}
        </FilterSegment>

        <FilterSegment label="Wynik">
          {WIEDZA_SHOT_OUTCOME_OPTIONS.map(({ value, label }) => (
            <FilterChip
              key={value}
              active={filters.outcome === value}
              onClick={() => onChange((prev) => ({ ...prev, outcome: value }))}
            >
              {label}
            </FilterChip>
          ))}
        </FilterSegment>

        <XgRangeFilterSegment
          xgMin={filters.xgMin}
          xgMax={filters.xgMax}
          onChange={({ xgMin, xgMax }) => onChange((prev) => ({ ...prev, xgMin, xgMax }))}
        />
      </div>

      {filters.actionCategory === 'sfg' ? (
        <div className={styles.filtersRow}>
          <FilterSegment label="Typ SFG">
            {WIEDZA_SFG_TYPE_OPTIONS.map(({ value, label }) => (
              <FilterChip
                key={value}
                active={filters.sfgType === value}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    sfgType: value as WiedzaSfgTypeFilter,
                    sfgSubtype: value === 'penalty' ? 'all' : prev.sfgSubtype,
                    sfgPhase: value === 'penalty' ? 'all' : prev.sfgPhase,
                  }))
                }
              >
                {label}
              </FilterChip>
            ))}
          </FilterSegment>

          {showSfgPhaseRow ? (
            <FilterSegment label="Faza SFG">
              {WIEDZA_SFG_PHASE_OPTIONS.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  active={filters.sfgPhase === value}
                  onClick={() => onChange((prev) => ({ ...prev, sfgPhase: value as WiedzaSfgPhaseFilter }))}
                >
                  {label}
                </FilterChip>
              ))}
            </FilterSegment>
          ) : null}

          {showSfgSubtypeRow ? (
            <FilterSegment label="Podrodzaj SFG">
              {WIEDZA_SFG_SUBTYPE_OPTIONS.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  active={filters.sfgSubtype === value}
                  onClick={() => onChange((prev) => ({ ...prev, sfgSubtype: value as WiedzaSfgSubtypeFilter }))}
                >
                  {label}
                </FilterChip>
              ))}
            </FilterSegment>
          ) : null}
        </div>
      ) : null}

      {mapSide !== undefined && onMapSideChange ? (
        <div className={styles.filtersRow}>
          <FilterSegment label="POV">
            <FilterChip active={mapSide === 'all'} onClick={() => onMapSideChange('all')}>
              Wszystkie
            </FilterChip>
            <FilterChip active={mapSide === 'attack'} onClick={() => onMapSideChange('attack')}>
              Atak
            </FilterChip>
            <FilterChip active={mapSide === 'defense'} onClick={() => onMapSideChange('defense')}>
              Obrona
            </FilterChip>
          </FilterSegment>
        </div>
      ) : null}
    </div>
  );
}
