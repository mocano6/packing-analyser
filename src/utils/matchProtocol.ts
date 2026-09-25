import type {
  MatchProtocolSubtaskTemplate,
  MatchProtocolTemplate,
  MicrocycleMatch,
  MicrocycleMatchProtocol,
  MicrocycleMatchProtocolSubtask,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { addDays, parseIsoDateLocal, toIsoDateLocal } from "@/utils/matchDayLabels";
import { sanitizeOptionalCoachId } from "@/utils/proceduralTaskDefaults";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";

export const DEFAULT_MATCH_PROTOCOL_TITLE = "Protokół meczowy";
export const MATCH_PROTOCOL_MAX_SUBTASKS = 20;
export const MATCH_PROTOCOL_HOUR_HEIGHT_PX = 72;
export const MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX = 56;
export const MATCH_PROTOCOL_EVENT_GAP_PX = 4;
export const MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX = 40;
export const MATCH_PROTOCOL_MAX_EVENT_MINUTES = 45;
export const MATCH_PROTOCOL_NOW_RANGE_PAD_MINUTES = 120;

const MAX_DURATION_MINUTES = 23 * 60 + 59;

export function parseDurationHhMm(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatDurationHhMm(minutes: number): string {
  const n = Math.max(0, Math.min(MAX_DURATION_MINUTES, Math.trunc(Number(minutes) || 0)));
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutesFromKickoffHhMm(kickoffHhMm: string): number {
  return parseDurationHhMm(kickoffHhMm) ?? 18 * 60;
}

function clampOffsetMinutes(raw: number): number {
  const n = Math.trunc(Number.isFinite(raw) ? raw : 0);
  return Math.max(-MAX_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, n));
}

/** Ujemny offset = po meczu (plus), dodatni = przed meczem (minus). */
export function protocolOffsetIsAfter(minutesBeforeKickoff: number): boolean {
  return clampOffsetMinutes(minutesBeforeKickoff) < 0;
}

/** Składa minutesBeforeKickoff z znaku (− przed / + po) i czasu hh:mm. */
export function minutesBeforeKickoffFromParts(isAfter: boolean, durationMinutes: number): number {
  const mag = Math.max(0, Math.min(MAX_DURATION_MINUTES, Math.trunc(durationMinutes) || 0));
  if (mag === 0) return 0;
  return isAfter ? -mag : mag;
}

export function setProtocolOffsetAfter(minutesBeforeKickoff: number, isAfter: boolean): number {
  return minutesBeforeKickoffFromParts(isAfter, Math.abs(clampOffsetMinutes(minutesBeforeKickoff)));
}

/**
 * Godzina zegarowa podzadania: kickoff − offset (offset ujemny = po meczu).
 * dayDelta: 0 ten sam dzień, -1 dzień wcześniej, +1 dzień później.
 */
export function clockFromKickoff(
  kickoffHhMm: string,
  minutesBeforeKickoff: number
): { clock: string; dayDelta: number; minutesOfDay: number } {
  const kick = minutesFromKickoffHhMm(kickoffHhMm);
  const before = clampOffsetMinutes(minutesBeforeKickoff);
  let total = kick - before;
  let dayDelta = 0;
  const dayMin = 24 * 60;
  while (total < 0) {
    total += dayMin;
    dayDelta -= 1;
  }
  while (total >= dayMin) {
    total -= dayMin;
    dayDelta += 1;
  }
  return { clock: formatDurationHhMm(total), dayDelta, minutesOfDay: total };
}

export function createDefaultMatchProtocolTemplate(): MatchProtocolTemplate {
  const rows: Array<[string, number]> = [
    ["Zbiórka / wyjazd", 180],
    ["Przyjazd na obiekt", 90],
    ["Briefing w szatni", 60],
    ["Rozgrzewka", 45],
    ["Wejście do szatni", 15],
    ["Mecz", 0],
  ];
  return {
    id: generateMicrocycleId(),
    title: DEFAULT_MATCH_PROTOCOL_TITLE,
    notes: "",
    subtasks: rows.map(([title, minutesBeforeKickoff]) => ({
      id: generateMicrocycleId(),
      title,
      notes: "",
      minutesBeforeKickoff,
      coachId: null,
    })),
  };
}

export function createEmptyProtocolSubtask(): MatchProtocolSubtaskTemplate {
  return {
    id: generateMicrocycleId(),
    title: "",
    notes: "",
    minutesBeforeKickoff: 60,
    coachId: null,
  };
}

function sanitizeMinutesBefore(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampOffsetMinutes(raw);
  }
  const s = String(raw ?? "").trim();
  const signed = s.match(/^([+-])(\d{1,2}:\d{2})$/);
  if (signed) {
    const mag = parseDurationHhMm(signed[2]);
    if (mag != null) return minutesBeforeKickoffFromParts(signed[1] === "+", mag);
  }
  const fromHhMm = parseDurationHhMm(raw);
  if (fromHhMm != null) return fromHhMm;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return clampOffsetMinutes(n);
  }
  return 60;
}

