import type {
  MicrocycleDayPlan,
  TrainingDayTitleTemplate,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { formatMatchDayLabel } from "@/utils/matchDayLabels";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";

/** Typowe offsety względem dnia meczu (MD-5 … MD+1). */
export const DAY_TITLE_DEFAULT_MD_OFFSETS = [-5, -4, -3, -2, -1, 0, 1] as const;

/**
 * Offsety przypisywalne do szablonów tytułów dni.
 * MD (0) jest wykluczone — dzień meczowy ma zawsze stały tytuł „Mecz”.
 */
export const DAY_TITLE_ASSIGNABLE_MD_OFFSETS = [-5, -4, -3, -2, -1, 1] as const;

/** Stały tytuł dnia na MD (dzień meczowy). */
export const MATCH_DAY_GENERAL_FOCUS = "Mecz";

export function sanitizeDefaultMatchDayOffset(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < -6 || i > 2) return null;
  return i;
}

/** Offset dla szablonów tytułów — MD (0) nie jest dozwolone. */
export function sanitizeDayTitleMatchDayOffset(raw: unknown): number | null {
  const offset = sanitizeDefaultMatchDayOffset(raw);
  if (offset === 0) return null;
  return offset;
}

/**
 * Tytuł wyświetlany w nagłówku dnia.
 * Na dniu meczowym zawsze „Mecz” (niezależnie od dayPlan).
 */
export function resolveDayTitleDisplay(
  isMatchDay: boolean,
  dayPlan: { generalFocus: string; gameMoments: string } | null | undefined
): { generalFocus: string; gameMoments: string; locked: boolean } | null {
  if (isMatchDay) {
    return {
      generalFocus: MATCH_DAY_GENERAL_FOCUS,
      gameMoments: "",
      locked: true,
    };
  }
  if (!dayPlan) return null;
  return {
    generalFocus: dayPlan.generalFocus,
    gameMoments: dayPlan.gameMoments,
    locked: false,
  };
}

export function dayIndexFromMatchDayOffset(
  primaryMatchDayIndex: number,
  offset: number
): number | null {
  const dayIndex = primaryMatchDayIndex + offset;
  if (dayIndex < 0 || dayIndex > 6) return null;
  return dayIndex;
}

export function matchDayOffsetFromDayIndex(
  primaryMatchDayIndex: number,
  dayIndex: number
): number {
  return dayIndex - primaryMatchDayIndex;
}

export function formatDefaultMdLabel(offset: number | null | undefined): string {
  if (offset == null) return "—";
  return formatMatchDayLabel(offset);
}

/** Buduje plany dni z szablonów mających stałe przypisanie MD. */
export function dayPlansFromTitleDefaults(
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingDayTitleTemplate[]
): MicrocycleDayPlan[] {
  const byDay = new Map<number, MicrocycleDayPlan>();
  const sorted = [...templates].sort((a, b) => {
    const ao = a.defaultMatchDayOffset ?? 999;
    const bo = b.defaultMatchDayOffset ?? 999;
    return ao - bo;
  });
  for (const tpl of sorted) {
    // MD ma zawsze tytuł „Mecz” — szablony z offsetem 0 pomijamy.
    const offset = sanitizeDayTitleMatchDayOffset(tpl.defaultMatchDayOffset);
    if (offset == null) continue;
    const dayIndex = dayIndexFromMatchDayOffset(primaryMatchDayIndex, offset);
    if (dayIndex == null) continue;
    if (byDay.has(dayIndex)) continue; // pierwszy offset wygrywa przy kolizji
    byDay.set(dayIndex, {
      id: generateMicrocycleId(),
      microcycleId,
      dayIndex,
      templateId: tpl.id,
      generalFocus: tpl.generalFocus,
      gameMoments: tpl.gameMoments,
      phaseId: null,
    });
  }
  return [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}

/**
 * Wstawia / odświeża domyślne tytuły dni dla mikrocyklu.
 * Plany spoza domyślnych szablonów na wolnych dniach zostają.
 */
export function mergeDefaultDayPlansIntoState(
  state: TrainingMicrocycleState,
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingDayTitleTemplate[]
): TrainingMicrocycleState {
  const defaultTemplateIds = new Set(
    templates
      .filter((t) => sanitizeDayTitleMatchDayOffset(t.defaultMatchDayOffset) != null)
      .map((t) => t.id)
  );
  const newPlans = dayPlansFromTitleDefaults(microcycleId, primaryMatchDayIndex, templates);
  const daysTaken = new Set(newPlans.map((p) => p.dayIndex));

  const kept = (state.dayPlans ?? []).filter((p) => {
    if (p.microcycleId !== microcycleId) return true;
    if (p.templateId && defaultTemplateIds.has(p.templateId)) return false;
    if (daysTaken.has(p.dayIndex)) return false;
    return true;
  });

  return {
    ...state,
    dayPlans: [...kept, ...newPlans],
  };
}

export function setTemplateDefaultMatchDayOffset(
  templates: TrainingDayTitleTemplate[],
  templateId: string,
  offset: number | null
): TrainingDayTitleTemplate[] {
  return templates.map((t) =>
    t.id === templateId
      ? { ...t, defaultMatchDayOffset: sanitizeDayTitleMatchDayOffset(offset) }
      : t
  );
}
