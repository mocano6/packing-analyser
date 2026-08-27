import type { MotorSessionRole } from "@/types/microcycleMotor";
import { MOTOR_CORE_SESSION_ROLES, MOTOR_SESSION_ROLE_BY_ID } from "@/types/microcycleMotor";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";
import { defaultAmateurRestDays, normalizeRestDays } from "@/utils/microcycleRestDays";

/** Maksymalna liczba jednostek treningowych w mikrocyklu amatorskim. */
export const MAX_WEEK_TRAINING_SESSIONS = MOTOR_CORE_SESSION_ROLES.length;

/** Liczba dni do najbliższego meczu (1 = dzień przed meczem, 6 = najdalej). */
export function daysToNextMatch(dayIndex: number, matchDays: number[]): number {
  const days = normalizeMatchDaysArray(matchDays);
  return Math.min(...days.map((md) => ((md - dayIndex + 7) % 7) || 7));
}

/** Rola wynikająca z samej odległości od meczu — dla dni poza rotacją tygodnia. */
export function roleForDaysToMatch(days: number): MotorSessionRole {
  if (days <= 1) return "activation";
  if (days === 2) return "speed";
  if (days === 3) return "volume";
  if (days === 4) return "tension";
  return "strength";
}

function rolesForSessionCount(count: number): MotorSessionRole[] {
  if (count <= 0) return [];
  if (count === 1) return ["volume"];
  if (count === 2) return ["volume", "speed"];
  if (count === 3) return ["tension", "volume", "speed"];
  return ["strength", "tension", "volume", "speed"];
}

function keepTrainingDayScore(dayIndex: number, matchDays: number[]): number {
  const weekdayBonus = dayIndex <= 3 ? 100 : 0;
  return weekdayBonus + daysToNextMatch(dayIndex, matchDays);
}

/**
 * Dni wolne przy rozpisywaniu tygodnia: szanuje ręczne WOLNE, a gdy ich brak —
 * piątek i weekend bez meczu. Nigdy więcej niż 4 jednostki.
 */
export function restDaysForWeekFill(matchDays: number[], existingRest: number[] = []): number[] {
  const days = normalizeMatchDaysArray(matchDays);
  const matches = new Set(days);
  const rest = new Set(
    existingRest.length > 0 ? normalizeRestDays(existingRest) : defaultAmateurRestDays(days)
  );
  for (const md of matches) rest.delete(md);

  const training: number[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    if (!matches.has(dayIndex) && !rest.has(dayIndex)) training.push(dayIndex);
  }
  if (training.length > MAX_WEEK_TRAINING_SESSIONS) {
    training.sort(
      (a, b) => keepTrainingDayScore(b, days) - keepTrainingDayScore(a, days) || a - b
    );
    training.slice(MAX_WEEK_TRAINING_SESSIONS).forEach((d) => rest.add(d));
  }
  return [...rest].sort((a, b) => a - b);
}

export interface MicrocycleSessionRoleAssignment {
  dayIndex: number;
  role: MotorSessionRole;
  daysToMatch: number;
}

/**
 * Przypisuje role jednostek do dni treningowych: dni meczowe i wolne są pomijane.
 * MD-1 nie dostaje piątej jednostki — zostaje wolny, chyba że to jedyny dostępny dzień.
 * Szczyt objętości nigdy nie ląduje bliżej niż 3 dni od meczu.
 */
export function assignSessionRolesToWeek(
  matchDays: number[],
  restDays: number[] = []
): MicrocycleSessionRoleAssignment[] {
  const days = normalizeMatchDaysArray(matchDays);
  const rest = new Set(normalizeRestDays(restDays));
  const far: { dayIndex: number; daysToMatch: number }[] = [];
  const near: { dayIndex: number; daysToMatch: number }[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    if (days.includes(dayIndex) || rest.has(dayIndex)) continue;
    const item = { dayIndex, daysToMatch: daysToNextMatch(dayIndex, days) };
    if (item.daysToMatch <= 1) near.push(item);
    else far.push(item);
  }

  const byKeep = (a: { dayIndex: number }, b: { dayIndex: number }) =>
    keepTrainingDayScore(b.dayIndex, days) - keepTrainingDayScore(a.dayIndex, days) ||
    a.dayIndex - b.dayIndex;

  const queue = far.sort(byKeep).slice(0, MAX_WEEK_TRAINING_SESSIONS);
  if (queue.length === 0 && near.length > 0) {
    queue.push(near.sort(byKeep)[0]);
  }
  queue.sort((a, b) => b.daysToMatch - a.daysToMatch || a.dayIndex - b.dayIndex);

  const roles = rolesForSessionCount(queue.length);
  const minVolumeDays = MOTOR_SESSION_ROLE_BY_ID.volume.minDaysToMatch;

  let volumeIndex = roles.indexOf("volume");
  while (volumeIndex > 0 && queue[volumeIndex].daysToMatch < minVolumeDays) {
    roles[volumeIndex] = roles[volumeIndex - 1];
    roles[volumeIndex - 1] = "volume";
    volumeIndex -= 1;
  }
  if (queue.length === 1 && queue[0].daysToMatch < minVolumeDays) roles[0] = "speed";

  return queue
    .map((c, i) => ({ dayIndex: c.dayIndex, role: roles[i], daysToMatch: c.daysToMatch }))
    .sort((a, b) => a.dayIndex - b.dayIndex);
}
