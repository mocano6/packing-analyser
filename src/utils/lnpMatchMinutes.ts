// Skład i minuty z meczu ŁNP (events) → PlayerMinutes LOOKBALL.

import type { Player, PlayerMinutes } from "@/types";
import {
  computePlayerPlayInterval,
  type RawEventItem,
  type RawSquadPlayer,
} from "@/lib/scouting/minutes";
import { findExistingLnpDuplicate, type LnpImportedPlayer } from "@/utils/lnpTeamPlayers";

export type LnpMatchSquadSide = "host" | "guest";

export interface LnpMatchMinutePlayer {
  lnpId: string;
  firstName: string;
  lastName: string;
  number: number;
  isStarter: boolean;
  startMinute: number;
  endMinute: number;
  minutesPlayed: number;
}

export interface LnpMatchMinutesPayload {
  matchId: string;
  hostName: string;
  guestName: string;
  hostPlayers: LnpMatchMinutePlayer[];
  guestPlayers: LnpMatchMinutePlayer[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function readEvents(raw: unknown): Record<string, unknown> | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  if (asRecord(rec.host) || asRecord(rec.guest)) return rec;
  const nested = asRecord(rec.data) || asRecord(rec.events) || asRecord(rec.match);
  if (nested && (asRecord(nested.host) || asRecord(nested.guest))) return nested;
  return rec;
}

function readTeamName(side: unknown): string {
  const rec = asRecord(side);
  if (!rec) return "";
  const nestedTeam = asRecord(rec.team);
  return (
    readString(rec.name) ||
    readString(nestedTeam?.name) ||
    readString(rec.teamName) ||
    ""
  );
}

function readEventItems(value: unknown): RawEventItem[] {
  return asArray(value)
    .map((item) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const type = readString(rec.type);
      const minute = readString(rec.minute) || readString(rec.time);
      if (!type && !minute) return null;
      return { type: type || undefined, minute: minute || undefined };
    })
    .filter((item): item is RawEventItem => item != null);
}

function readSquadType(src: Record<string, unknown>, raw: Record<string, unknown>): string {
  const type = readString(src.type ?? raw.type);
  if (type) return type;
  if (src.isStarter === true || raw.isStarter === true || src.starter === true || raw.starter === true) {
    return "Starter";
  }
  return "Substitute";
}

function mapRawSquadPlayer(rawUnknown: unknown, index: number): RawSquadPlayer | null {
  const raw = asRecord(rawUnknown);
  if (!raw) return null;
  const nested = asRecord(raw.player);
  const src = nested ?? raw;
  const firstname = readString(src.firstname ?? src.firstName ?? raw.firstname ?? raw.firstName);
  const lastname = readString(src.lastname ?? src.lastName ?? raw.lastname ?? raw.lastName);
  if (!firstname && !lastname) return null;
  const id =
    readString(src.id ?? raw.id ?? src.playerId ?? raw.playerId) ||
    `${normalizeName(firstname)}-${normalizeName(lastname)}-${index}`;
  const number = readNumber(src.number ?? raw.number);
  return {
    id,
    firstname,
    lastname,
    number,
    isKeeper: Boolean(src.isKeeper ?? raw.isKeeper),
    type: readSquadType(src, raw),
    goals: readEventItems(src.goals ?? raw.goals),
    cards: readEventItems(src.cards ?? raw.cards),
    substitutions: readEventItems(src.substitutions ?? raw.substitutions),
  };
}

function readSquad(side: unknown): RawSquadPlayer[] {
  const rec = asRecord(side);
  if (!rec) return [];
  const candidates = [rec.squad, rec.players, rec.members];
  for (const candidate of candidates) {
    const mapped = asArray(candidate)
      .map((item, index) => mapRawSquadPlayer(item, index))
      .filter((p): p is RawSquadPlayer => p != null);
    if (mapped.length > 0) return mapped;
  }
  return [];
}

export function toLnpMatchMinutePlayer(p: RawSquadPlayer): LnpMatchMinutePlayer {
  const interval = computePlayerPlayInterval(p);
  return {
    lnpId: p.id,
    firstName: p.firstname || "",
    lastName: p.lastname || "",
    number: p.number ?? 0,
    isStarter: interval.isStarter,
    startMinute: interval.startMinute,
    endMinute: interval.endMinute,
    minutesPlayed: interval.minutesPlayed,
  };
}

