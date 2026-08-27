"use client";

import React, { useCallback, useMemo, useState } from "react";
import type {
  TrainingExerciseKind,
  TrainingExerciseTemplate,
  TrainingExerciseTemplatesState,
} from "@/types/trainingMicrocycle";
import { TRAINING_EXERCISE_KIND_LABELS } from "@/types/trainingMicrocycle";
import { formatDefaultMdLabel } from "@/utils/dayTitleDefaults";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";
import {
  EXERCISE_ASSIGNABLE_MD_OFFSETS,
  createSeedExerciseTemplates,
  sanitizeExerciseMinutes,
} from "@/utils/microcycleExercises";
import styles from "./TrainingMicrocycleTab.module.css";

export type MicrocycleExercisePresetsProps = {
  templatesState: TrainingExerciseTemplatesState;
  setTemplatesState: React.Dispatch<React.SetStateAction<TrainingExerciseTemplatesState>>;
  disabled: boolean;
  draggingId: string | null;
  weekUsesArtificial: boolean;
  onDragStart: (e: React.DragEvent, templateId: string) => void;
  onDragEnd: () => void;
};

export default function MicrocycleExercisePresets({
  templatesState,
  setTemplatesState,
  disabled,
  draggingId,
  weekUsesArtificial,
  onDragStart,
  onDragEnd,
}: MicrocycleExercisePresetsProps) {
  const [open, setOpen] = useState(true);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<TrainingExerciseKind>("gym");
  const [newMinutes, setNewMinutes] = useState("8");
  const [newTurf, setNewTurf] = useState(false);

  const templates = templatesState.templates;
  const gym = useMemo(() => templates.filter((t) => t.kind === "gym"), [templates]);
  const prevention = useMemo(
    () => templates.filter((t) => t.kind === "prevention"),
    [templates]
  );

  const patchTemplate = useCallback(
    (id: string, patch: Partial<TrainingExerciseTemplate>) => {
      setTemplatesState((prev) => ({
        templates: prev.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    [setTemplatesState]
  );

  const removeTemplate = useCallback(
    (id: string) => {
      setTemplatesState((prev) => ({
        templates: prev.templates.filter((t) => t.id !== id),
      }));
    },
    [setTemplatesState]
  );

  const addTemplate = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    const created: TrainingExerciseTemplate = {
      id: generateMicrocycleId(),
      name: name.slice(0, 120),
      kind: newKind,
      minutes: sanitizeExerciseMinutes(newMinutes),
      notes: "",
      artificialTurfFocus: newTurf,
      defaultMatchDayOffset: null,
    };
    setTemplatesState((prev) => ({ templates: [...prev.templates, created] }));
    setNewName("");
    setNewTurf(false);
  }, [newName, newKind, newMinutes, newTurf, setTemplatesState]);

  const restoreSeed = useCallback(() => {
    setTemplatesState({ templates: createSeedExerciseTemplates() });
  }, [setTemplatesState]);

  const renderCard = (tpl: TrainingExerciseTemplate) => {
    const turfActive = tpl.artificialTurfFocus && weekUsesArtificial;
    return (
      <div
        key={tpl.id}
        className={`${styles.exerciseChip} ${
          tpl.kind === "gym" ? styles.exerciseChipGym : styles.exerciseChipPrevention
        } ${tpl.artificialTurfFocus ? styles.exerciseChipTurf : ""} ${
          turfActive ? styles.exerciseChipTurfActive : ""
        } ${draggingId === tpl.id ? styles.exerciseChipDragging : ""}`}
        data-template-id={tpl.id}
        draggable={!disabled}
        onDragStart={(e) => onDragStart(e, tpl.id)}
        onDragEnd={onDragEnd}
      >
        <div className={styles.exerciseChipTop}>
          <span className={styles.exerciseChipName}>{tpl.name}</span>
          <button
            type="button"
            className={styles.deleteAssign}
            onClick={() => removeTemplate(tpl.id)}
            aria-label={`Usuń preset: ${tpl.name}`}
          >
            ×
          </button>
        </div>
        <div className={styles.exerciseChipMeta}>
          <span>{tpl.minutes}′</span>
          {tpl.artificialTurfFocus && (
            <span className={styles.exerciseTurfBadge} title="Ważne na sztucznej nawierzchni">
              Sztuczne
            </span>
          )}
        </div>
        <label className={styles.exerciseOffsetLabel}>
          <span className={styles.srOnly}>Domyślny dzień MD</span>
          <select
            className={styles.sectionMoveSelect}
            value={tpl.defaultMatchDayOffset ?? ""}
            onChange={(e) =>
              patchTemplate(tpl.id, {
                defaultMatchDayOffset: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            aria-label={`Przypnij ${tpl.name} do dnia MD`}
          >
            <option value="">Ręcznie</option>
            {EXERCISE_ASSIGNABLE_MD_OFFSETS.map((off) => (
              <option key={off} value={off}>
                {formatDefaultMdLabel(off)}
              </option>
            ))}
          </select>
        </label>
        {tpl.notes?.trim() ? <p className={styles.exerciseChipNotes}>{tpl.notes}</p> : null}
      </div>
    );
  };

  return (
    <section
      className={`${styles.dayTitlesSection} ${open ? "" : styles.dayTitlesSectionCollapsed}`}
      aria-label="Presety ćwiczeń — siłownia i prewencja"
    >
      <button
        type="button"
        className={styles.dayTitlesToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="exercise-presets-panel"
        id="exercise-presets-toggle"
      >
        <span className={styles.dayTitlesToggleLeft}>
          <span className={styles.dayTitlesChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className={styles.dayTitlesToggleTitle}>Ćwiczenia — siłownia / prewencja</span>
          <span className={styles.dayTitlesCountBadge}>
            {templates.length}
            {weekUsesArtificial ? " · sztuczne" : ""}
          </span>
        </span>
        <span className={styles.dayTitlesToggleHint}>{open ? "Zwiń" : "Rozwiń"}</span>
      </button>

      {!open && templates.length > 0 && (
        <div className={styles.dayTitlesCollapsedPreview} aria-hidden>
          {templates.slice(0, 8).map((t) => (
            <span key={t.id} className={styles.toolbarPreviewChip}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div
        id="exercise-presets-panel"
        className={styles.dayTitlesPanel}
        hidden={!open}
        role="region"
        aria-labelledby="exercise-presets-toggle"
      >
        <p className={styles.lnpCalendarHint}>
          Przeciągnij ćwiczenie na dzień w siatce. Te z przypiętym MD wpadają same w każdy
          nowy tydzień. Presety „Sztuczne” dokładają się, gdy mecz jest na sztucznej
          nawierzchni.
        </p>
        <div className={styles.exerciseLibraryGrid}>
          <div>
            <h3 className={styles.exerciseLibraryHeading}>
              {TRAINING_EXERCISE_KIND_LABELS.gym} ({gym.length})
            </h3>
            <div className={styles.exerciseChipList}>{gym.map(renderCard)}</div>
          </div>
          <div>
            <h3 className={styles.exerciseLibraryHeading}>
              {TRAINING_EXERCISE_KIND_LABELS.prevention} ({prevention.length})
            </h3>
            <div className={styles.exerciseChipList}>{prevention.map(renderCard)}</div>
          </div>
        </div>
        <div className={styles.exerciseAddRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Nowe ćwiczenie…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Nazwa nowego ćwiczenia"
          />
          <select
            className={styles.select}
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as TrainingExerciseKind)}
            aria-label="Rodzaj ćwiczenia"
          >
            <option value="gym">{TRAINING_EXERCISE_KIND_LABELS.gym}</option>
            <option value="prevention">{TRAINING_EXERCISE_KIND_LABELS.prevention}</option>
          </select>
          <input
            type="number"
            className={styles.tempInput}
            min={1}
            max={90}
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            aria-label="Minuty"
          />
          <label className={styles.exerciseTurfCheck}>
            <input
              type="checkbox"
              checked={newTurf}
              onChange={(e) => setNewTurf(e.target.checked)}
            />
            Sztuczne
          </label>
          <button type="button" className={styles.addBtn} onClick={addTemplate} disabled={!newName.trim()}>
            Dodaj
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={restoreSeed}
            title="Przywróć zestaw startowy siłowni i prewencji"
          >
            Przywróć zestaw
          </button>
        </div>
      </div>
    </section>
  );
}
