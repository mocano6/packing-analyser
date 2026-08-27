"use client";

import React, { useState } from "react";
import type { MicrocycleTrainingBlock } from "@/types/trainingMicrocycle";
import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorSessionRole,
  MotorTagId,
} from "@/types/microcycleMotor";
import {
  GYM_SESSION_CHARACTER_BY_ID,
  MICROCYCLE_LOAD_METRICS,
  MOTOR_DOMINANTS,
  MOTOR_DOMINANT_BY_ID,
  MOTOR_TAGS,
  MOTOR_TAG_BY_ID,
} from "@/types/microcycleMotor";
import {
  FULL_PITCH_LENGTH_M,
  FULL_PITCH_WIDTH_M,
  SSG_FORMATS,
  pitchAreaPctOfFull,
  presetForOffset,
  sessionPresetForRole,
} from "@/lib/microcycle/motorModel";
import type { ResolvedDayLoad } from "@/utils/microcycleLoad";
import { blockAreaPerPlayer } from "@/utils/microcycleTrainingBlocks";
import styles from "./TrainingMicrocycleTab.module.css";

/** Dominanta z modelu ról → podpowiedź treści jednostki (nie stary offset MD). */
const ROLE_BY_DOMINANT: Partial<Record<MotorDominantId, MotorSessionRole>> = {
  recovery: "strength",
  tension: "tension",
  duration: "volume",
  velocity: "speed",
  activation: "activation",
};

function guidelinePreset(load: ResolvedDayLoad) {
  if (load.isMatchDay) return presetForOffset(0);
  if (load.dominant === "off") return presetForOffset(-3);
  const role = ROLE_BY_DOMINANT[load.dominant];
  return role ? sessionPresetForRole(role) : presetForOffset(load.offset);
}

