"use client";

import React from "react";
import type { MicrocycleTrainingBlock } from "@/types/trainingMicrocycle";
import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorTagId,
} from "@/types/microcycleMotor";
import {
  MICROCYCLE_LOAD_METRICS,
  MOTOR_DOMINANTS,
  MOTOR_DOMINANT_BY_ID,
  MOTOR_TAGS,
  MOTOR_TAG_BY_ID,
} from "@/types/microcycleMotor";
import { SSG_FORMATS, presetForOffset } from "@/lib/microcycle/motorModel";
import type { ResolvedDayLoad } from "@/utils/microcycleLoad";
import { blockAreaPerPlayer } from "@/utils/microcycleTrainingBlocks";
import styles from "./TrainingMicrocycleTab.module.css";

export interface MicrocycleDayMotorPanelProps {
  load: ResolvedDayLoad;
  blocks: MicrocycleTrainingBlock[];
  /** Widok 7-dniowy — tylko podgląd, bez edytora bloków. */
  compact: boolean;
  /** Sekcja Trening zwinięta — tylko skrót (dominanta / sRPE / min / bloki). */
  collapsed?: boolean;
  disabled: boolean;
  onDominantChange: (dayIndex: number, dominant: MotorDominantId | null) => void;
  onTargetChange: (
    dayIndex: number,
    key: keyof MicrocycleDayLoadTargets,
    value: number | null
  ) => void;
  onResetDay: (dayIndex: number) => void;
  onFillFromPreset: (dayIndex: number) => void;
  onAddBlock: (dayIndex: number) => void;
  onUpdateBlock: (blockId: string, patch: Partial<MicrocycleTrainingBlock>) => void;
  onSetBlockFormat: (blockId: string, formatId: string | null) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
}

