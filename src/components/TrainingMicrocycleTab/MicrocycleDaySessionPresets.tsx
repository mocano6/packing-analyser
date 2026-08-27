"use client";

import React, { useCallback, useMemo, useState } from "react";
import type {
  TrainingDaySessionBlockDraft,
  TrainingDaySessionTemplate,
  TrainingDaySessionTemplatesState,
} from "@/types/trainingMicrocycle";
import {
  GYM_SESSION_CHARACTERS,
  GYM_SESSION_CHARACTER_BY_ID,
  MOTOR_DOMINANTS,
  MOTOR_SESSION_ROLES,
  MOTOR_SESSION_ROLE_BY_ID,
  MOTOR_TAGS,
  isGymSessionCharacter,
  isMotorDominantId,
  isMotorSessionRole,
  type GymSessionCharacter,
  type MotorDominantId,
  type MotorTagId,
} from "@/types/microcycleMotor";
import { MOTOR_DAY_PRESETS, SSG_FORMATS } from "@/lib/microcycle/motorModel";
import { formatMatchDayLabel } from "@/utils/matchDayLabels";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";
import {
  DAY_SESSION_ASSIGNABLE_OFFSETS,
  emptySessionBlockDraft,
  minutesFromDrafts,
  optionalTemplateFromMotorPreset,
  restoreSeedDaySessionTemplates,
} from "@/utils/daySessionTemplates";
import styles from "./TrainingMicrocycleTab.module.css";

const GYM_CHIP_COLOR: Record<GymSessionCharacter, string> = {
  heavy: "#ea580c",
  power: "#2563eb",
  minimal: "#0d9488",
  priming: "#7c3aed",
  none: "#94a3b8",
};

/** Ile bloków pokazujemy na zwiniętej karcie — resztę zbiera licznik. */
const VISIBLE_BLOCK_PILLS = 3;

/** Presety modelu MD do dołożenia ręcznie (np. dzień siłowni po meczu). */
const OPTIONAL_MODEL_PRESETS = MOTOR_DAY_PRESETS.filter(
  (p) => p.offset !== 0 && p.blocks.length > 0
);

type SessionBlockKind = "gym" | "transfer" | "pitch" | "other";

function blockKind(block: TrainingDaySessionBlockDraft): SessionBlockKind {
  if (block.tags.includes("transfer")) return "transfer";
  if (
    block.tags.includes("gym") ||
    block.tags.includes("strength_max") ||
    block.tags.includes("power") ||
    block.tags.includes("priming")
  ) {
    return "gym";
  }
  if (block.tags.includes("video")) return "other";
  return "pitch";
}

function minutesByKind(blocks: TrainingDaySessionBlockDraft[]): Record<SessionBlockKind, number> {
  const acc: Record<SessionBlockKind, number> = { gym: 0, transfer: 0, pitch: 0, other: 0 };
  for (const b of blocks) acc[blockKind(b)] += b.minutes;
  return acc;
}

