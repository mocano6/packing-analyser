import PositionsMultiSelectorModal from "@/components/PositionsMultiSelectorModal/PositionsMultiSelectorModal";
import {
  supportsComparisonMetricRole,
  type PlayerComparisonMetricFamily,
  type PlayerComparisonMetricRole,
  type PlayerComparisonRankingSelectOption,
} from "@/utils/playerComparisonMetrics";

export type PlayerComparisonRankingToolbarProps = {
  styles: { readonly [key: string]: string };
  idPrefix: string;
  metricFamily: PlayerComparisonMetricFamily;
  onMetricFamilyChange: (family: PlayerComparisonMetricFamily) => void;
  metricRole: PlayerComparisonMetricRole;
  onMetricRoleChange: (role: PlayerComparisonMetricRole) => void;
  rankingKpiSelectOptions: ReadonlyArray<PlayerComparisonRankingSelectOption>;
  mode: "sum" | "per90";
  onModeChange: (mode: "sum" | "per90") => void;
  excludeExtremeMatches: boolean;
  onExcludeExtremeMatchesChange: (value: boolean) => void;
  comparisonLoaded: boolean;
  positionsCatalog: string[];
  selectedPositions: string[];
  onSelectedPositionsChange: (positions: string[]) => void;
  minMinutesStr: string;
  onMinMinutesStrChange: (value: string) => void;
  minMatchesStr: string;
  onMinMatchesStrChange: (value: string) => void;
};

