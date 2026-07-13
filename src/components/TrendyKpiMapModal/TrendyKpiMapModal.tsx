"use client";

import React, { useEffect, useMemo, useState } from "react";
import XGPitch from "@/components/XGPitch/XGPitch";
import PKEntriesPitch from "@/components/PKEntriesPitch/PKEntriesPitch";
import PlayerHeatmapPitch from "@/components/PlayerHeatmapPitch/PlayerHeatmapPitch";
import { PKEntry, Player, Shot } from "@/types";
import { TrendyMapSide, TrendyXgMapBodyPartFilter } from "@/utils/trendyMapFilters";
import {
  DEFAULT_WIEDZA_PK_ENTRIES_FILTERS,
  filterPkEntriesForWiedzaTab,
  WIEDZA_PK_ENTRY_TYPE_OPTIONS,
  WIEDZA_PK_OUTCOME_OPTIONS,
  WiedzaPkEntriesFilterState,
  WiedzaPkEntryTypeFilter,
  WiedzaPkOutcomeFilter,
} from "@/utils/wiedzaPkEntriesFilters";
import {
  DEFAULT_WIEDZA_SHOTS_FILTERS,
  filterShotsForWiedzaTab,
  WIEDZA_SHOT_ACTION_CATEGORY_OPTIONS,
  WIEDZA_SHOT_OUTCOME_OPTIONS,
  WIEDZA_SFG_PHASE_OPTIONS,
  WIEDZA_SFG_SUBTYPE_OPTIONS,
  WIEDZA_SFG_TYPE_OPTIONS,
  withWiedzaShotActionCategory,
  WiedzaSfgPhaseFilter,
  WiedzaSfgSubtypeFilter,
  WiedzaSfgTypeFilter,
  WiedzaShotsFilterState,
} from "@/utils/wiedzaShotsFilters";
import styles from "./TrendyKpiMapModal.module.css";

const TEAM_STATS_GREEN = "#059669";
const TEAM_STATS_RED = "#dc2626";

export type TrendyKpiMapModalKind = "shots" | "pk" | "regains_opp_half";

export type TrendyKpiMapModalProps = {
  kind: TrendyKpiMapModalKind;
  title: string;
  matchCount: number;
  teamId: string;
  teamName?: string;
  shots: Shot[];
  pkEntries: PKEntry[];
  regainsHeatmap?: Map<string, number>;
  regainsCount?: number;
  players: Player[];
  allTeams: Array<{ id: string; name: string; logo?: string }>;
  onClose: () => void;
};

