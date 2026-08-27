import type { MicrocycleDaySchedule } from "@/types/trainingMicrocycle";
import { sanitizeMicrocycleOptionalTime } from "@/utils/microcycleMatches";

function safeDayIndex(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  const i = Math.trunc(x);
  if (i < 0 || i > 6) return fallback;
  return i;
}

export function getDayScheduleForDay(
  schedules: MicrocycleDaySchedule[] | undefined,
  dayIndex: number
): MicrocycleDaySchedule {
  const found = schedules?.find((s) => s.dayIndex === dayIndex);
  return found ?? { dayIndex, startTime: "", endTime: "" };
}

export function updateMicrocycleDaySchedule(
  schedules: MicrocycleDaySchedule[],
  dayIndex: number,
  patch: Partial<Pick<MicrocycleDaySchedule, "startTime" | "endTime">>
): MicrocycleDaySchedule[] {
  const current = getDayScheduleForDay(schedules, dayIndex);
  const next: MicrocycleDaySchedule = {
    dayIndex,
    startTime:
      patch.startTime !== undefined
        ? sanitizeMicrocycleOptionalTime(patch.startTime)
        : current.startTime,
    endTime:
      patch.endTime !== undefined
        ? sanitizeMicrocycleOptionalTime(patch.endTime)
        : current.endTime,
  };
  const without = schedules.filter((s) => s.dayIndex !== dayIndex);
  if (!next.startTime && !next.endTime) return without;
  return [...without, next].sort((a, b) => a.dayIndex - b.dayIndex);
}

/** Dodaje minuty do godziny HH:MM. Wynik w zakresie doby (zawija po 24 h). */
export function addMinutesToHhmm(
  hhmm: string,
  minutes: number
): string | null {
  const start = sanitizeMicrocycleOptionalTime(hhmm);
  if (!start) return null;
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function normalizeMicrocycleDaySchedules(raw: unknown): MicrocycleDaySchedule[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<number, MicrocycleDaySchedule>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const dayIndex = safeDayIndex(rec.dayIndex);
    const startTime = sanitizeMicrocycleOptionalTime(rec.startTime);
    const endTime = sanitizeMicrocycleOptionalTime(rec.endTime);
    if (!startTime && !endTime) continue;
    byDay.set(dayIndex, { dayIndex, startTime, endTime });
  }
  return [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}