function presetDisplayName(name: string, offset: number | null): string {
  if (offset == null) return name;
  const prefix = `${formatMatchDayLabel(offset)} — `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

export interface MicrocycleDaySessionPresetsProps {
  templatesState: TrainingDaySessionTemplatesState;
  setTemplatesState: React.Dispatch<React.SetStateAction<TrainingDaySessionTemplatesState>>;
  dayLabels: string[];
  disabled: boolean;
  draggingId: string | null;
  onDragStart: (e: React.DragEvent, templateId: string) => void;
  onDragEnd: () => void;
  onApplyToDay: (templateId: string, dayIndex: number) => void;
}

export default function MicrocycleDaySessionPresets({
  templatesState,
  setTemplatesState,
  dayLabels,
  disabled,
  draggingId,
  onDragStart,
  onDragEnd,
  onApplyToDay,
}: MicrocycleDaySessionPresetsProps) {
  const templates = templatesState.templates;
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("microcycle_daySessions_open") !== "0";
    } catch {
      return true;
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("microcycle_daySessions_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) => {
        const ar = a.role ? MOTOR_SESSION_ROLE_BY_ID[a.role].order : 90;
        const br = b.role ? MOTOR_SESSION_ROLE_BY_ID[b.role].order : 90;
        const ao = a.matchDayOffset ?? 99;
        const bo = b.matchDayOffset ?? 99;
        return ar - br || ao - bo || a.name.localeCompare(b.name);
      }),
    [templates]
  );

  const roleCount = templates.filter((t) => t.role != null).length;

  /** Minuty jednostki liczymy z bloków — inaczej karta pokazywałaby dwie różne sumy. */
  const syncMinutes = useCallback((tpl: TrainingDaySessionTemplate) => {
    const minutes = minutesFromDrafts(tpl.blocks);
    if (tpl.targets.minutes === minutes) return tpl;
    return { ...tpl, targets: { ...tpl.targets, minutes } };
  }, []);

  const patchTemplate = useCallback(
    (id: string, patch: Partial<TrainingDaySessionTemplate>) => {
      setTemplatesState((prev) => ({
        templates: prev.templates.map((t) => (t.id === id ? syncMinutes({ ...t, ...patch }) : t)),
      }));
    },
    [setTemplatesState, syncMinutes]
  );

  const patchBlock = useCallback(
    (templateId: string, index: number, patch: Partial<TrainingDaySessionBlockDraft>) => {
      setTemplatesState((prev) => ({
        templates: prev.templates.map((t) => {
          if (t.id !== templateId) return t;
          return syncMinutes({
            ...t,
            blocks: t.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
          });
        }),
      }));
    },
    [setTemplatesState, syncMinutes]
  );

  const addTemplate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    const tpl: TrainingDaySessionTemplate = {
      id: generateMicrocycleId(),
      name,
      role: null,
      matchDayOffset: null,
      gymCharacter: "none",
      dominant: "activation",
      motorGoal: "",
      tacticalGoal: "",
      targets: {
        totalDistancePct: 50,
        hsrPct: 40,
        sprintPct: 30,
        accDecPct: 50,
        srpe: 400,
        minutes: 82,
      },
      blocks: [
        { name: "Siłownia", minutes: 20, tags: ["gym"], notes: "" },
        { name: "Transfer", minutes: 12, tags: ["transfer", "mobility"], notes: "" },
        { name: "Boisko", minutes: 50, tags: ["ssg"], notes: "" },
      ],
      notes: "",
    };
    setTemplatesState((prev) => ({ templates: [...prev.templates, tpl] }));
    setNewName("");
    setEditingId(tpl.id);
  }, [newName, setTemplatesState]);

  const addFromModel = useCallback(
    (offset: number) => {
      const preset = OPTIONAL_MODEL_PRESETS.find((p) => p.offset === offset);
      if (!preset) return;
      const tpl = optionalTemplateFromMotorPreset(preset);
      setTemplatesState((prev) => ({ templates: [...prev.templates, tpl] }));
    },
    [setTemplatesState]
  );

  return (
    <section
      className={`${styles.dayTitlesSection} ${open ? "" : styles.dayTitlesSectionCollapsed}`}
      aria-label="Presety dni MD"
    >
      <button
        type="button"
        className={styles.dayTitlesToggle}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="day-session-presets-panel"
        id="day-session-presets-toggle"
      >
        <span className={styles.dayTitlesToggleLeft}>
          <span className={styles.dayTitlesChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className={styles.dayTitlesToggleTitle}>Presety jednostek treningowych</span>
          <span className={styles.dayTitlesCountBadge}>
            {templates.length}
            {roleCount > 0 ? ` · ${roleCount} z rolą` : ""}
          </span>
        </span>
        <span className={styles.dayTitlesToggleHint}>{open ? "Zwiń" : "Rozwiń"}</span>
      </button>

      {!open && sorted.length > 0 && (
        <div className={styles.dayTitlesCollapsedPreview} aria-hidden>
          {sorted.slice(0, 8).map((tpl) => (
            <span
              key={tpl.id}
              className={`${styles.dayTitlesPreviewChip} ${
                tpl.role != null ? styles.dayTitlesPreviewChipAssigned : ""
              }`}
            >
              {tpl.role != null && (
                <span className={styles.dayTitlesPreviewMd}>
                  {MOTOR_SESSION_ROLE_BY_ID[tpl.role].shortLabel}
                </span>
              )}
              <span className={styles.dayTitlesPreviewFocus}>{tpl.name}</span>
            </span>
          ))}
          {sorted.length > 8 && (
            <span className={styles.dayTitlesPreviewMore}>+{sorted.length - 8}</span>
          )}
        </div>
      )}

      <div
        id="day-session-presets-panel"
        className={styles.dayTitlesPanel}
        hidden={!open}
        role="region"
        aria-labelledby="day-session-presets-toggle"
      >
        <p className={styles.dayTitlesHint}>
          Cztery jednostki tygodnia opisane rolą: siła → napięcie → objętość → prędkość. „Rozpisz
          tydzień z presetów” układa je od dnia najdalszego od meczu do najbliższego, pomijając dni
          meczowe i wolne — dlatego ten sam zestaw działa przy meczu w sobotę i w niedzielę. MD ustaw
          tylko wtedy, gdy chcesz przypiąć preset do konkretnego dnia.
        </p>
        <div className={styles.sessionCardList}>
          {sorted.length === 0 && (
            <p className={styles.emptyLibrary}>Brak presetów — dodaj pierwszy albo przywróć zestaw startowy.</p>
          )}
          {sorted.map((tpl) => {
            const gym = GYM_SESSION_CHARACTER_BY_ID[tpl.gymCharacter];
            const gymColor = GYM_CHIP_COLOR[tpl.gymCharacter];
            const split = minutesByKind(tpl.blocks);
            const totalMin = split.gym + split.transfer + split.pitch + split.other;
            const editing = editingId === tpl.id;
            const title = presetDisplayName(tpl.name, tpl.matchDayOffset);
            const role = tpl.role ? MOTOR_SESSION_ROLE_BY_ID[tpl.role] : null;
            const hiddenPills = Math.max(0, tpl.blocks.length - VISIBLE_BLOCK_PILLS);
            return (
              <div
                key={tpl.id}
                className={`${styles.sessionCard} ${
                  role != null ? styles.sessionCardAssigned : ""
                } ${draggingId === tpl.id ? styles.sessionCardDragging : ""} ${
                  editing ? styles.sessionCardEditing : ""
                }`}
                draggable={!disabled && !editing}
                onDragStart={(e) => onDragStart(e, tpl.id)}
                onDragEnd={onDragEnd}
              >
                <div className={styles.sessionCardHead}>
                  <span className={styles.sessionCardDrag} aria-hidden title="Przeciągnij na dzień">
                    ⋮⋮
                  </span>
                  {role != null && (
                    <span
                      className={styles.sessionRoleBadge}
                      style={{ color: role.color, borderColor: role.color }}
                      title={role.label}
                    >
                      {role.shortLabel}
                    </span>
                  )}
                  {tpl.matchDayOffset != null && (
                    <span className={styles.sessionMdBadge}>
                      {formatMatchDayLabel(tpl.matchDayOffset)}
                    </span>
                  )}
                  <h3 className={styles.sessionCardTitle}>{title}</h3>
                  <button
                    type="button"
                    className={styles.dayTitleRemove}
                    onClick={() =>
                      setTemplatesState((prev) => ({
                        templates: prev.templates.filter((t) => t.id !== tpl.id),
                      }))
                    }
                    aria-label={`Usuń preset: ${tpl.name}`}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.sessionCardMeta}>
                  <span
                    className={styles.sessionGymChip}
                    style={{ color: gymColor }}
                    title={gym.label}
                  >
                    {gym.shortLabel}
                  </span>
                  <span className={styles.sessionToolbarLabel}>
                    {tpl.blocks.length} {tpl.blocks.length === 1 ? "blok" : "bloków"}
                    {totalMin > 0 ? ` · ${totalMin}′` : ""}
                  </span>
                </div>

                {totalMin > 0 && (
                  <div
                    className={styles.sessionSplit}
                    role="img"
                    aria-label={`Czas: ${split.gym} min siłownia, ${split.transfer} min transfer, ${split.pitch} min boisko`}
                  >
                    {split.gym > 0 && (
                      <span
                        className={`${styles.sessionSplitSeg} ${styles.sessionSplitGym}`}
                        style={{ flexGrow: split.gym, flexBasis: 0 }}
                        title={`Siłownia ${split.gym} min`}
                      >
                        {split.gym}′ sił.
                      </span>
                    )}
                    {split.transfer > 0 && (
                      <span
                        className={`${styles.sessionSplitSeg} ${styles.sessionSplitTransfer}`}
                        style={{ flexGrow: split.transfer, flexBasis: 0 }}
                        title={`Transfer ${split.transfer} min`}
                      >
                        {split.transfer}′ trans.
                      </span>
                    )}
                    {split.pitch > 0 && (
                      <span
                        className={`${styles.sessionSplitSeg} ${styles.sessionSplitPitch}`}
                        style={{ flexGrow: split.pitch, flexBasis: 0 }}
                        title={`Boisko ${split.pitch} min`}
                      >
                        {split.pitch}′ boisko
                      </span>
                    )}
                    {split.other > 0 && (
                      <span
                        className={`${styles.sessionSplitSeg} ${styles.sessionSplitOther}`}
                        style={{ flexGrow: split.other, flexBasis: 0 }}
                        title={`Inne ${split.other} min`}
                      >
                        {split.other}′
                      </span>
                    )}
                  </div>
                )}

                {tpl.blocks.length > 0 && !editing && (
                  <div className={styles.sessionBlockPills} aria-label="Kolejność bloków">
                    {tpl.blocks.slice(0, VISIBLE_BLOCK_PILLS).map((block, i) => (
                      <span
                        key={`${tpl.id}-pill-${i}`}
                        className={styles.sessionBlockPill}
                        data-kind={blockKind(block)}
                        title={block.name}
                      >
                        <span className={styles.sessionBlockPillName}>{block.name}</span>
                        <span className={styles.sessionBlockPillMin}>{block.minutes}′</span>
                      </span>
                    ))}
                    {hiddenPills > 0 && (
                      <span
                        className={styles.sessionBlockPillMore}
                        title={tpl.blocks
                          .slice(VISIBLE_BLOCK_PILLS)
                          .map((b) => `${b.name} — ${b.minutes}′`)
                          .join("\n")}
                      >
                        +{hiddenPills}
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.sessionToolbar}>
                  <label className={styles.sessionToolbarLabel}>
                    Rola
                    <select
                      className={`${styles.dayTitleMdSelect} ${
                        tpl.role != null ? styles.dayTitleMdSelectAssigned : ""
                      }`}
                      value={tpl.role ?? ""}
                      aria-label={`Rola jednostki dla: ${tpl.name}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          patchTemplate(tpl.id, { role: null });
                          return;
                        }
                        if (!isMotorSessionRole(v)) return;
                        patchTemplate(tpl.id, {
                          role: v,
                          dominant: MOTOR_SESSION_ROLE_BY_ID[v].dominant,
                        });
                      }}
                      disabled={disabled}
                    >
                      <option value="">Bez roli</option>
                      {MOTOR_SESSION_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.shortLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.sessionToolbarLabel}>
                    Wstaw
                    <select
                      className={styles.dayTitleMdSelect}
                      value=""
                      aria-label={`Wstaw preset ${tpl.name} na dzień`}
                      title="Wstaw ten dzień do mikrocyklu"
                      disabled={disabled}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        onApplyToDay(tpl.id, Number(raw));
                        e.target.value = "";
                      }}
                    >
                      <option value="">dzień…</option>
                      {dayLabels.map((label, di) => (
                        <option key={di} value={di}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => setEditingId(editing ? null : tpl.id)}
                    aria-expanded={editing}
                  >
                    {editing ? "Gotowe" : "Edytuj"}
                  </button>
                </div>
                {editing && (
                    <div className={styles.sessionEditor}>
                      <input
                        type="text"
                        className={styles.input}
                        value={tpl.name}
                        onChange={(e) => patchTemplate(tpl.id, { name: e.target.value })}
                        aria-label="Nazwa presetu"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <div className={styles.sessionEditorRow}>
                        <label className={styles.sessionToolbarLabel}>
                          Przypnij do MD
                          <select
                            className={`${styles.dayTitleMdSelect} ${
                              tpl.matchDayOffset != null ? styles.dayTitleMdSelectAssigned : ""
                            }`}
                            value={tpl.matchDayOffset == null ? "" : String(tpl.matchDayOffset)}
                            aria-label="Przypnij preset do konkretnego dnia MD"
                            title="Ma priorytet nad rolą — użyj tylko dla wyjątków"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              patchTemplate(tpl.id, {
                                matchDayOffset:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          >
                            <option value="">Bez przypięcia</option>
                            {DAY_SESSION_ASSIGNABLE_OFFSETS.map((o) => (
                              <option key={o} value={o}>
                                {formatMatchDayLabel(o)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.sessionToolbarLabel}>
                          Siłownia
                          <select
                            className={styles.dayTitleMdSelect}
                            value={tpl.gymCharacter}
                            aria-label="Charakter siłowni"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isGymSessionCharacter(v)) {
                                patchTemplate(tpl.id, { gymCharacter: v });
                              }
                            }}
                          >
                            {GYM_SESSION_CHARACTERS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.shortLabel}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.sessionToolbarLabel}>
                          Dominanta
                          <select
                            className={styles.dayTitleMdSelect}
                            value={tpl.dominant}
                            aria-label="Dominanta motoryczna"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isMotorDominantId(v)) {
                                patchTemplate(tpl.id, { dominant: v as MotorDominantId });
                              }
                            }}
                          >
                            {MOTOR_DOMINANTS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.shortLabel}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <textarea
                        className={styles.input}
                        rows={2}
                        value={tpl.motorGoal}
                        onChange={(e) => patchTemplate(tpl.id, { motorGoal: e.target.value })}
                        aria-label="Cel motoryczny"
                        placeholder="Cel motoryczny"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      {tpl.blocks.map((block, i) => (
                        <div key={`${tpl.id}-b-${i}`} className={styles.sessionBlockRow}>
                          <input
                            type="text"
                            className={styles.input}
                            value={block.name}
                            onChange={(e) => patchBlock(tpl.id, i, { name: e.target.value })}
                            aria-label={`Nazwa bloku ${i + 1}`}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          <input
                            type="number"
                            className={styles.input}
                            min={1}
                            max={240}
                            value={block.minutes}
                            onChange={(e) =>
                              patchBlock(tpl.id, i, { minutes: Number(e.target.value) || 1 })
                            }
                            aria-label={`Minuty bloku ${i + 1}`}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            className={styles.dayTitleRemove}
                            onClick={() =>
                              patchTemplate(tpl.id, {
                                blocks: tpl.blocks.filter((_, j) => j !== i),
                              })
                            }
                            aria-label={`Usuń blok ${i + 1}`}
                          >
                            ×
                          </button>
                          <select
                            className={styles.dayTitleMdSelect}
                            value={block.formatId ?? ""}
                            aria-label={`Format bloku ${i + 1}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              patchBlock(tpl.id, i, {
                                formatId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Bez formatu</option>
                            {SSG_FORMATS.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <div className={styles.sessionBlockNotes}>
                            {MOTOR_TAGS.map((tag) => {
                              const active = block.tags.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  className={`${styles.blockTagToggle} ${
                                    active ? styles.blockTagToggleActive : ""
                                  }`}
                                  onClick={() => {
                                    const tags: MotorTagId[] = active
                                      ? block.tags.filter((x) => x !== tag.id)
                                      : [...block.tags, tag.id];
                                    patchBlock(tpl.id, i, { tags });
                                  }}
                                  aria-pressed={active}
                                  title={tag.label}
                                >
                                  {tag.shortLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() =>
                          patchTemplate(tpl.id, {
                            blocks: [...tpl.blocks, emptySessionBlockDraft()],
                          })
                        }
                      >
                        + Blok
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
        <div className={styles.dayTitleAddRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Nazwa presetu (np. MD-2 priming krótki)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Nazwa nowego presetu dnia"
            disabled={disabled}
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={addTemplate}
            disabled={disabled || !newName.trim()}
          >
            Dodaj preset
          </button>
          <label className={styles.sessionToolbarLabel}>
            Dodaj z modelu
            <select
              className={styles.dayTitleMdSelect}
              value=""
              aria-label="Dodaj preset dodatkowy z modelu MD"
              title="Presety dodatkowe (np. dzień siłowni po meczu) — bez roli, wstawiane ręcznie"
              disabled={disabled}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                addFromModel(Number(raw));
                e.target.value = "";
              }}
            >
              <option value="">jednostka…</option>
              {OPTIONAL_MODEL_PRESETS.map((p) => (
                <option key={p.offset} value={p.offset}>
                  {formatMatchDayLabel(p.offset)} — {p.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() =>
              setTemplatesState((prev) => ({
                templates: restoreSeedDaySessionTemplates(prev.templates),
              }))
            }
            disabled={disabled}
            title="Przywraca cztery jednostki tygodnia; własne presety zostają"
          >
            Przywróć zestaw startowy
          </button>
        </div>
      </div>
    </section>
  );
}