export function sanitizeMatchProtocolSubtaskTemplate(
  raw: Record<string, unknown>
): MatchProtocolSubtaskTemplate | null {
  const id = String(raw.id ?? "").slice(0, 80);
  const title = String(raw.title ?? "").slice(0, 200).trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    notes: String(raw.notes ?? "").slice(0, 400),
    minutesBeforeKickoff: sanitizeMinutesBefore(raw.minutesBeforeKickoff),
    coachId: sanitizeOptionalCoachId(raw.coachId),
  };
}

export function sanitizeMatchProtocolTemplate(
  raw: unknown
): MatchProtocolTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? "").slice(0, 80);
  const title = String(rec.title ?? DEFAULT_MATCH_PROTOCOL_TITLE).slice(0, 200).trim();
  if (!id || !title) return null;
  const subRaw = Array.isArray(rec.subtasks) ? rec.subtasks : [];
  const subtasks: MatchProtocolSubtaskTemplate[] = [];
  for (const item of subRaw) {
    if (!item || typeof item !== "object") continue;
    const st = sanitizeMatchProtocolSubtaskTemplate(item as Record<string, unknown>);
    if (st) subtasks.push(st);
    if (subtasks.length >= MATCH_PROTOCOL_MAX_SUBTASKS) break;
  }
  if (subtasks.length === 0) return null;
  return {
    id,
    title,
    notes: String(rec.notes ?? "").slice(0, 400),
    subtasks,
  };
}

function sanitizeInstanceSubtask(
  raw: Record<string, unknown>
): MicrocycleMatchProtocolSubtask | null {
  const id = String(raw.id ?? "").slice(0, 80);
  const title = String(raw.title ?? "").slice(0, 200).trim();
  if (!id || !title) return null;
  const tplId =
    raw.templateSubtaskId == null || raw.templateSubtaskId === ""
      ? null
      : String(raw.templateSubtaskId).slice(0, 80);
  return {
    id,
    templateSubtaskId: tplId,
    title,
    notes: String(raw.notes ?? "").slice(0, 400),
    minutesBeforeKickoff: sanitizeMinutesBefore(raw.minutesBeforeKickoff),
    done: raw.done === true,
    coachId: sanitizeOptionalCoachId(raw.coachId),
  };
}

