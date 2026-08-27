"use client";

import type { PlayerComparisonRow } from "@/utils/playerComparisonMetrics";
import {
  PLAYER_COMPARISON_SELECT_MAX,
  PLAYER_COMPARISON_SERIES_COLORS,
  comparisonPositionGroupLabel,
  comparisonRosterChipName,
  groupComparisonPlayersByPosition,
} from "@/utils/playerComparisonSelection";
import styles from "./PlayerComparisonRosterPicker.module.css";

interface PlayerComparisonRosterPickerProps {
  rows: PlayerComparisonRow[];
  selectedIds: string[];
  onToggle: (playerId: string) => void;
  maskName: (name: string) => string;
  max?: number;
  colors?: readonly string[];
  embedded?: boolean;
}

export default function PlayerComparisonRosterPicker({
  rows,
  selectedIds,
  onToggle,
  maskName,
  max = PLAYER_COMPARISON_SELECT_MAX,
  colors = PLAYER_COMPARISON_SERIES_COLORS,
  embedded = false,
}: PlayerComparisonRosterPickerProps) {
  const groups = groupComparisonPlayersByPosition(rows);
  const atMax = selectedIds.length >= max;
  const selectedRows = selectedIds
    .map((id) => rows.find((row) => row.playerId === id))
    .filter((row): row is PlayerComparisonRow => Boolean(row));

  return (
    <div className={`${styles.picker} ${embedded ? styles.pickerEmbedded : ""}`}>
      <div className={styles.pickerHeader}>
        <div className={styles.pickerHeading}>
          <h3 className={styles.pickerTitle} id="comparison-roster-title">
            Skład do porównania
          </h3>
          <p className={styles.pickerHint} id="comparison-roster-hint">
            Kliknij zawodnika, żeby dodać go lub zdjąć z tabeli i spidera.
          </p>
        </div>
        <p className={styles.pickerCount} aria-live="polite">
          <strong>{selectedIds.length}</strong>
          <span>/{max}</span>
        </p>
      </div>

      {selectedRows.length > 0 ? (
        <ul className={styles.selectedStrip} aria-label="Zaznaczeni zawodnicy">
          {selectedRows.map((row, index) => {
            const color = colors[index % colors.length];
            const name = maskName(comparisonRosterChipName(row));
            return (
              <li key={row.playerId}>
                <button
                  type="button"
                  className={styles.selectedChip}
                  onClick={() => onToggle(row.playerId)}
                  aria-label={`Usuń ${name} z porównania`}
                  title="Kliknij, aby zdjąć z porównania"
                >
                  <span className={styles.selectedDot} style={{ backgroundColor: color }} aria-hidden />
                  <span className={styles.selectedName}>{name}</span>
                  {row.number ? <span className={styles.selectedNumber}>{row.number}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.selectedEmpty}>Nikt nie jest zaznaczony — wybierz 2–{max} zawodników poniżej.</p>
      )}

      <div
        className={styles.groups}
        role="group"
        aria-labelledby="comparison-roster-title"
        aria-describedby="comparison-roster-hint"
      >
        {groups.map(({ group, rows: groupRows }) => (
          <section key={group} className={styles.group}>
            <h4 className={styles.groupTitle}>{comparisonPositionGroupLabel(group)}</h4>
            <div className={styles.cards}>
              {groupRows.map((row) => {
                const selectedIndex = selectedIds.indexOf(row.playerId);
                const selected = selectedIndex >= 0;
                const color = selected ? colors[selectedIndex % colors.length] : undefined;
                const name = maskName(comparisonRosterChipName(row));
                return (
                  <button
                    key={row.playerId}
                    type="button"
                    className={`${styles.card} ${selected ? styles.cardSelected : ""} ${
                      atMax && !selected ? styles.cardDisabled : ""
                    }`}
                    onClick={() => onToggle(row.playerId)}
                    aria-pressed={selected}
                    aria-label={`${maskName(row.playerName)}, ${row.position || "brak pozycji"}`}
                    style={color ? { borderColor: color, backgroundColor: `${color}14` } : undefined}
                  >
                    {selected ? (
                      <span className={styles.cardColor} style={{ backgroundColor: color }} aria-hidden />
                    ) : null}
                    <span className={styles.cardNumber}>{row.number || "—"}</span>
                    <span className={styles.cardName}>{name}</span>
                    <span className={styles.cardMeta}>{row.position || "—"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