function FilterSegment({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.modalFilterSegment}>
      <span className={styles.modalFilterLabel}>{label}</span>
      <div className={styles.modalChipRow}>{children}</div>
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
      className={`${styles.modalChip} ${active ? styles.active : ""}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function SideFilterSegment({
  mapSide,
  onChange,
}: {
  mapSide: TrendyMapSide;
  onChange: (side: TrendyMapSide) => void;
}) {
  return (
    <FilterSegment label="Strona">
      <FilterChip active={mapSide === "attack"} onClick={() => onChange("attack")}>
        Nasz zespół
      </FilterChip>
      <FilterChip active={mapSide === "defense"} onClick={() => onChange("defense")}>
        Przeciwnik
      </FilterChip>
    </FilterSegment>
  );
}

const BODY_PART_OPTIONS: { value: TrendyXgMapBodyPartFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "foot", label: "Noga" },
  { value: "foot_left", label: "Lewa" },
  { value: "foot_right", label: "Prawa" },
  { value: "head", label: "Głowa" },
  { value: "other", label: "Inne" },
];

function parseXgRangeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

function formatXgRangeInput(value: number | null): string {
  return value === null ? "" : String(value);
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
      <div className={styles.modalXgRangeRow}>
        <label className={styles.modalXgRangeField}>
          <span className={styles.modalXgRangeFieldLabel}>Od</span>
          <input
            type="number"
            className={styles.modalXgRangeInput}
            min={0}
            max={1}
            step={0.01}
            inputMode="decimal"
            placeholder="0"
            value={formatXgRangeInput(xgMin)}
            onChange={(event) =>
              onChange({ xgMin: parseXgRangeInput(event.target.value), xgMax })
            }
            aria-label="Minimalne xG"
          />
        </label>
        <span className={styles.modalXgRangeSep} aria-hidden="true">
          –
        </span>
        <label className={styles.modalXgRangeField}>
          <span className={styles.modalXgRangeFieldLabel}>Do</span>
          <input
            type="number"
            className={styles.modalXgRangeInput}
            min={0}
            max={1}
            step={0.01}
            inputMode="decimal"
            placeholder="1"
            value={formatXgRangeInput(xgMax)}
            onChange={(event) =>
              onChange({ xgMin, xgMax: parseXgRangeInput(event.target.value) })
            }
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

function MapLegend({ kind }: { kind: TrendyKpiMapModalKind }) {
  if (kind === "pk") {
    return (
      <div className={styles.modalLegendRow} aria-label="Legenda wejść w pole karne">
        <span className={styles.modalLegendItem}>
          <span className={styles.modalLegendLine} style={{ background: TEAM_STATS_RED }} />
          Podanie
        </span>
        <span className={styles.modalLegendItem}>
          <span className={styles.modalLegendLine} style={{ background: "#1e40af" }} />
          Drybling
        </span>
        <span className={styles.modalLegendItem}>
          <span className={styles.modalLegendLine} style={{ background: TEAM_STATS_GREEN }} />
          SFG
        </span>
        <span className={styles.modalLegendItem}>
          <span
            className={styles.modalLegendDot}
            style={{ background: "#86efac", border: "1px solid #fff", boxSizing: "border-box" }}
          />
          Gol
        </span>
        <span className={styles.modalLegendItem}>
          <span
            className={styles.modalLegendDot}
            style={{ background: "#111827", border: "1px solid #fff", boxSizing: "border-box" }}
          />
          Strzał
        </span>
        <span className={styles.modalLegendItem}>
          <span
            className={styles.modalLegendDot}
            style={{ background: "white", border: "1.5px solid #f59e0b", boxSizing: "border-box" }}
          />
          Regain
        </span>
      </div>
    );
  }

  return (
    <div className={styles.modalLegendRow} aria-label="Legenda mapy xG">
      <span className={styles.modalLegendItem}>
        <span className={styles.modalLegendDot} style={{ background: TEAM_STATS_GREEN }} />
        Niski xG
      </span>
      <span className={styles.modalLegendItem}>
        <span className={styles.modalLegendDot} style={{ background: "#fbbf24" }} />
        Średni xG
      </span>
      <span className={styles.modalLegendItem}>
        <span className={styles.modalLegendDot} style={{ background: TEAM_STATS_RED }} />
        Wysoki xG
      </span>
      <span className={styles.modalLegendItem}>
        <span className={`${styles.modalLegendDot} ${styles.modalLegendDotGoalRing}`} />
        Gol
      </span>
      <span className={styles.modalLegendItem}>
        <span
          className={`${styles.modalLegendDot} ${styles.modalLegendDotHex}`}
          style={{ background: "#94a3b8" }}
        />
        SFG
      </span>
    </div>
  );
}

export default function TrendyKpiMapModal({
  kind,
  title,
  matchCount,
  teamId,
  teamName,
  shots,
  pkEntries,
  regainsHeatmap,
  regainsCount = 0,
  players,
  allTeams,
  onClose,
}: TrendyKpiMapModalProps) {
  const [shotsFilters, setShotsFilters] = useState<WiedzaShotsFilterState>(DEFAULT_WIEDZA_SHOTS_FILTERS);
  const [pkFilters, setPkFilters] = useState<WiedzaPkEntriesFilterState>(DEFAULT_WIEDZA_PK_ENTRIES_FILTERS);
  const [mapSide, setMapSide] = useState<TrendyMapSide>("attack");

  useEffect(() => {
    setShotsFilters(DEFAULT_WIEDZA_SHOTS_FILTERS);
    setPkFilters(DEFAULT_WIEDZA_PK_ENTRIES_FILTERS);
    setMapSide("attack");
  }, [kind, matchCount, teamId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sideShots = useMemo(
    () => shots.filter((shot) => (shot.teamContext ?? "attack") === mapSide),
    [shots, mapSide],
  );

  const sidePkEntries = useMemo(
    () => pkEntries.filter((entry) => (entry.teamContext ?? "attack") === mapSide),
    [pkEntries, mapSide],
  );

  const filteredShots = useMemo(
    () => filterShotsForWiedzaTab(sideShots, shotsFilters),
    [sideShots, shotsFilters],
  );

  const filteredPkEntries = useMemo(
    () => filterPkEntriesForWiedzaTab(sidePkEntries, pkFilters),
    [sidePkEntries, pkFilters],
  );

  const showSfgSubtypeRow =
    shotsFilters.actionCategory === "sfg" &&
    shotsFilters.sfgType !== "all" &&
    shotsFilters.sfgType !== "penalty";

  const showSfgPhaseRow = shotsFilters.actionCategory === "sfg" && shotsFilters.sfgType !== "penalty";

  const pitchMatchInfo = useMemo(
    () => ({
      team: teamId,
      teamName: mapSide === "attack" ? teamName : "Przeciwnik",
      opponentName: `${matchCount} ${matchCount === 1 ? "mecz" : matchCount < 5 ? "mecze" : "meczów"}`,
    }),
    [teamId, teamName, matchCount, mapSide],
  );

  const visibleCount = kind === "regains_opp_half"
    ? regainsCount
    : kind === "pk"
      ? filteredPkEntries.length
      : filteredShots.length;
  const totalCount = kind === "regains_opp_half"
    ? regainsCount
    : kind === "pk"
      ? sidePkEntries.length
      : sideShots.length;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trendy-kpi-map-modal-title"
      onClick={onClose}
    >
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2 id="trendy-kpi-map-modal-title" className={styles.modalTitle}>
            {title}
          </h2>
          <div className={styles.modalHeaderActions}>
            <span className={styles.modalCount} title="Wyświetlane zdarzenia po filtrach">
              {visibleCount}/{totalCount}
            </span>
            <button type="button" className={styles.modalClose} aria-label="Zamknij" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.modalPitchArea}>
            {kind === "regains_opp_half" ? (
              regainsCount > 0 && regainsHeatmap ? (
                <div className={styles.modalHeatmapWrap}>
                  <PlayerHeatmapPitch
                    heatmapData={regainsHeatmap}
                    category="regains"
                    mode="count"
                    valueLabel="Przechwyty"
                  />
                </div>
              ) : (
                <p className={styles.modalEmpty}>Brak przechwytów na połowie przeciwnika.</p>
              )
            ) : kind === "pk" ? (
              filteredPkEntries.length > 0 ? (
                <PKEntriesPitch
                  pkEntries={filteredPkEntries}
                  players={players}
                  onEntryClick={() => {}}
                  matchInfo={pitchMatchInfo}
                  allTeams={allTeams}
                  hideTeamLogos={true}
                  hideFlipButton={false}
                  hideInstructions={true}
                />
              ) : (
                <p className={styles.modalEmpty}>Brak wejść w PK do wyświetlenia.</p>
              )
            ) : filteredShots.length > 0 ? (
              <XGPitch
                shots={filteredShots}
                onShotAdd={() => {}}
                players={players}
                onShotClick={() => {}}
                matchInfo={pitchMatchInfo}
                allTeams={allTeams}
                hideToggleButton={true}
                hideTeamLogos={true}
              />
            ) : (
              <p className={styles.modalEmpty}>Brak strzałów do wyświetlenia.</p>
            )}
          </div>

          {kind === "regains_opp_half" ? (
            <footer className={styles.modalBottomPanel}>
              <div className={styles.modalLegendRow} aria-label="Opis mapy przechwytów">
                <span className={styles.modalLegendItem}>
                  Strefa ataku po przechwycie · połowa przeciwnika · intensywność koloru = liczba akcji
                </span>
              </div>
            </footer>
          ) : (
            <footer className={styles.modalBottomPanel}>
              <MapLegend kind={kind} />

              <div className={styles.modalFiltersRow}>
                <SideFilterSegment mapSide={mapSide} onChange={setMapSide} />

                {kind === "pk" ? (
                  <>
                    <FilterSegment label="Typ">
                      {WIEDZA_PK_ENTRY_TYPE_OPTIONS.map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          active={pkFilters.entryType === value}
                          onClick={() =>
                            setPkFilters((prev) => ({ ...prev, entryType: value as WiedzaPkEntryTypeFilter }))
                          }
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                    <FilterSegment label="Skutek">
                      {WIEDZA_PK_OUTCOME_OPTIONS.map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          active={pkFilters.outcome === value}
                          onClick={() =>
                            setPkFilters((prev) => ({ ...prev, outcome: value as WiedzaPkOutcomeFilter }))
                          }
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                  </>
                ) : (
                  <>
                    <FilterSegment label="Ciało">
                      {BODY_PART_OPTIONS.map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          active={shotsFilters.bodyPart === value}
                          onClick={() => setShotsFilters((prev) => ({ ...prev, bodyPart: value }))}
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                    <FilterSegment label="Akcja">
                      {WIEDZA_SHOT_ACTION_CATEGORY_OPTIONS.map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          active={shotsFilters.actionCategory === value}
                          onClick={() =>
                            setShotsFilters((prev) => withWiedzaShotActionCategory(prev, value))
                          }
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                    <FilterSegment label="Wynik">
                      {WIEDZA_SHOT_OUTCOME_OPTIONS.map(({ value, label }) => (
                        <FilterChip
                          key={value}
                          active={shotsFilters.outcome === value}
                          onClick={() => setShotsFilters((prev) => ({ ...prev, outcome: value }))}
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                    <XgRangeFilterSegment
                      xgMin={shotsFilters.xgMin}
                      xgMax={shotsFilters.xgMax}
                      onChange={({ xgMin, xgMax }) =>
                        setShotsFilters((prev) => ({ ...prev, xgMin, xgMax }))
                      }
                    />
                  </>
                )}
              </div>

              {kind === "shots" && shotsFilters.actionCategory === "sfg" ? (
                <div className={styles.modalFiltersRow}>
                  <FilterSegment label="Typ SFG">
                    {WIEDZA_SFG_TYPE_OPTIONS.map(({ value, label }) => (
                      <FilterChip
                        key={value}
                        active={shotsFilters.sfgType === value}
                        onClick={() =>
                          setShotsFilters((prev) => ({
                            ...prev,
                            sfgType: value as WiedzaSfgTypeFilter,
                            sfgSubtype: value === "penalty" ? "all" : prev.sfgSubtype,
                            sfgPhase: value === "penalty" ? "all" : prev.sfgPhase,
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
                          active={shotsFilters.sfgPhase === value}
                          onClick={() =>
                            setShotsFilters((prev) => ({ ...prev, sfgPhase: value as WiedzaSfgPhaseFilter }))
                          }
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
                          active={shotsFilters.sfgSubtype === value}
                          onClick={() =>
                            setShotsFilters((prev) => ({
                              ...prev,
                              sfgSubtype: value as WiedzaSfgSubtypeFilter,
                            }))
                          }
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </FilterSegment>
                  ) : null}
                </div>
              ) : null}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