export interface MicrocycleDayMotorPanelProps {
  load: ResolvedDayLoad;
  blocks: MicrocycleTrainingBlock[];
  /** Widok 7-dniowy — zwinięte wiersze, edycja po kliknięciu. */
  compact: boolean;
  /** Sekcja Trening zwinięta — tylko skrót (dominanta / sRPE / min / bloki). */
  collapsed?: boolean;
  disabled: boolean;
  /** Id aktualnie przeciąganego bloku (podświetlenie). */
  draggingBlockId?: string | null;
  /** Etykiety dni 0–6 do selecta „Przenieś do…”. */
  dayLabels?: string[];
  onDominantChange: (dayIndex: number, dominant: MotorDominantId | null) => void;
  onTargetChange: (
    dayIndex: number,
    key: keyof MicrocycleDayLoadTargets,
    value: number | null
  ) => void;
  onResetDay: (dayIndex: number) => void;
  onFillFromPreset: (dayIndex: number) => void;
  onSaveDayAsPreset?: (dayIndex: number) => void;
  onAddBlock: (dayIndex: number) => string | null | void;
  onUpdateBlock: (blockId: string, patch: Partial<MicrocycleTrainingBlock>) => void;
  onSetBlockFormat: (blockId: string, formatId: string | null) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onMoveBlockToDay?: (blockId: string, targetDayIndex: number) => void;
  /** Przenieś samo obciążenie dnia (dominantę + cele) na inny dzień. */
  onMoveLoadToDay?: (fromDayIndex: number, targetDayIndex: number) => void;
  onBlockDragStart?: (e: React.DragEvent, blockId: string) => void;
  onBlockDragEnd?: () => void;
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

function BlockAreaBadge({
  area,
  length,
  width,
  areaOff,
  rangeHint,
  compact,
}: {
  area: number;
  length: number | null;
  width: number | null;
  areaOff: boolean;
  rangeHint: string | null;
  compact: boolean;
}) {
  const pct = pitchAreaPctOfFull(length, width);
  const titleParts = [`${area} m²/gracz`];
  if (length && width && pct != null) {
    titleParts.push(
      `boisko ${length}×${width} m = ${pct}% pełnego (${FULL_PITCH_LENGTH_M}×${FULL_PITCH_WIDTH_M})`
    );
  }
  if (rangeHint) titleParts.push(rangeHint);

  return (
    <span
      className={`${styles.blockArea} ${areaOff ? styles.blockAreaOff : ""}`}
      title={titleParts.join(" — ")}
    >
      {compact ? `${area} m²` : `${area} m²/gracz`}
      {pct != null && (
        <span className={styles.blockAreaPct}>{compact ? ` · ${pct}%` : ` · ${pct}% pełnego`}</span>
      )}
    </span>
  );
}

export default function MicrocycleDayMotorPanel({
  load,
  blocks,
  compact,
  collapsed = false,
  disabled,
  draggingBlockId = null,
  dayLabels,
  onDominantChange,
  onTargetChange,
  onResetDay,
  onFillFromPreset,
  onSaveDayAsPreset,
  onAddBlock,
  onUpdateBlock,
  onSetBlockFormat,
  onDeleteBlock,
  onMoveBlock,
  onMoveBlockToDay,
  onMoveLoadToDay,
  onBlockDragStart,
  onBlockDragEnd,
}: MicrocycleDayMotorPanelProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const closeBlockEditor = () => setEditingBlockId(null);
  const dominant = MOTOR_DOMINANT_BY_ID[load.dominant];
  const preset = guidelinePreset(load);
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
          {onMoveLoadToDay && dayLabels && !disabled && (
            <label className={styles.loadMoveLabel}>
              <span className={styles.srOnly}>Przenieś obciążenie dnia na inny dzień</span>
              <select
                className={styles.loadMoveSelect}
                value=""
                aria-label="Przenieś obciążenie na inny dzień"
                title="Przenieś obciążenie (dominantę i cele) na inny dzień"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  onMoveLoadToDay(load.dayIndex, Number(raw));
                  e.target.value = "";
                }}
              >
                <option value="">→</option>
                {dayLabels.map((label, di) =>
                  di === load.dayIndex ? null : (
                    <option key={di} value={di}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          )}
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
        {preset.gymCharacter !== "none" && (
          <span
            className={styles.sessionGymChip}
            style={{ color: "#c2410c", borderColor: "#fdba74" }}
            title={GYM_SESSION_CHARACTER_BY_ID[preset.gymCharacter].label}
          >
            {GYM_SESSION_CHARACTER_BY_ID[preset.gymCharacter].shortLabel}{" "}
            {GYM_SESSION_CHARACTER_BY_ID[preset.gymCharacter].typicalMinutes}′
          </span>
        )}
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
        {onMoveLoadToDay && dayLabels && (
          <label className={styles.loadMoveLabel}>
            <span className={styles.srOnly}>Przenieś obciążenie dnia na inny dzień</span>
            <select
              className={styles.loadMoveSelect}
              value=""
              disabled={disabled}
              aria-label="Przenieś obciążenie na inny dzień"
              title="Przenieś obciążenie (dominantę i cele) na inny dzień"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                onMoveLoadToDay(load.dayIndex, Number(raw));
                e.target.value = "";
              }}
            >
              <option value="">→ obciąż.</option>
              {dayLabels.map((label, di) =>
                di === load.dayIndex ? null : (
                  <option key={di} value={di}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
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

            if (compact && editingBlockId !== block.id) {
              return (
                <div
                  key={block.id}
                  className={`${styles.blockRowCompact} ${
                    draggingBlockId === block.id ? styles.blockRowDragging : ""
                  }`}
                  onClick={(e) => {
                    if (disabled) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest("[data-drag-handle]")) return;
                    setEditingBlockId(block.id);
                  }}
                  title="Kliknij, aby edytować. Przeciągnij za ⠿."
                >
                  <span
                    className={styles.blockDragHandle}
                    data-drag-handle
                    draggable={!disabled && !!onBlockDragStart}
                    onDragStart={
                      onBlockDragStart
                        ? (e) => {
                            e.stopPropagation();
                            onBlockDragStart(e, block.id);
                          }
                        : undefined
                    }
                    onDragEnd={onBlockDragEnd}
                    aria-hidden
                  >
                    ⠿
                  </span>
                  <span className={styles.blockMinutes}>{block.minutes}′</span>
                  <span className={styles.blockName}>{block.name}</span>
                  {area != null && (
                    <BlockAreaBadge
                      area={area}
                      length={block.pitchLength}
                      width={block.pitchWidth}
                      areaOff={areaOff}
                      rangeHint={
                        areaOff && dominantRange
                          ? `dominanta wymaga ${dominantRange.min}–${dominantRange.max} m²/gracz`
                          : null
                      }
                      compact
                    />
                  )}
                  <TagChips tags={block.tags} />
                  <span className={styles.blockRowCompactTools}>
                    <button
                      type="button"
                      className={styles.blockIconBtn}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBlockId(block.id);
                      }}
                      disabled={disabled}
                      aria-label={`Edytuj blok: ${block.name}`}
                      title="Edytuj blok"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`${styles.blockIconBtn} ${styles.blockRowCompactDelete}`}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(block.id);
                      }}
                      disabled={disabled}
                      aria-label={`Usuń blok: ${block.name}`}
                      title="Usuń blok"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              );
            }

            return (
              <div
                key={block.id}
                className={`${styles.blockRow} ${compact ? styles.blockRowCompactEdit : ""} ${
                  draggingBlockId === block.id ? styles.blockRowDragging : ""
                }`}
                onKeyDown={
                  compact
                    ? (e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Escape") {
                          e.preventDefault();
                          closeBlockEditor();
                          return;
                        }
                        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                          e.preventDefault();
                          closeBlockEditor();
                        }
                      }
                    : undefined
                }
              >
                <div className={styles.blockRowTop}>
                  <span
                    className={styles.blockDragHandle}
                    draggable={!disabled && !!onBlockDragStart}
                    onDragStart={
                      onBlockDragStart
                        ? (e) => {
                            e.stopPropagation();
                            onBlockDragStart(e, block.id);
                          }
                        : undefined
                    }
                    onDragEnd={onBlockDragEnd}
                    title="Przeciągnij do innego dnia"
                    aria-label={`Przeciągnij blok: ${block.name}`}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                  >
                    ⠿
                  </span>
                  <input
                    type="text"
                    className={styles.blockNameInput}
                    value={block.name}
                    onChange={(e) => onUpdateBlock(block.id, { name: e.target.value })}
                    placeholder="Nazwa bloku"
                    aria-label={`Nazwa bloku ${i + 1}`}
                    disabled={disabled}
                    autoFocus={compact}
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
                  {onMoveBlockToDay && dayLabels && (
                    <label className={styles.blockMoveDayLabel}>
                      <span className={styles.srOnly}>Przenieś blok do dnia</span>
                      <select
                        className={styles.blockMoveDaySelect}
                        value=""
                        disabled={disabled}
                        aria-label={`Przenieś blok „${block.name}” do innego dnia`}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return;
                          onMoveBlockToDay(block.id, Number(raw));
                          e.target.value = "";
                        }}
                      >
                        <option value="">→ dzień</option>
                        {dayLabels.map((label, di) =>
                          di === load.dayIndex ? null : (
                            <option key={di} value={di}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className={styles.blockIconBtn}
                    onClick={() => {
                      if (editingBlockId === block.id) setEditingBlockId(null);
                      onDeleteBlock(block.id);
                    }}
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
                    <BlockAreaBadge
                      area={area}
                      length={block.pitchLength}
                      width={block.pitchWidth}
                      areaOff={areaOff}
                      rangeHint={
                        areaOff && dominantRange
                          ? `Dominanta „${dominant.label}" wymaga ${dominantRange.min}–${dominantRange.max} m²/gracz`
                          : "Powierzchnia na gracza bez bramkarzy"
                      }
                      compact={false}
                    />
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
                {compact && (
                  <button
                    type="button"
                    className={styles.blockConfirmBtn}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      closeBlockEditor();
                    }}
                    onClick={closeBlockEditor}
                  >
                    Zatwierdź
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.blockActions}>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => {
            setEditingBlockId(null);
            onFillFromPreset(load.dayIndex);
          }}
          disabled={disabled || preset.blocks.length === 0}
          title="Wstaw bloki z modelu dla tego dnia"
        >
          Z presetu
        </button>
        {onSaveDayAsPreset && (
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => onSaveDayAsPreset(load.dayIndex)}
            disabled={disabled || blocks.length === 0}
            title="Zapisz aktualne bloki dnia jako preset MD"
          >
            Zapisz jako preset
          </button>
        )}
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => {
            const id = onAddBlock(load.dayIndex);
            if (typeof id === "string" && id) setEditingBlockId(id);
          }}
          disabled={disabled}
        >
          + Blok
        </button>
      </div>
    </div>
  );
}