export function sanitizeMicrocycleMatchProtocol(
  raw: Record<string, unknown>
): MicrocycleMatchProtocol | null {
  const id = String(raw.id ?? "").slice(0, 80);
  const microcycleId = String(raw.microcycleId ?? "").slice(0, 80);
  const title = String(raw.title ?? "").slice(0, 200).trim();
  if (!id || !microcycleId || !title) return null;
  const dayRaw = typeof raw.dayIndex === "number" ? raw.dayIndex : Number(raw.dayIndex);
  const dayIndex = Number.isFinite(dayRaw) ? Math.trunc(dayRaw) : 0;
  if (dayIndex < 0 || dayIndex > 6) return null;
  const miRaw = typeof raw.matchIndex === "number" ? raw.matchIndex : Number(raw.matchIndex);
  const matchIndex = miRaw === 1 ? 1 : 0;
  const subRaw = Array.isArray(raw.subtasks) ? raw.subtasks : [];
  const subtasks: MicrocycleMatchProtocolSubtask[] = [];
  for (const item of subRaw) {
    if (!item || typeof item !== "object") continue;
    const st = sanitizeInstanceSubtask(item as Record<string, unknown>);
    if (st) subtasks.push(st);
    if (subtasks.length >= MATCH_PROTOCOL_MAX_SUBTASKS) break;
  }
  if (subtasks.length === 0) return null;
  return {
    id,
    microcycleId,
    matchIndex,
    dayIndex,
    templateId:
      raw.templateId == null || raw.templateId === "" ? null : String(raw.templateId).slice(0, 80),
    title,
    subtasks,
  };
}

export function normalizeMatchProtocols(raw: unknown): MicrocycleMatchProtocol[] {
  if (!Array.isArray(raw)) return [];
  const out: MicrocycleMatchProtocol[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = sanitizeMicrocycleMatchProtocol(item as Record<string, unknown>);
    if (p) out.push(p);
  }
  return out;
}

function sortSubtaskTemplates(
  subtasks: MatchProtocolSubtaskTemplate[]
): MatchProtocolSubtaskTemplate[] {
  return [...subtasks].sort(
    (a, b) =>
      b.minutesBeforeKickoff - a.minutesBeforeKickoff || a.title.localeCompare(b.title, "pl")
  );
}

/**
 * Wstawia / odświeża protokół przy każdym meczu mikrocyklu.
 * Zachowuje `done` po templateSubtaskId + matchIndex.
 */
export function mergeMatchProtocolIntoState(
  state: TrainingMicrocycleState,
  microcycleId: string,
  matches: MicrocycleMatch[],
  protocol: MatchProtocolTemplate | null
): TrainingMicrocycleState {
  const others = (state.matchProtocols ?? []).filter((p) => p.microcycleId !== microcycleId);
  if (!protocol || protocol.subtasks.length === 0 || matches.length === 0) {
    if (others.length === (state.matchProtocols ?? []).length) return state;
    return { ...state, matchProtocols: others };
  }

  const previous = (state.matchProtocols ?? []).filter((p) => p.microcycleId === microcycleId);
  const sortedTpl = sortSubtaskTemplates(protocol.subtasks);
  const incoming = matches.slice(0, 2).map((match, matchIndex) => {
    const prev = previous.find((p) => p.matchIndex === matchIndex);
    const doneByTpl = new Map<string, boolean>();
    const idByTpl = new Map<string, string>();
    for (const s of prev?.subtasks ?? []) {
      if (!s.templateSubtaskId) continue;
      doneByTpl.set(s.templateSubtaskId, !!s.done);
      idByTpl.set(s.templateSubtaskId, s.id);
    }
    const subtasks: MicrocycleMatchProtocolSubtask[] = sortedTpl.map((st) => ({
      id: idByTpl.get(st.id) ?? generateMicrocycleId(),
      templateSubtaskId: st.id,
      title: st.title,
      notes: st.notes ?? "",
      minutesBeforeKickoff: st.minutesBeforeKickoff,
      done: doneByTpl.get(st.id) ?? false,
      coachId: sanitizeOptionalCoachId(st.coachId),
    }));
    return {
      id: prev?.id ?? generateMicrocycleId(),
      microcycleId,
      matchIndex,
      dayIndex: match.dayIndex,
      templateId: protocol.id,
      title: protocol.title.trim() || DEFAULT_MATCH_PROTOCOL_TITLE,
      subtasks,
    };
  });

  return { ...state, matchProtocols: [...others, ...incoming] };
}

