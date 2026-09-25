"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MicrocycleTrainingBlock } from "@/types/trainingMicrocycle";
import {
  compressBlockImage,
  imageBlobFromClipboardData,
  readBlobAsDataUrl,
  readClipboardImageBlob,
} from "@/utils/microcycleBlockImage";
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

function useTrainingBlockImagePaste(
  disabled: boolean,
  editingBlockId: string | null,
  onUpdateBlock: (blockId: string, patch: Partial<MicrocycleTrainingBlock>) => void
) {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [error, setError] = useState<{ blockId: string; message: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const hoveredRef = useRef<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const disabledRef = useRef(disabled);
  const busyRef = useRef<string | null>(null);
  hoveredRef.current = hoveredBlockId;
  editingRef.current = editingBlockId;
  disabledRef.current = disabled;
  busyRef.current = busyBlockId;

  const attachBlob = useCallback(
    async (blockId: string, blob: Blob) => {
      setBusyBlockId(blockId);
      setError(null);
      try {
        const dataUrl = await readBlobAsDataUrl(blob);
        const compressed = await compressBlockImage(dataUrl);
        onUpdateBlock(blockId, { imageUrl: compressed });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Nie udało się wkleić grafiki";
        setError({ blockId, message });
      } finally {
        setBusyBlockId(null);
      }
    },
    [onUpdateBlock]
  );
  const attachRef = useRef(attachBlob);
  attachRef.current = attachBlob;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabledRef.current) return;
      const targetId = hoveredRef.current ?? editingRef.current;
      if (!targetId || busyRef.current) return;
      const blob = imageBlobFromClipboardData(e.clipboardData);
      if (!blob) return;
      e.preventDefault();
      void attachRef.current(targetId, blob);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const pasteFromClipboardApi = useCallback(
    async (blockId: string) => {
      setError(null);
      try {
        const blob = await readClipboardImageBlob();
        if (!blob) {
          setError({
            blockId,
            message: "W schowku nie ma obrazka. Skopiuj grafikę i wklej (Ctrl+V).",
          });
          return;
        }
        await attachBlob(blockId, blob);
      } catch {
        setError({
          blockId,
          message: "Nie udało się odczytać schowka. Najedź kafelek i wklej Ctrl+V / Cmd+V.",
        });
      }
    },
    [attachBlob]
  );

  return {
    setHoveredBlockId,
    busyBlockId,
    error,
    lightbox,
    setLightbox,
    pasteFromClipboardApi,
    removeImage: (blockId: string) => {
      onUpdateBlock(blockId, { imageUrl: "" });
      setError(null);
    },
  };
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
  onBlockDragStart,
  onBlockDragEnd,
}: MicrocycleDayMotorPanelProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const closeBlockEditor = () => setEditingBlockId(null);
  const {
    setHoveredBlockId,
    busyBlockId,
    error: imageError,
    lightbox,
    setLightbox,
    pasteFromClipboardApi,
    removeImage,
  } = useTrainingBlockImagePaste(disabled, editingBlockId, onUpdateBlock);
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
                  } ${block.imageUrl ? styles.blockRowCompactHasImage : ""} ${
                    busyBlockId === block.id ? styles.blockRowCompactPasting : ""
                  }`}
                  tabIndex={disabled ? -1 : 0}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() =>
                    setHoveredBlockId((current) => (current === block.id ? null : current))
                  }
                  onClick={(e) => {
                    if (disabled) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest("[data-drag-handle]")) return;
                    setEditingBlockId(block.id);
                  }}
                  title="Kliknij, aby edytować. Przeciągnij za ⠿. Wklej grafikę: Ctrl+V / Cmd+V."
                  role="group"
                  aria-label={`Blok: ${block.name}. Wklej grafikę: Ctrl+V.`}
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
                        void pasteFromClipboardApi(block.id);
                      }}
                      disabled={disabled || busyBlockId === block.id}
                      aria-label={`Wklej grafikę do bloku: ${block.name}`}
                      title="Wklej grafikę ze schowka (Ctrl+V)"
                    >
                      {busyBlockId === block.id ? "…" : "🖼"}
                    </button>
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
                  {block.imageUrl ? (
                    <button
                      type="button"
                      className={styles.blockThumbBtn}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox({ url: block.imageUrl as string, name: block.name });
                      }}
                      aria-label={`Podgląd grafiki: ${block.name}`}
                      title="Podgląd grafiki"
                    >
                      <img src={block.imageUrl} alt="" className={styles.blockThumbImg} />
                    </button>
                  ) : null}
                  {imageError?.blockId === block.id && (
                    <p className={styles.blockImageError} role="alert">
                      {imageError.message}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={block.id}
                className={`${styles.blockRow} ${compact ? styles.blockRowCompactEdit : ""} ${
                  draggingBlockId === block.id ? styles.blockRowDragging : ""
                }`}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() =>
                  setHoveredBlockId((current) => (current === block.id ? null : current))
                }
                onKeyDown={
                  compact
                    ? (e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Escape") {
                          e.preventDefault();
                          if (lightbox) {
                            setLightbox(null);
                            return;
                          }
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
                        <option value="">Do dnia…</option>
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
                <div className={styles.blockImageEdit}>
                  {block.imageUrl ? (
                    <>
                      <button
                        type="button"
                        className={styles.blockThumbBtn}
                        onClick={() =>
                          setLightbox({ url: block.imageUrl as string, name: block.name })
                        }
                        aria-label={`Podgląd grafiki: ${block.name}`}
                        title="Podgląd grafiki"
                      >
                        <img src={block.imageUrl} alt="" className={styles.blockThumbImg} />
                      </button>
                      <div className={styles.blockImageEditActions}>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => void pasteFromClipboardApi(block.id)}
                          disabled={disabled || busyBlockId === block.id}
                        >
                          {busyBlockId === block.id ? "Wklejanie…" : "Wklej inną"}
                        </button>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => removeImage(block.id)}
                          disabled={disabled}
                        >
                          Usuń grafikę
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.blockImagePasteZone}
                      onClick={() => void pasteFromClipboardApi(block.id)}
                      disabled={disabled || busyBlockId === block.id}
                      title="Skopiuj grafikę i kliknij albo wklej Ctrl+V / Cmd+V"
                    >
                      {busyBlockId === block.id
                        ? "Wklejanie grafiki…"
                        : "Wklej grafikę ze schowka (Ctrl+V)"}
                    </button>
                  )}
                  {imageError?.blockId === block.id && (
                    <p className={styles.blockImageError} role="alert">
                      {imageError.message}
                    </p>
                  )}
                </div>
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
      {lightbox &&
        createPortal(
          <div
            className={styles.blockImageLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={`Grafika: ${lightbox.name}`}
            onClick={() => setLightbox(null)}
          >
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className={styles.blockImageLightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className={styles.blockImageLightboxClose}
              onClick={() => setLightbox(null)}
              aria-label="Zamknij podgląd grafiki"
            >
              Zamknij
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
