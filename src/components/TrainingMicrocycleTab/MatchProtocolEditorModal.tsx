"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import type { StaffPlannerCoach } from "@/types/staffPlanner";
import type { MatchProtocolTemplate } from "@/types/trainingMicrocycle";
import {
  createDefaultMatchProtocolTemplate,
  createEmptyProtocolSubtask,
  formatDurationHhMm,
  MATCH_PROTOCOL_MAX_SUBTASKS,
  minutesBeforeKickoffFromParts,
  parseDurationHhMm,
  protocolOffsetIsAfter,
  sanitizeMatchProtocolTemplate,
  setProtocolOffsetAfter,
} from "@/utils/matchProtocol";
import styles from "./MatchProtocol.module.css";

type Props = {
  initial: MatchProtocolTemplate | null;
  coaches: StaffPlannerCoach[];
  onSave: (protocol: MatchProtocolTemplate) => void;
  onDelete?: () => void;
  onClose: () => void;
};

type SubtaskPatch = Partial<MatchProtocolTemplate["subtasks"][number]>;

export default function MatchProtocolEditorModal({
  initial,
  coaches,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<MatchProtocolTemplate>(
    () => initial ?? createDefaultMatchProtocolTemplate()
  );
  /** Przy 00:00 znak nie da się zapisać — pamiętamy „po meczu”, aż pojawi się czas. */
  const [afterIntentIds, setAfterIntentIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setSubtask = (id: string, patch: SubtaskPatch) => {
    setDraft((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const addSubtask = () => {
    setDraft((prev) => {
      if (prev.subtasks.length >= MATCH_PROTOCOL_MAX_SUBTASKS) return prev;
      return { ...prev, subtasks: [...prev.subtasks, createEmptyProtocolSubtask()] };
    });
  };

  const removeSubtask = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((s) => s.id !== id),
    }));
  };

  const handleSave = () => {
    const cleaned = sanitizeMatchProtocolTemplate({
      ...draft,
      title: draft.title.trim() || "Protokół meczowy",
      subtasks: draft.subtasks.map((s) => ({
        ...s,
        title: s.title.trim() || "Podzadanie",
      })),
    });
    if (!cleaned) return;
    onSave(cleaned);
  };

  const rows = [...draft.subtasks].sort(
    (a, b) => b.minutesBeforeKickoff - a.minutesBeforeKickoff || a.title.localeCompare(b.title, "pl")
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Protokół meczowy
            </h2>
            <p className={styles.subtitle}>
              Jedno zadanie z podzadaniami. Minus = przed meczem, plus = po meczu.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nazwa protokołu</span>
            <input
              className={styles.input}
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              maxLength={200}
            />
          </label>
          <p className={styles.hint}>
            Przykład: mecz o 18:00, −01:30 → 16:30 (przed), +00:45 → 18:45 (po).
          </p>
          <div className={styles.subtaskList} role="list">
            {rows.map((s) => {
              const isAfter =
                protocolOffsetIsAfter(s.minutesBeforeKickoff) ||
                (s.minutesBeforeKickoff === 0 && afterIntentIds.has(s.id));
              let hint = "Przed meczem";
              if (s.minutesBeforeKickoff === 0 && !afterIntentIds.has(s.id)) hint = "Godzina meczu";
              else if (isAfter) hint = "Po meczu";
              return (
              <div key={s.id} className={styles.subtaskRow} role="listitem">
                <div className={styles.subtaskTime}>
                  <span className={styles.subtaskTimeHint}>{hint}</span>
                  <span className={styles.subtaskTimeControls}>
                    <span className={styles.signToggle} role="group" aria-label="Przed lub po meczu">
                      <button
                        type="button"
                        className={`${styles.signBtn} ${!isAfter ? styles.signBtnMinus : ""}`}
                        aria-pressed={!isAfter}
                        aria-label={`Przed meczem: ${s.title || "podzadanie"}`}
                        onClick={() => {
                          setAfterIntentIds((prev) => {
                            const next = new Set(prev);
                            next.delete(s.id);
                            return next;
                          });
                          setSubtask(s.id, {
                            minutesBeforeKickoff: setProtocolOffsetAfter(s.minutesBeforeKickoff, false),
                          });
                        }}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className={`${styles.signBtn} ${isAfter ? styles.signBtnPlus : ""}`}
                        aria-pressed={isAfter}
                        aria-label={`Po meczu: ${s.title || "podzadanie"}`}
                        onClick={() => {
                          setAfterIntentIds((prev) => new Set(prev).add(s.id));
                          setSubtask(s.id, {
                            minutesBeforeKickoff: setProtocolOffsetAfter(s.minutesBeforeKickoff, true),
                          });
                        }}
                      >
                        +
                      </button>
                    </span>
                    <input
                      className={styles.input}
                      type="time"
                      value={formatDurationHhMm(Math.abs(s.minutesBeforeKickoff))}
                      onChange={(e) => {
                        const mins = parseDurationHhMm(e.target.value);
                        if (mins == null) return;
                        setSubtask(s.id, {
                          minutesBeforeKickoff: minutesBeforeKickoffFromParts(isAfter, mins),
                        });
                      }}
                      aria-label={`Czas względem meczu: ${s.title || "podzadanie"}`}
                    />
                  </span>
                </div>
                <input
                  className={styles.input}
                  value={s.title}
                  placeholder="Treść podzadania"
                  onChange={(e) => setSubtask(s.id, { title: e.target.value })}
                  aria-label="Treść podzadania"
                />
                <select
                  className={styles.select}
                  value={s.coachId ?? ""}
                  onChange={(e) => setSubtask(s.id, { coachId: e.target.value || null })}
                  aria-label={`Trener: ${s.title || "podzadanie"}`}
                >
                  <option value="">Trener</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.removeSub}
                  onClick={() => removeSubtask(s.id)}
                  aria-label={`Usuń podzadanie: ${s.title || "bez nazwy"}`}
                  disabled={draft.subtasks.length <= 1}
                >
                  ×
                </button>
              </div>
              );
            })}
          </div>
          <button
            type="button"
            className={styles.addSub}
            onClick={addSubtask}
            disabled={draft.subtasks.length >= MATCH_PROTOCOL_MAX_SUBTASKS}
          >
            + Dodaj podzadanie
          </button>
        </div>
        <div className={styles.footer}>
          {initial && onDelete ? (
            <button type="button" className={styles.dangerBtn} onClick={onDelete}>
              Usuń protokół
            </button>
          ) : null}
          <button type="button" className={styles.ghostBtn} onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSave}
            disabled={draft.subtasks.every((s) => !s.title.trim())}
          >
            Zapisz protokół
          </button>
        </div>
      </div>
    </div>
  );
}