export function mergeMatchProtocolForMicrocycle(
  state: TrainingMicrocycleState,
  microcycleId: string,
  protocol: MatchProtocolTemplate | null | undefined
): TrainingMicrocycleState {
  const mc = state.microcycles.find((m) => m.id === microcycleId);
  if (!mc) return state;
  return mergeMatchProtocolIntoState(state, microcycleId, mc.matches, protocol ?? null);
}

export function applyMatchProtocolToAllMicrocycles(
  state: TrainingMicrocycleState,
  protocol: MatchProtocolTemplate | null | undefined
): TrainingMicrocycleState {
  let next = state;
  for (const mc of state.microcycles) {
    next = mergeMatchProtocolIntoState(next, mc.id, mc.matches, protocol ?? null);
  }
  return next;
}

export function matchProtocolsForDay(
  protocols: MicrocycleMatchProtocol[] | undefined,
  microcycleId: string,
  dayIndex: number
): MicrocycleMatchProtocol[] {
  return (protocols ?? [])
    .filter((p) => p.microcycleId === microcycleId && p.dayIndex === dayIndex)
    .sort((a, b) => a.matchIndex - b.matchIndex);
}

export function protocolDoneCounts(protocol: MicrocycleMatchProtocol): {
  done: number;
  total: number;
} {
  const total = protocol.subtasks.length;
  const done = protocol.subtasks.filter((s) => s.done).length;
  return { done, total };
}

export function clearCoachFromMatchProtocol(
  protocol: MatchProtocolTemplate | null | undefined,
  coachId: string
): MatchProtocolTemplate | null {
  if (!protocol) return protocol ?? null;
  if (!coachId) return protocol;
  return {
    ...protocol,
    subtasks: protocol.subtasks.map((s) =>
      s.coachId === coachId ? { ...s, coachId: null } : s
    ),
  };
}

export function clearCoachFromMatchProtocolInstances(
  protocols: MicrocycleMatchProtocol[] | undefined,
  coachId: string
): MicrocycleMatchProtocol[] {
  if (!coachId) return protocols ?? [];
  return (protocols ?? []).map((p) => ({
    ...p,
    subtasks: p.subtasks.map((s) => (s.coachId === coachId ? { ...s, coachId: null } : s)),
  }));
}

export function toggleProtocolSubtaskDone(
  protocols: MicrocycleMatchProtocol[] | undefined,
  protocolId: string,
  subtaskId: string
): MicrocycleMatchProtocol[] {
  return (protocols ?? []).map((p) =>
    p.id !== protocolId
      ? p
      : {
          ...p,
          subtasks: p.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
        }
  );
}

export type ProtocolTimelineItem = {
  subtask: MicrocycleMatchProtocolSubtask;
  clock: string;
  dayDelta: number;
  minutesOfDay: number;
};

export function protocolTimelineItems(
  protocol: MicrocycleMatchProtocol,
  kickoffHhMm: string
): ProtocolTimelineItem[] {
  return protocol.subtasks
    .map((subtask) => {
      const t = clockFromKickoff(kickoffHhMm, subtask.minutesBeforeKickoff);
      return { subtask, ...t };
    })
    .sort(
      (a, b) =>
        a.dayDelta - b.dayDelta ||
        a.minutesOfDay - b.minutesOfDay ||
        a.subtask.title.localeCompare(b.subtask.title, "pl")
    );
}