function TagChips({
  tags,
  onToggle,
  disabled,
}: {
  tags: MotorTagId[];
  onToggle?: (tag: MotorTagId) => void;
  disabled?: boolean;
}) {
  if (!onToggle) {
    if (tags.length === 0) return null;
    return (
      <span className={styles.blockTagList}>
        {tags.map((t) => (
          <span key={t} className={styles.blockTag} data-tag={t}>
            {MOTOR_TAG_BY_ID[t]?.shortLabel ?? t}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={styles.blockTagList}>
      {MOTOR_TAGS.map((tag) => {
        const active = tags.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            className={`${styles.blockTagToggle} ${active ? styles.blockTagToggleActive : ""}`}
            onClick={() => onToggle(tag.id)}
            aria-pressed={active}
            title={tag.label}
            disabled={disabled}
          >
            {tag.shortLabel}
          </button>
        );
      })}
    </span>
  );
}

export default function MicrocycleDayMotorPanel({
  load,
  blocks,
  compact,
  collapsed = false,
  disabled,
  onDominantChange,
  onTargetChange,
  onResetDay,
  onFillFromPreset,
  onAddBlock,
  onUpdateBlock,
  onSetBlockFormat,
  onDeleteBlock,
  onMoveBlock,
}: MicrocycleDayMotorPanelProps) {
  const dominant = MOTOR_DOMINANT_BY_ID[load.dominant];
  const preset = presetForOffset(load.isMatchDay ? 0 : load.offset);
  const minutes = load.plannedMinutes ?? load.targets.minutes;
  const showModelMinutes =
    load.plannedMinutes != null && Math.abs(load.plannedMinutes - load.targets.minutes) > 5;

  if (collapsed) {
    return (
      <div
        className={`${styles.motorPanel} ${styles.motorPanelCollapsed}`}
        data-dominant={load.dominant}
      >
        <div className={styles.motorHeader}>
          <span
            className={styles.motorDominantChip}
            style={{ borderColor: dominant.color, color: dominant.color }}
            title={dominant.loadFocus}
          >
            {dominant.shortLabel}
          </span>
          <span className={styles.motorSrpe} title="Planowane sRPE (RPE × minuty)">
            {load.targets.srpe} AU
          </span>
          <span className={styles.motorMinutes} title="Planowany czas">
            {minutes}′
          </span>
          <span className={styles.motorBlocksHint} title="Liczba bloków treningowych">
            {blocks.length} {blocks.length === 1 ? "blok" : "bloków"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.motorPanel} data-dominant={load.dominant}>
      <div className={styles.motorHeader}>
        <span
          className={styles.motorDominantChip}
          style={{ borderColor: dominant.color, color: dominant.color }}
          title={dominant.loadFocus}
        >
          {dominant.shortLabel}
        </span>
        <span className={styles.motorSrpe} title="Planowane sRPE (RPE × minuty)">
          {load.targets.srpe} AU
        </span>
        <span
          className={styles.motorMinutes}
          title={
            load.plannedMinutes != null
              ? `Suma bloków ${load.plannedMinutes} min, model ${load.targets.minutes} min`
              : "Czas z modelu"
          }
        >
          {minutes}′
          {showModelMinutes && (
            <span className={styles.motorMinutesModel}> / {load.targets.minutes}′</span>
          )}
        </span>
        {load.customized && (
          <button
            type="button"
            className={styles.motorResetBtn}
            onClick={() => onResetDay(load.dayIndex)}
            disabled={disabled}
            title="Przywróć wartości z modelu"
          >
            reset
          </button>
        )}
      </div>

      <div className={styles.motorMetrics} aria-label="Cele obciążenia w % meczu">
        {MICROCYCLE_LOAD_METRICS.map((metric) => {
          const value = load.targets[metric.key];
          return (
            <span key={metric.key} className={styles.motorMetric} title={`${metric.label}: ${value}% meczu`}>
              <span className={styles.motorMetricLabel}>{metric.shortLabel}</span>
              <span className={styles.motorMetricBarTrack} aria-hidden>
                <span
                  className={styles.motorMetricBarFill}
                  style={{
                    width: `${Math.min(100, (value / 130) * 100)}%`,
                    background: dominant.color,
                  }}
                />
              </span>
              <span className={styles.motorMetricValue}>{value}%</span>
            </span>
          );
        })}
      </div>

      {!compact && (
        <div className={styles.motorGoals}>
          <p className={styles.motorGoal}>
            <span className={styles.motorGoalLabel}>Motoryka</span>
            {preset.motorGoal}
          </p>
          <p className={styles.motorGoal}>
            <span className={styles.motorGoalLabel}>Taktyka</span>
            {preset.tacticalGoal}
          </p>
        </div>
      )}

      {!compact && (
        <div className={styles.motorEditRow}>
          <label className={styles.motorEditLabel}>
            <span className={styles.srOnly}>Dominanta dnia</span>
            <select
              className={styles.motorSelect}
              value={load.dominant}
              onChange={(e) => {
                const v = e.target.value;
                onDominantChange(
                  load.dayIndex,
                  v === preset.dominant ? null : (v as MotorDominantId)
                );
              }}
              disabled={disabled}
              aria-label="Dominanta wysiłkowa dnia"
            >
              {MOTOR_DOMINANTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          {(["srpe", "minutes"] as const).map((key) => (
            <label key={key} className={styles.motorEditLabel}>
              <span className={styles.motorEditCaption}>
                {key === "srpe" ? "sRPE" : "min"}
              </span>
              <input
                type="number"
                className={styles.motorNumberInput}
                value={load.targets[key]}
                min={0}
                max={key === "srpe" ? 2000 : 240}
                onChange={(e) => {
                  const raw = e.target.value;
                  onTargetChange(load.dayIndex, key, raw === "" ? null : Number(raw));
                }}
                disabled={disabled}
                aria-label={key === "srpe" ? "Planowane sRPE" : "Planowany czas w minutach"}
              />
            </label>
          ))}
        </div>
      )}

      <div className={styles.blockList}>
        {blocks.length === 0 ? (
          <p className={styles.blockEmpty}>
            {preset.blocks.length > 0 ? "Brak bloków" : "Dzień wolny"}
          </p>
        ) : (
          blocks.map((block, i) => {
            const area = blockAreaPerPlayer(block);
            const dominantRange = dominant.areaPerPlayer;
            const areaOff =
              area != null &&
              dominantRange != null &&
              (area < dominantRange.min || area > dominantRange.max);

            if (compact) {
              return (
                <div key={block.id} className={styles.blockRowCompact}>
                  <span className={styles.blockMinutes}>{block.minutes}′</span>
                  <span className={styles.blockName}>{block.name}</span>
                  {area != null && (
                    <span
                      className={`${styles.blockArea} ${areaOff ? styles.blockAreaOff : ""}`}
                      title={
                        areaOff && dominantRange
                          ? `${area} m²/gracz — dominanta wymaga ${dominantRange.min}–${dominantRange.max}`
                          : `${area} m²/gracz`
                      }
                    >
                      {area} m²
                    </span>
                  )}
                  <TagChips tags={block.tags} />
                </div>
              );
            }

            return (
              <div key={block.id} className={styles.blockRow}>
                <div className={styles.blockRowTop}>
                  <input
                    type="text"
                    className={styles.blockNameInput}
                    value={block.name}
                    onChange={(e) => onUpdateBlock(block.id, { name: e.target.value })}
                    placeholder="Nazwa bloku"
                    aria-label={`Nazwa bloku ${i + 1}`}
                    disabled={disabled}
                  />
                  <input
                    type="number"
                    className={styles.blockMinutesInput}
                    value={block.minutes}
                    min={0}
                    max={240}
                    onChange={(e) => onUpdateBlock(block.id, { minutes: Number(e.target.value) })}
                    aria-label={`Czas bloku ${i + 1} w minutach`}
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    className={styles.blockIconBtn}
                    onClick={() => onMoveBlock(block.id, -1)}
                    disabled={disabled || i === 0}
                    aria-label="Przenieś blok wyżej"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.blockIconBtn}
                    onClick={() => onMoveBlock(block.id, 1)}
                    disabled={disabled || i === blocks.length - 1}
                    aria-label="Przenieś blok niżej"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.blockIconBtn}
                    onClick={() => onDeleteBlock(block.id)}
                    disabled={disabled}
                    aria-label={`Usuń blok: ${block.name}`}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.blockRowPitch}>
                  <select
                    className={styles.blockSelect}
                    value={block.formatId ?? ""}
                    onChange={(e) => onSetBlockFormat(block.id, e.target.value || null)}
                    aria-label={`Format gry bloku ${i + 1}`}
                    disabled={disabled}
                  >
                    <option value="">Bez gry</option>
                    {SSG_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label} · {f.length}×{f.width} · {f.areaPerPlayer} m²
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={styles.blockDimInput}
                    value={block.pitchLength ?? ""}
                    min={0}
                    max={130}
                    placeholder="dł."
                    onChange={(e) =>
                      onUpdateBlock(block.id, {
                        pitchLength: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    aria-label={`Długość boiska bloku ${i + 1}`}
                    disabled={disabled}
                  />
                  <span className={styles.blockDimSep} aria-hidden>
                    ×
                  </span>
                  <input
                    type="number"
                    className={styles.blockDimInput}
                    value={block.pitchWidth ?? ""}
                    min={0}
                    max={130}
                    placeholder="szer."
                    onChange={(e) =>
                      onUpdateBlock(block.id, {
                        pitchWidth: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    aria-label={`Szerokość boiska bloku ${i + 1}`}
                    disabled={disabled}
                  />
                  <input
                    type="number"
                    className={styles.blockDimInput}
                    value={block.playersPerSide ?? ""}
                    min={0}
                    max={11}
                    placeholder="v"
                    onChange={(e) =>
                      onUpdateBlock(block.id, {
                        playersPerSide: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    aria-label={`Graczy w zespole — blok ${i + 1}`}
                    disabled={disabled}
                  />
                  {area != null && (
                    <span
                      className={`${styles.blockArea} ${areaOff ? styles.blockAreaOff : ""}`}
                      title={
                        areaOff && dominantRange
                          ? `Dominanta „${dominant.label}" wymaga ${dominantRange.min}–${dominantRange.max} m²/gracz`
                          : "Powierzchnia na gracza bez bramkarzy"
                      }
                    >
                      {area} m²/gracz
                    </span>
                  )}
                </div>

                <TagChips
                  tags={block.tags}
                  disabled={disabled}
                  onToggle={(tag) =>
                    onUpdateBlock(block.id, {
                      tags: block.tags.includes(tag)
                        ? block.tags.filter((t) => t !== tag)
                        : [...block.tags, tag],
                    })
                  }
                />
              </div>
            );
          })
        )}
      </div>

      <div className={styles.blockActions}>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => onFillFromPreset(load.dayIndex)}
          disabled={disabled || preset.blocks.length === 0}
          title="Wstaw bloki z modelu dla tego dnia"
        >
          Z presetu
        </button>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => onAddBlock(load.dayIndex)}
          disabled={disabled}
        >
          + Blok
        </button>
      </div>
    </div>
  );
}