export function extractLnpMatchMinutes(
  events: unknown,
  matchMeta: unknown,
  matchId: string
): LnpMatchMinutesPayload {
  const eventsRec = readEvents(events);
  const meta = asRecord(matchMeta);
  const hostSide = eventsRec?.host ?? meta?.host ?? meta?.hostTeam ?? meta?.home;
  const guestSide = eventsRec?.guest ?? meta?.guest ?? meta?.guestTeam ?? meta?.away;
  const hostName =
    readTeamName(hostSide) ||
    readTeamName(meta?.host) ||
    readTeamName(meta?.hostTeam) ||
    "Gospodarz";
  const guestName =
    readTeamName(guestSide) ||
    readTeamName(meta?.guest) ||
    readTeamName(meta?.guestTeam) ||
    "Gość";
  return {
    matchId,
    hostName,
    guestName,
    hostPlayers: readSquad(hostSide).map(toLnpMatchMinutePlayer),
    guestPlayers: readSquad(guestSide).map(toLnpMatchMinutePlayer),
  };
}

function toImported(player: LnpMatchMinutePlayer): LnpImportedPlayer {
  return {
    lnpId: player.lnpId,
    firstName: player.firstName,
    lastName: player.lastName,
    number: player.number,
    position: "",
    isKeeper: false,
  };
}

export function countLnpSquadRosterMatches(
  lnpPlayers: LnpMatchMinutePlayer[],
  ourPlayers: Player[]
): number {
  return lnpPlayers.filter((p) => findExistingLnpDuplicate(toImported(p), ourPlayers)).length;
}

/** Wybiera stronę meczu ŁNP odpowiadającą naszej kadrze. */
export function pickLnpMatchSquadSide(
  payload: Pick<LnpMatchMinutesPayload, "hostName" | "guestName" | "hostPlayers" | "guestPlayers">,
  ourPlayers: Player[],
  hint?: { isHome?: boolean; opponent?: string }
): LnpMatchSquadSide {
  const opponent = hint?.opponent?.trim() || "";
  const opponentIsGuest = Boolean(opponent) && namesOverlap(opponent, payload.guestName) && !namesOverlap(opponent, payload.hostName);
  const opponentIsHost = Boolean(opponent) && namesOverlap(opponent, payload.hostName) && !namesOverlap(opponent, payload.guestName);
  if (opponentIsGuest) return "host";
  if (opponentIsHost) return "guest";

  const hostHits = countLnpSquadRosterMatches(payload.hostPlayers, ourPlayers);
  const guestHits = countLnpSquadRosterMatches(payload.guestPlayers, ourPlayers);
  if (hostHits > guestHits) return "host";
  if (guestHits > hostHits) return "guest";
  if (hint?.isHome === true) return "host";
  if (hint?.isHome === false) return "guest";
  return "host";
}

export function squadForSide(
  payload: Pick<LnpMatchMinutesPayload, "hostPlayers" | "guestPlayers">,
  side: LnpMatchSquadSide
): LnpMatchMinutePlayer[] {
  return side === "host" ? payload.hostPlayers : payload.guestPlayers;
}

export interface ApplyLnpMinutesResult {
  next: PlayerMinutes[];
  matched: number;
  unmatchedLnpNames: string[];
}

/** Nakłada minuty ze składu ŁNP na listę PlayerMinutes kadry LOOKBALL. */
export function applyLnpMinutesToRoster(
  rosterMinutes: PlayerMinutes[],
  ourPlayers: Player[],
  lnpPlayers: LnpMatchMinutePlayer[]
): ApplyLnpMinutesResult {
  const byPlayerId = new Map(rosterMinutes.map((pm) => [pm.playerId, { ...pm }]));
  const usedLocalIds = new Set<string>();
  const unmatchedLnpNames: string[] = [];
  let matched = 0;

  for (const lnp of lnpPlayers) {
    const local = findExistingLnpDuplicate(toImported(lnp), ourPlayers);
    if (!local || usedLocalIds.has(local.id)) {
      const name = `${lnp.firstName} ${lnp.lastName}`.trim();
      if (name) unmatchedLnpNames.push(name);
      continue;
    }
    usedLocalIds.add(local.id);
    matched += 1;
    const prev = byPlayerId.get(local.id);
    byPlayerId.set(local.id, {
      playerId: local.id,
      startMinute: lnp.startMinute,
      endMinute: lnp.endMinute,
      position: prev?.position || local.position || "",
      status: "dostepny",
    });
  }

  const next = rosterMinutes.map((pm) => byPlayerId.get(pm.playerId) ?? pm);
  for (const [id, pm] of byPlayerId) {
    if (!rosterMinutes.some((row) => row.playerId === id)) next.push(pm);
  }
  return { next, matched, unmatchedLnpNames };
}