export function protocolTimelineHours(
  items: ProtocolTimelineItem[],
  kickoffHhMm: string,
  nowMinutesOfDay?: number | null
): { startHour: number; endHour: number } {
  const kick = minutesFromKickoffHhMm(kickoffHhMm);
  const sameDay = items.filter((i) => i.dayDelta === 0).map((i) => i.minutesOfDay);
  let minM = sameDay.length > 0 ? Math.min(...sameDay, kick) : kick;
  let maxM = sameDay.length > 0 ? Math.max(...sameDay, kick) : kick;
  if (nowMinutesOfDay != null && Number.isFinite(nowMinutesOfDay)) {
    const n = Math.max(0, Math.min(24 * 60 - 1, nowMinutesOfDay));
    const near = n >= minM - MATCH_PROTOCOL_NOW_RANGE_PAD_MINUTES && n <= maxM + MATCH_PROTOCOL_NOW_RANGE_PAD_MINUTES;
    if (near) {
      minM = Math.min(minM, n);
      maxM = Math.max(maxM, n);
    }
  }
  const startHour = Math.max(0, Math.floor(minM / 60));
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil((maxM + 1) / 60) + 1));
  return { startHour, endHour };
}

/** Czy podzadanie już minęło względem teraz (dzień meczu + offset + godzina). */
export function protocolItemIsPast(
  matchDateIso: string,
  dayDelta: number,
  minutesOfDay: number,
  now = new Date()
): boolean {
  if (!matchDateIso) return false;
  const base = parseIsoDateLocal(matchDateIso);
  if (Number.isNaN(base.getTime())) return false;
  const day = addDays(base, dayDelta);
  const itemMs = day.getTime() + Math.max(0, minutesOfDay) * 60_000;
  return itemMs < now.getTime();
}

