import type {
  MicrocycleProceduralTask,
  TrainingMicrocycleState,
  TrainingProceduralTaskTemplate,
} from "@/types/trainingMicrocycle";
import {
  dayIndexFromMatchDayOffset,
  sanitizeDefaultMatchDayOffset,
} from "@/utils/dayTitleDefaults";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";

export function sanitizeOptionalCoachId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().slice(0, 80);
  return s.length > 0 ? s : null;
}

/** Seed startowy biblioteki zadań procesowych. */
export function createSeedProceduralTaskTemplates(): TrainingProceduralTaskTemplate[] {
  return [
    {
      id: generateMicrocycleId(),
      title: "Sprawdzenie protokołów i listy zgłoszonych zawodników",
      notes: "",
      defaultMatchDayOffset: -5,
    },
    {
      id: generateMicrocycleId(),
      title: "Potwierdzenie transportu / logistyki wyjazdu",
      notes: "",
      defaultMatchDayOffset: -3,
    },
    {
      id: generateMicrocycleId(),
      title: "Sprawdzenie pogody na dzień meczowy",
      notes: "",
      defaultMatchDayOffset: -1,
    },
    {
      id: generateMicrocycleId(),
      title: "Kontrola wyposażenia i sprzętu meczowego",
      notes: "",
      defaultMatchDayOffset: -1,
    },
  ];
}

export function setProceduralTemplateDefaultMatchDayOffset(
  templates: TrainingProceduralTaskTemplate[],
  templateId: string,
  offset: number | null
): TrainingProceduralTaskTemplate[] {
  return templates.map((t) =>
    t.id === templateId
      ? { ...t, defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(offset) }
      : t
  );
}

export function setProceduralTemplateDefaultCoachId(
  templates: TrainingProceduralTaskTemplate[],
  templateId: string,
  coachId: string | null
): TrainingProceduralTaskTemplate[] {
  const next = sanitizeOptionalCoachId(coachId);
  return templates.map((t) => (t.id === templateId ? { ...t, defaultCoachId: next } : t));
}

export function applyCoachIdToProceduralTasks(
  tasks: MicrocycleProceduralTask[] | undefined,
  templateId: string,
  coachId: string | null
): MicrocycleProceduralTask[] {
  const next = sanitizeOptionalCoachId(coachId);
  return (tasks ?? []).map((t) => (t.templateId === templateId ? { ...t, coachId: next } : t));
}

export function clearCoachFromProceduralTemplates(
  templates: TrainingProceduralTaskTemplate[],
  coachId: string
): TrainingProceduralTaskTemplate[] {
  if (!coachId) return templates;
  return templates.map((t) =>
    t.defaultCoachId === coachId ? { ...t, defaultCoachId: null } : t
  );
}

export function clearCoachFromProceduralTasks(
  tasks: MicrocycleProceduralTask[] | undefined,
  coachId: string
): MicrocycleProceduralTask[] {
  if (!coachId) return tasks ?? [];
  return (tasks ?? []).map((t) => (t.coachId === coachId ? { ...t, coachId: null } : t));
}

/** Buduje instancje zadań z szablonów mających stałe przypisanie MD (wiele na dzień OK). */
export function proceduralTasksFromDefaults(
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingProceduralTaskTemplate[],
  previousDoneByTemplateId: Map<string, boolean> = new Map()
): MicrocycleProceduralTask[] {
  const sorted = [...templates].sort((a, b) => {
    const ao = a.defaultMatchDayOffset ?? 999;
    const bo = b.defaultMatchDayOffset ?? 999;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title, "pl");
  });
  const out: MicrocycleProceduralTask[] = [];
  for (const tpl of sorted) {
    const offset = sanitizeDefaultMatchDayOffset(tpl.defaultMatchDayOffset);
    if (offset == null) continue;
    const dayIndex = dayIndexFromMatchDayOffset(primaryMatchDayIndex, offset);
    if (dayIndex == null) continue;
    out.push({
      id: generateMicrocycleId(),
      microcycleId,
      dayIndex,
      templateId: tpl.id,
      title: tpl.title,
      notes: tpl.notes ?? "",
      done: previousDoneByTemplateId.get(tpl.id) ?? false,
      coachId: sanitizeOptionalCoachId(tpl.defaultCoachId),
    });
  }
  return out;
}

/**
 * Wstawia / odświeża domyślne zadania procesowe dla mikrocyklu.
 * Zachowuje `done` po templateId. Zadania ręczne (bez templateId z biblioteki MD) na wolnych slotach zostają.
 */
export function mergeDefaultProceduralTasksIntoState(
  state: TrainingMicrocycleState,
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingProceduralTaskTemplate[]
): TrainingMicrocycleState {
  const defaultTemplateIds = new Set(
    templates
      .filter((t) => sanitizeDefaultMatchDayOffset(t.defaultMatchDayOffset) != null)
      .map((t) => t.id)
  );

  const previousDone = new Map<string, boolean>();
  for (const t of state.proceduralTasks ?? []) {
    if (t.microcycleId !== microcycleId) continue;
    if (t.templateId && defaultTemplateIds.has(t.templateId)) {
      previousDone.set(t.templateId, !!t.done);
    }
  }

  const newTasks = proceduralTasksFromDefaults(
    microcycleId,
    primaryMatchDayIndex,
    templates,
    previousDone
  );

  const kept = (state.proceduralTasks ?? []).filter((t) => {
    if (t.microcycleId !== microcycleId) return true;
    if (t.templateId && defaultTemplateIds.has(t.templateId)) return false;
    return true;
  });

  return {
    ...state,
    proceduralTasks: [...kept, ...newTasks],
  };
}

export function proceduralTasksForDay(
  tasks: MicrocycleProceduralTask[] | undefined,
  microcycleId: string,
  dayIndex: number
): MicrocycleProceduralTask[] {
  return (tasks ?? [])
    .filter((t) => t.microcycleId === microcycleId && t.dayIndex === dayIndex)
    .sort((a, b) => a.title.localeCompare(b.title, "pl"));
}

export function sanitizeProceduralTask(
  raw: Record<string, unknown>
): MicrocycleProceduralTask | null {
  const id = String(raw.id ?? "");
  const microcycleId = String(raw.microcycleId ?? "");
  const title = String(raw.title ?? "").slice(0, 200);
  if (!id || !microcycleId || !title.trim()) return null;
  const dayRaw = typeof raw.dayIndex === "number" ? raw.dayIndex : Number(raw.dayIndex);
  const dayIndex = Number.isFinite(dayRaw) ? Math.trunc(dayRaw) : 0;
  if (dayIndex < 0 || dayIndex > 6) return null;
  return {
    id,
    microcycleId,
    dayIndex,
    templateId:
      raw.templateId == null || raw.templateId === "" ? null : String(raw.templateId),
    title,
    notes: String(raw.notes ?? "").slice(0, 400),
    done: raw.done === true,
    coachId: sanitizeOptionalCoachId(raw.coachId),
  };
}

export function normalizeProceduralTasks(raw: unknown): MicrocycleProceduralTask[] {
  if (!Array.isArray(raw)) return [];
  const out: MicrocycleProceduralTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = sanitizeProceduralTask(item as Record<string, unknown>);
    if (t) out.push(t);
  }
  return out;
}