export default function PlayerComparisonRankingToolbar({
  styles,
  idPrefix,
  metricFamily,
  onMetricFamilyChange,
  metricRole,
  onMetricRoleChange,
  rankingKpiSelectOptions,
  mode,
  onModeChange,
  excludeExtremeMatches,
  onExcludeExtremeMatchesChange,
  comparisonLoaded,
  positionsCatalog,
  selectedPositions,
  onSelectedPositionsChange,
  minMinutesStr,
  onMinMinutesStrChange,
  minMatchesStr,
  onMinMatchesStrChange,
}: PlayerComparisonRankingToolbarProps) {
  const metricSelectId = `${idPrefix}-kpi-metric`;
  const roleLabelId = `${idPrefix}-role-label`;
  const aggLabelId = `${idPrefix}-agg-label`;
  const extremeLabelId = `${idPrefix}-extreme-label`;
  const extremeToggleId = `${idPrefix}-extreme-toggle`;
  const extremeTipId = `${idPrefix}-extreme-tip`;
  const minMinutesId = `${idPrefix}-min-minutes-threshold`;
  const minMatchesId = `${idPrefix}-min-matches-threshold`;

  return (
    <div className={styles.rankingToolbarStrip}>
      <div className={styles.rankingField}>
        <label htmlFor={metricSelectId} className={styles.rankingFieldLabel}>
          Metryka
        </label>
        <select
          id={metricSelectId}
          value={metricFamily}
          onChange={(event) => {
            const family = event.target.value as PlayerComparisonMetricFamily;
            onMetricFamilyChange(family);
            if (!supportsComparisonMetricRole(family)) {
              onMetricRoleChange("sender");
            }
          }}
          className={`${styles.select} ${styles.rankingKpiSelect}`}
          aria-label="Wybierz KPI do rankingu"
        >
          {rankingKpiSelectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.rankingField}>
        <span className={styles.rankingFieldLabel} id={roleLabelId}>
          Rola
        </span>
        <div className={styles.roleToggle} role="group" aria-labelledby={roleLabelId}>
          <button
            type="button"
            className={`${styles.modeButton} ${metricRole === "sender" ? styles.modeButtonActive : ""}`}
            onClick={() => onMetricRoleChange("sender")}
            aria-pressed={metricRole === "sender"}
          >
            Podanie
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${metricRole === "receiver" ? styles.modeButtonActive : ""}`}
            onClick={() => onMetricRoleChange("receiver")}
            aria-pressed={metricRole === "receiver"}
          >
            Przyjęcie
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${metricRole === "dribble" ? styles.modeButtonActive : ""}`}
            onClick={() => onMetricRoleChange("dribble")}
            aria-pressed={metricRole === "dribble"}
          >
            Drybling
          </button>
        </div>
      </div>
      <div className={styles.rankingField}>
        <span className={styles.rankingFieldLabel} id={aggLabelId}>
          Rozliczenie
        </span>
        <div className={styles.modeToggle} role="group" aria-labelledby={aggLabelId}>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "per90" ? styles.modeButtonActive : ""}`}
            onClick={() => onModeChange("per90")}
            aria-pressed={mode === "per90"}
          >
            Per 90
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "sum" ? styles.modeButtonActive : ""}`}
            onClick={() => onModeChange("sum")}
            aria-pressed={mode === "sum"}
          >
            Suma
          </button>
        </div>
      </div>
      <div className={styles.rankingField}>
        <span className={styles.rankingFieldLabel} id={extremeLabelId}>
          Filtrowanie
        </span>
        <div className={styles.rankingExtremeWrap}>
          <button
            type="button"
            id={extremeToggleId}
            className={`${styles.modeButton} ${styles.extremeMatchToggle} ${excludeExtremeMatches ? styles.modeButtonActive : ""}`}
            aria-labelledby={extremeLabelId}
            aria-describedby={extremeTipId}
            aria-pressed={excludeExtremeMatches}
            onClick={() => onExcludeExtremeMatchesChange(!excludeExtremeMatches)}
            disabled={!comparisonLoaded}
          >
            Wyłącz mecze skrajne
          </button>
          <div id={extremeTipId} role="tooltip" className={styles.rankingExtremeTooltip}>
            <p className={styles.rankingExtremeTooltipP}>
              <strong>Przycisk wyłączony:</strong> ranking uwzględnia wszystkie załadowane mecze (nic nie odrzucamy).
            </p>
            <p className={styles.rankingExtremeTooltipP}>
              <strong>Przycisk włączony (podświetlony):</strong> z rankingu wykluczamy mecze uznane za bardzo
              jednostronne po naszej stronie. Mecz jest odrzucany, gdy nasz zespół spełnia{" "}
              <strong>co najmniej dwa z trzech</strong> warunków: przewaga{" "}
              <strong>co najmniej trzech goli</strong>, przewaga xG <strong>większa niż 2</strong>,{" "}
              <strong>co najmniej o 8 więcej</strong> wejść w pole karne niż przeciwnik (podział jak w KPI: attack vs
              defense).
            </p>
          </div>
        </div>
      </div>
      <div className={`${styles.rankingField} ${styles.rankingFieldList}`}>
        <div className={styles.rankingPositionsWrap} role="group" aria-label="Filtr pozycji">
          <PositionsMultiSelectorModal
            positionsCatalog={positionsCatalog}
            selectedPositions={selectedPositions}
            onChange={onSelectedPositionsChange}
            disabled={!comparisonLoaded}
          />
        </div>
      </div>
      <div className={styles.rankingThresholds} role="group" aria-label="Minimalne minuty i liczba meczów">
        <div className={styles.rankingThresholdField}>
          <label htmlFor={minMinutesId} className={styles.rankingFieldLabel}>
            Min. minut (≥)
          </label>
          <input
            id={minMinutesId}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={minMinutesStr}
            onChange={(event) => onMinMinutesStrChange(event.target.value)}
            className={styles.input}
            aria-label="Minimalna liczba minut, aby uwzględnić zawodnika"
            disabled={!comparisonLoaded}
          />
        </div>
        <div className={styles.rankingThresholdField}>
          <label htmlFor={minMatchesId} className={styles.rankingFieldLabel}>
            Min. meczów (≥)
          </label>
          <input
            id={minMatchesId}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={minMatchesStr}
            onChange={(event) => onMinMatchesStrChange(event.target.value)}
            className={styles.input}
            aria-label="Minimalna liczba rozegranych meczów, aby uwzględnić zawodnika"
            disabled={!comparisonLoaded}
          />
        </div>
      </div>
    </div>
  );
}