export function minutesOfDayFromDate(now: Date): number {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

export function protocolEventTopPx(
  minutesOfDay: number,
  startHour: number,
  hourHeight = MATCH_PROTOCOL_HOUR_HEIGHT_PX
): number {
  return ((minutesOfDay - startHour * 60) / 60) * hourHeight;
}

export function protocolHourHeightForWrap(
  wrapHeightPx: number,
  hourCount: number,
  minHourHeight = MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX
): number {
  const hours = Math.max(1, Math.trunc(hourCount) || 1);
  const available = Number.isFinite(wrapHeightPx) ? wrapHeightPx : 0;
  const floor = Math.max(MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX, minHourHeight);
  if (available <= 0) return Math.max(MATCH_PROTOCOL_HOUR_HEIGHT_PX, floor);
  return Math.max(floor, available / hours);
}

export type ProtocolEventLayout = {
  top: number;
  height: number;
};

function protocolTimeGroups(items: Array<{ minutesOfDay: number }>): number[][] {
  const groups: number[][] = [];
  items.forEach((item, i) => {
    const prev = items[i - 1];
    if (prev && prev.minutesOfDay === item.minutesOfDay && groups.length > 0) {
      groups[groups.length - 1].push(i);
    } else {
      groups.push([i]);
    }
  });
  return groups;
}

function protocolGroupSlotEnd(
  minutes: number,
  nextMinutes: number | undefined,
  endMinutes: number
): number {
  const raw = nextMinutes ?? endMinutes;
  return Math.min(raw, minutes + MATCH_PROTOCOL_MAX_EVENT_MINUTES);
}

function protocolGroupStackHeight(
  count: number,
  minEventHeight = MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
  gapPx = MATCH_PROTOCOL_EVENT_GAP_PX
): number {
  const n = Math.max(1, count);
  return n * minEventHeight + n * gapPx;
}

/** Wysokość godziny, by stos zadań (ta sama minuta) nie nachodził. */
export function protocolHourHeightForEvents(
  items: Array<{ minutesOfDay: number }>,
  startHour: number,
  endHour: number,
  minEventHeight = MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
  gapPx = MATCH_PROTOCOL_EVENT_GAP_PX
): number {
  const endMinutes = Math.max(startHour, endHour) * 60;
  const groups = protocolTimeGroups(items);
  let needed = MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX;
  groups.forEach((idxs, gi) => {
    const minutes = items[idxs[0]]?.minutesOfDay ?? 0;
    const nextMinutes = groups[gi + 1] ? items[groups[gi + 1][0]]?.minutesOfDay : undefined;
    const slot = Math.max(15, protocolGroupSlotEnd(minutes, nextMinutes, endMinutes) - minutes);
    const stack = protocolGroupStackHeight(idxs.length, minEventHeight, gapPx);
    needed = Math.max(needed, (stack * 60) / slot);
  });
  return needed;
}

/**
 * Blok od godziny zadania do następnego unikalnego czasu (albo max. 45 min).
 * Zadania o tej samej minucie — pełna szerokość, jeden pod drugim.
 */
export function protocolEventLayouts(
  items: Array<{ minutesOfDay: number }>,
  startHour: number,
  endHour: number,
  hourHeight: number,
  gapPx = MATCH_PROTOCOL_EVENT_GAP_PX
): ProtocolEventLayout[] {
  const endMinutes = Math.max(startHour, endHour) * 60;
  const groups = protocolTimeGroups(items);
  const out: ProtocolEventLayout[] = items.map(() => ({
    top: 0,
    height: MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
  }));

  groups.forEach((idxs, gi) => {
    const minutes = items[idxs[0]]?.minutesOfDay ?? 0;
    const nextMinutes = groups[gi + 1] ? items[groups[gi + 1][0]]?.minutesOfDay : undefined;
    const slotEnd = protocolGroupSlotEnd(minutes, nextMinutes, endMinutes);
    const top = protocolEventTopPx(minutes, startHour, hourHeight);
    const rawBottom = protocolEventTopPx(slotEnd, startHour, hourHeight);
    const bottom = Number.isFinite(rawBottom) ? rawBottom : top + MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX;
    const n = idxs.length;
    const inner = Math.max(0, bottom - top - gapPx);
    const height = Math.max(
      MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
      (inner - (n - 1) * gapPx) / n
    );
    idxs.forEach((idx, row) => {
      out[idx] = { top: top + row * (height + gapPx), height };
    });
  });

  return protocolNudgeOverlappingEvents(out, gapPx);
}

/** Jeśli blok nie mieści się w slocie, zsuwa kolejne w dół — bez nachodzenia. */
export function protocolNudgeOverlappingEvents(
  layouts: ProtocolEventLayout[],
  gapPx = MATCH_PROTOCOL_EVENT_GAP_PX
): ProtocolEventLayout[] {
  let cursor = Number.NEGATIVE_INFINITY;
  return layouts.map((layout) => {
    const top = Math.max(layout.top, cursor);
    const height = Math.max(MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX, layout.height);
    cursor = top + height + gapPx;
    return { top, height };
  });
}

/** Linia „teraz” jak w Kalendarzu Google — tylko w dniu meczu. */
export function nowLineTopPx(
  matchDateIso: string,
  startHour: number,
  endHour: number,
  hourHeight = MATCH_PROTOCOL_HOUR_HEIGHT_PX,
  now = new Date()
): number | null {
  if (!matchDateIso || toIsoDateLocal(now) !== matchDateIso) return null;
  const minutes = minutesOfDayFromDate(now);
  const top = protocolEventTopPx(minutes, startHour, hourHeight);
  const max = (endHour - startHour) * hourHeight;
  if (top < -4 || top > max + 4) return null;
  return top;
}

export function protocolTimeRangeLabel(
  protocol: MicrocycleMatchProtocol,
  kickoffHhMm: string
): string {
  const items = protocolTimelineItems(protocol, kickoffHhMm);
  if (items.length === 0) return "";
  const first = items[0];
  const last = items[items.length - 1];
  const labelClock = (item: ProtocolTimelineItem) => {
    if (item.dayDelta < 0) return `d−1 ${item.clock}`;
    if (item.dayDelta > 0) return `d+1 ${item.clock}`;
    return item.clock;
  };
  const a = labelClock(first);
  const b = labelClock(last);
  return a === b ? a : `${a}–${b}`;
}
