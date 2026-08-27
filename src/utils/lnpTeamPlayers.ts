// Mapowanie kadry drużyny z API ŁNP (teams/{id}/players) na zawodników LOOKBALL.

import type { Player } from "@/types";

export interface LnpImportedPlayer {
  lnpId: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  birthYear?: number;
  isKeeper: boolean;
}

const normalizeName = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

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

function readBirthYear(raw: Record<string, unknown>): number | undefined {
  const year = readNumber(raw.birthYear ?? raw.yearOfBirth ?? raw.birthyear);
  if (year != null && year >= 1950 && year <= 2020) return Math.floor(year);
  const age = readNumber(raw.age);
  if (age != null && age >= 10 && age <= 60) {
    return new Date().getFullYear() - Math.floor(age);
  }
  return undefined;
}

/** Pozycja LOOKBALL z pól ŁNP (isKeeper + opcjonalna nazwa pozycji). */
export function mapLnpPosition(raw: {
  isKeeper?: boolean;
  position?: string;
}): string {
  if (raw.isKeeper) return "GK";
  const p = normalizeName(raw.position || "");
  if (!p) return "";
  if (p.includes("bramkar") || p === "gk" || p === "goalkeeper") return "GK";
  if (p.includes("napast") || p.includes("forward") || p === "st" || p === "cf") return "ST";
  if (p.includes("skrzyd") && (p.includes("lew") || p.includes("left") || p === "lw")) return "LW";
  if (p.includes("skrzyd") && (p.includes("praw") || p.includes("right") || p === "rw")) return "RW";
  if (p === "lw" || p.includes("left wing")) return "LW";
  if (p === "rw" || p.includes("right wing")) return "RW";
  if (p.includes("ofensyw") || p === "am" || p === "cam") return "AM";
  if (p.includes("defensyw") || p === "dm" || p === "cdm") return "DM";
  if (p.includes("pomoc") || p === "cm" || p.includes("midfield")) return "AM";
  if (p.includes("obron") || p.includes("defend") || p === "cb") return "CB";
  return "";
}

function mapRawPlayer(rawUnknown: unknown): LnpImportedPlayer | null {
  const raw = asRecord(rawUnknown);
  if (!raw) return null;
  const nested = asRecord(raw.player);
  const src = nested ?? raw;
  const id = readString(src.id ?? raw.id ?? src.playerId ?? raw.playerId);
  const firstName = readString(src.firstname ?? src.firstName ?? raw.firstname ?? raw.firstName);
  const lastName = readString(src.lastname ?? src.lastName ?? raw.lastname ?? raw.lastName);
  if (!id && !firstName && !lastName) return null;
  if (!firstName && !lastName) return null;
  const isKeeper = Boolean(src.isKeeper ?? raw.isKeeper);
  const number = readNumber(src.number ?? raw.number) ?? 0;
  const position = mapLnpPosition({
    isKeeper,
    position: readString(src.position ?? raw.position ?? src.role ?? raw.role),
  });
  return {
    lnpId: id || `${normalizeName(firstName)}-${normalizeName(lastName)}-${number}`,
    firstName,
    lastName,
    number: number >= 0 ? Math.floor(number) : 0,
    position,
    birthYear: readBirthYear(src) ?? readBirthYear(raw),
    isKeeper,
  };
}

/** Wyciąga kadrę z odpowiedzi GET teams/{id}/players (tablica lub opakowany obiekt). */
export function extractLnpTeamPlayers(data: unknown): LnpImportedPlayer[] {
  const fromArray = asArray(data)
    .map(mapRawPlayer)
    .filter((p): p is LnpImportedPlayer => p != null);
  if (fromArray.length > 0) return dedupeImportedPlayers(fromArray);

  const rec = asRecord(data);
  if (!rec) return [];
  const nestedCandidates = [rec.players, rec.squad, rec.items, rec.data, rec.members];
  for (const candidate of nestedCandidates) {
    const mapped = asArray(candidate)
      .map(mapRawPlayer)
      .filter((p): p is LnpImportedPlayer => p != null);
    if (mapped.length > 0) return dedupeImportedPlayers(mapped);
  }
  return [];
}

function dedupeImportedPlayers(players: LnpImportedPlayer[]): LnpImportedPlayer[] {
  const seen = new Set<string>();
  const out: LnpImportedPlayer[] = [];
  for (const p of players) {
    const key = p.lnpId || `${normalizeName(p.firstName)}|${normalizeName(p.lastName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function existingFirstName(player: Player): string {
  if (player.firstName) return player.firstName;
  if (player.name) return player.name.trim().split(/\s+/)[0] || "";
  return "";
}

function existingLastName(player: Player): string {
  if (player.lastName) return player.lastName;
  if (player.name) {
    const words = player.name.trim().split(/\s+/);
    return words.length > 1 ? words.slice(1).join(" ") : "";
  }
  return "";
}

export function findExistingLnpDuplicate(
  player: LnpImportedPlayer,
  existing: Player[]
): Player | undefined {
  const first = normalizeName(player.firstName);
  const last = normalizeName(player.lastName);
  if (!first && !last) return undefined;
  return existing.find((p) => {
    const sameFirst = normalizeName(existingFirstName(p)) === first;
    const sameLast = normalizeName(existingLastName(p)) === last;
    if (!sameFirst || !sameLast) return false;
    if (player.birthYear && p.birthYear && player.birthYear !== p.birthYear) return false;
    return true;
  });
}

export function toNewPlayerPayload(
  player: LnpImportedPlayer,
  teamId: string
): Omit<Player, "id"> {
  const firstName = player.firstName.trim();
  const lastName = player.lastName.trim();
  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    number: player.number || 0,
    position: player.position || "",
    birthYear: player.birthYear,
    imageUrl: "",
    teams: teamId ? [teamId] : [],
    isTestPlayer: false,
  };
}
