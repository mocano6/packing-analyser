import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";
import type {
  LnpCachedMatchMinutes,
  LnpPlayerLoadMerge,
  LnpPlayerLoadState,
} from "@/types/lnpPlayerLoad";
import { extractLnpMatchMinutes, pickLnpMatchSquadSide, squadForSide } from "@/utils/lnpMatchMinutes";
import { isFixtureHomeForTeam, isFixtureInPast } from "@/utils/microcycleFixtures";

export interface PlayedMatchMinutesRequestItem {
  matchId: string;
  dateTime: string;
  opponent?: string;
  isHome?: boolean;
  playName?: string;
  scoreFinal?: string | null;
  hostId?: string;
  guestId?: string;
  hostName?: string;
  guestName?: string;
}

export const LOAD_WINDOW_3D_MS = 3 * 24 * 60 * 60 * 1000;
export const LOAD_WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;

/** Ile meczów bez cache pobieramy w jednym requestcie (reCAPTCHA + 120 s). */
export const LNP_MINUTES_FETCH_BATCH = 16;

const NO_DATA_STATE_RE = /walkower|wo\b|odwoł|odwol|cancelled|canceled|awarded/i;

/**
 * Mecz, z którego da się (albo warto spróbować) ściągnąć skład:
 * już się odbył i nie jest walkowerem / odwołany.
 */
export function isPlayedFixtureWithData(
  fixture: LaczyTeamFixture,
  now = new Date()
): boolean {
  if (!isFixtureInPast(fixture, now)) return false;
  const state = String(fixture.state ?? "");
  if (NO_DATA_STATE_RE.test(state)) return false;
  // Przeszłe mecze w cache często zostają jako „Planowany” bez wyniku —
  // i tak próbujemy skład; puste events = hasSquad: false.
  return true;
}

export function playedFixturesWithData(
  fixtures: LaczyTeamFixture[],
  now = new Date()
): LaczyTeamFixture[] {
  return fixtures
    .filter((f) => isPlayedFixtureWithData(f, now))
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export function fixturesMissingMinutes(
  fixtures: LaczyTeamFixture[],
  cached: LnpCachedMatchMinutes[],
  now = new Date()
): LaczyTeamFixture[] {
  const usable = new Set(
    cached.filter((m) => cachedMatchHasPlayerMinutes(m)).map((m) => m.matchId)
  );
  return playedFixturesWithData(fixtures, now).filter((f) => !usable.has(f.matchId));
}

/** Cache bez minut (pusta próba / zły skład) nie blokuje ponownego pobrania. */
export function cachedMatchHasPlayerMinutes(m: LnpCachedMatchMinutes): boolean {
  if (!m.hasSquad) return false;
  return m.players.some((p) => Number.isFinite(p.minutesPlayed) && p.minutesPlayed > 0);
}

/** Etykieta przycisku minut — nigdy „aktualne”, bo terminarz może być nieświeży. */
export function playerLoadMinutesButtonLabel(input: {
  fetching: boolean;
  missingCount: number;
  playedCount: number;
  batch?: number;
}): string {
  if (input.fetching) return "Pobieram…";
  const batch = input.batch ?? LNP_MINUTES_FETCH_BATCH;
  if (input.missingCount > 0) {
    return `Pobierz minuty (${Math.min(input.missingCount, batch)})`;
  }
  if (input.playedCount > 0) return "Sprawdź nowe mecze";
  return "Pobierz minuty";
}

export function mergeCachedMatchMinutes(
  existing: LnpCachedMatchMinutes[],
  incoming: LnpCachedMatchMinutes[]
): LnpCachedMatchMinutes[] {
  const byId = new Map<string, LnpCachedMatchMinutes>();
  for (const m of existing) {
    if (m.matchId) byId.set(m.matchId, m);
  }
  for (const m of incoming) {
    if (m.matchId) byId.set(m.matchId, m);
  }
  return [...byId.values()].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export interface LnpPlayerLoadRow {
  key: string;
  lnpId: string;
  firstName: string;
  lastName: string;
  number: number;
  totalMinutes: number;
  last7Days: number;
  last3Days: number;
  matchesPlayed: number;
  matchesLast7: number;
  matchesLast3: number;
}

function normalizePersonName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const LNP_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Klucz po ID ŁNP, potem po nazwisku. */
export function playerLoadRowKey(p: {
  lnpId: string;
  firstName: string;
  lastName: string;
  number: number;
}): string {
  const id = String(p.lnpId ?? "").trim();
  if (id) return `id:${id}`;
  const last = normalizePersonName(p.lastName);
  const first = normalizePersonName(p.firstName);
  if (last || first) return `name:${last}|${first}`;
  return `num:${p.number}`;
}

/** Tożsamość do auto-scalenia PDF vs ŁNP (to samo imię i nazwisko). */
export function playerLoadNameKey(p: { firstName: string; lastName: string }): string {
  const last = normalizePersonName(p.lastName);
  const first = normalizePersonName(p.firstName);
  if (!last && !first) return "";
  return `${last}|${first}`;
}

function isLnpUuid(id: string): boolean {
  return LNP_UUID_RE.test(String(id ?? "").trim());
}

function nameLooksAllCaps(row: Pick<LnpPlayerLoadRow, "firstName" | "lastName">): boolean {
  const n = `${row.firstName} ${row.lastName}`.trim();
  return n.length > 0 && n === n.toUpperCase() && n !== n.toLowerCase();
}

function pickCanonicalPlayerLoadRow(rows: LnpPlayerLoadRow[]): LnpPlayerLoadRow {
  return [...rows].sort((a, b) => {
    const aUuid = isLnpUuid(a.lnpId) ? 1 : 0;
    const bUuid = isLnpUuid(b.lnpId) ? 1 : 0;
    if (aUuid !== bUuid) return bUuid - aUuid;
    const aId = a.lnpId.trim() ? 1 : 0;
    const bId = b.lnpId.trim() ? 1 : 0;
    if (aId !== bId) return bId - aId;
    const aCaps = nameLooksAllCaps(a) ? 0 : 1;
    const bCaps = nameLooksAllCaps(b) ? 0 : 1;
    if (aCaps !== bCaps) return bCaps - aCaps;
    if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
    return a.key.localeCompare(b.key);
  })[0];
}

/** PDF bez UUID i ŁNP z UUID to często ten sam zawodnik — łączymy po nazwisku. */
export function autoPlayerLoadMerges(rows: LnpPlayerLoadRow[]): LnpPlayerLoadMerge[] {
  const byName = new Map<string, LnpPlayerLoadRow[]>();
  for (const row of rows) {
    const nk = playerLoadNameKey(row);
    if (!nk) continue;
    const list = byName.get(nk) ?? [];
    list.push(row);
    byName.set(nk, list);
  }
  const merges: LnpPlayerLoadMerge[] = [];
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const canon = pickCanonicalPlayerLoadRow(group);
    for (const row of group) {
      if (row.key === canon.key) continue;
      merges.push({ sourceKey: row.key, targetKey: canon.key });
    }
  }
  return merges;
}

/** Auto-scalenia + ręczne (ręczne nadpisują). */
export function effectivePlayerLoadMerges(
  rows: LnpPlayerLoadRow[],
  manual: LnpPlayerLoadMerge[] = []
): LnpPlayerLoadMerge[] {
  const map = new Map<string, string>();
  for (const m of autoPlayerLoadMerges(rows)) {
    if (m.sourceKey && m.targetKey && m.sourceKey !== m.targetKey) {
      map.set(m.sourceKey, m.targetKey);
    }
  }
  for (const m of manual) {
    const source = String(m.sourceKey ?? "").trim();
    const target = String(m.targetKey ?? "").trim();
    if (!source || !target || source === target) continue;
    map.set(source, target);
  }
  return [...map.entries()].map(([sourceKey, targetKey]) => ({ sourceKey, targetKey }));
}

function displayName(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`.trim();
}

export function isMatchInWindow(dateTime: string, windowMs: number, now: Date): boolean {
  const t = new Date(dateTime).getTime();
  if (!Number.isFinite(t)) return false;
  const nowMs = now.getTime();
  return t <= nowMs && nowMs - t <= windowMs;
}

export function aggregatePlayerLoadMinutes(
  matches: LnpCachedMatchMinutes[],
  now = new Date()
): LnpPlayerLoadRow[] {
  const map = new Map<string, LnpPlayerLoadRow>();

  for (const match of matches) {
    if (!match.hasSquad) continue;
    const in7 = isMatchInWindow(match.dateTime, LOAD_WINDOW_7D_MS, now);
    const in3 = isMatchInWindow(match.dateTime, LOAD_WINDOW_3D_MS, now);

    for (const p of match.players) {
      const mins = Number.isFinite(p.minutesPlayed) ? Math.max(0, Math.round(p.minutesPlayed)) : 0;
      if (mins <= 0) continue;
      const key = playerLoadRowKey(p);
      const row =
        map.get(key) ??
        {
          key,
          lnpId: p.lnpId,
          firstName: p.firstName,
          lastName: p.lastName,
          number: p.number,
          totalMinutes: 0,
          last7Days: 0,
          last3Days: 0,
          matchesPlayed: 0,
          matchesLast7: 0,
          matchesLast3: 0,
        };
      row.totalMinutes += mins;
      row.matchesPlayed += 1;
      if (in7) {
        row.last7Days += mins;
        row.matchesLast7 += 1;
      }
      if (in3) {
        row.last3Days += mins;
        row.matchesLast3 += 1;
      }
      if (!row.lnpId && p.lnpId) row.lnpId = p.lnpId;
      if (!row.lastName) {
        row.lastName = p.lastName;
        row.firstName = p.firstName;
      }
      if (!row.number && p.number) row.number = p.number;
      map.set(key, row);
    }
  }

  return [...map.values()].sort((a, b) => comparePlayerLoadRows(a, b, DEFAULT_PLAYER_LOAD_SORT));
}

export function resolvePlayerLoadMergeTarget(key: string, merges: LnpPlayerLoadMerge[]): string {
  const map = new Map<string, string>();
  for (const m of merges) {
    const source = String(m.sourceKey ?? "").trim();
    const target = String(m.targetKey ?? "").trim();
    if (!source || !target || source === target) continue;
    map.set(source, target);
  }
  const seen = new Set<string>();
  let cur = key;
  while (map.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = map.get(cur) as string;
  }
  return cur;
}

function sumLoadRows(identity: LnpPlayerLoadRow, parts: LnpPlayerLoadRow[]): LnpPlayerLoadRow {
  const out: LnpPlayerLoadRow = {
    ...identity,
    totalMinutes: 0,
    last7Days: 0,
    last3Days: 0,
    matchesPlayed: 0,
    matchesLast7: 0,
    matchesLast3: 0,
  };
  for (const r of parts) {
    out.totalMinutes += r.totalMinutes;
    out.last7Days += r.last7Days;
    out.last3Days += r.last3Days;
    out.matchesPlayed += r.matchesPlayed;
    out.matchesLast7 += r.matchesLast7;
    out.matchesLast3 += r.matchesLast3;
    if (!out.lnpId && r.lnpId) out.lnpId = r.lnpId;
  }
  return out;
}

/** Scalenia (auto po nazwisku + ręczne) i ukrycia. */
export function applyPlayerLoadRosterEdits(
  rows: LnpPlayerLoadRow[],
  hiddenPlayerKeys: string[] = [],
  playerMerges: LnpPlayerLoadMerge[] = []
): LnpPlayerLoadRow[] {
  const merges = effectivePlayerLoadMerges(rows, playerMerges);
  const hidden = new Set(hiddenPlayerKeys.map((k) => String(k).trim()).filter(Boolean));
  const groups = new Map<string, LnpPlayerLoadRow[]>();
  for (const row of rows) {
    const canon = resolvePlayerLoadMergeTarget(row.key, merges);
    const list = groups.get(canon) ?? [];
    list.push(row);
    groups.set(canon, list);
  }
  const out: LnpPlayerLoadRow[] = [];
  for (const [canon, parts] of groups) {
    if (hidden.has(canon)) continue;
    const identity = parts.find((r) => r.key === canon) ?? parts[0];
    out.push(sumLoadRows({ ...identity, key: canon }, parts));
  }
  return out;
}

export function addPlayerLoadMerge(
  merges: LnpPlayerLoadMerge[],
  sourceKey: string,
  targetKey: string
): LnpPlayerLoadMerge[] {
  const source = String(sourceKey ?? "").trim();
  const target = String(targetKey ?? "").trim();
  if (!source || !target || source === target) return merges;
  const next = merges.filter((m) => m.sourceKey !== source && !(m.sourceKey === target && m.targetKey === source));
  return [...next, { sourceKey: source, targetKey: target }];
}

export function removePlayerLoadMerge(merges: LnpPlayerLoadMerge[], sourceKey: string): LnpPlayerLoadMerge[] {
  const source = String(sourceKey ?? "").trim();
  return merges.filter((m) => m.sourceKey !== source);
}

export function hidePlayerLoadKey(hidden: string[], key: string): string[] {
  const k = String(key ?? "").trim();
  if (!k || hidden.includes(k)) return hidden;
  return [...hidden, k];
}

export function restorePlayerLoadKey(hidden: string[], key: string): string[] {
  const k = String(key ?? "").trim();
  return hidden.filter((x) => x !== k);
}

export type PlayerLoadSortKey = "name" | "number" | "matches" | "total" | "last7" | "last3";
export type PlayerLoadSortDir = "asc" | "desc";

export interface PlayerLoadSort {
  key: PlayerLoadSortKey;
  dir: PlayerLoadSortDir;
}

/** Domyślnie: najwięcej minut w 7 dniach (kontrola obciążeń). */
export const DEFAULT_PLAYER_LOAD_SORT: PlayerLoadSort = { key: "last7", dir: "desc" };

const NUMERIC_SORT_KEYS: ReadonlySet<PlayerLoadSortKey> = new Set([
  "number",
  "matches",
  "total",
  "last7",
  "last3",
]);

export function defaultDirForPlayerLoadSortKey(key: PlayerLoadSortKey): PlayerLoadSortDir {
  return key === "name" || key === "number" ? "asc" : "desc";
}

export function nextPlayerLoadSort(current: PlayerLoadSort, clicked: PlayerLoadSortKey): PlayerLoadSort {
  if (current.key === clicked) {
    return { key: clicked, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key: clicked, dir: defaultDirForPlayerLoadSortKey(clicked) };
}

function numericSortValue(row: LnpPlayerLoadRow, key: PlayerLoadSortKey): number {
  switch (key) {
    case "number":
      return row.number || 0;
    case "matches":
      return row.matchesPlayed;
    case "total":
      return row.totalMinutes;
    case "last7":
      return row.last7Days;
    case "last3":
      return row.last3Days;
    default:
      return 0;
  }
}

function comparePlayerLoadRows(a: LnpPlayerLoadRow, b: LnpPlayerLoadRow, sort: PlayerLoadSort): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "name") {
    const byName = formatPlayerLoadName(a).localeCompare(formatPlayerLoadName(b), "pl", {
      sensitivity: "base",
    });
    if (byName !== 0) return byName * dir;
  } else if (NUMERIC_SORT_KEYS.has(sort.key)) {
    const diff = numericSortValue(a, sort.key) - numericSortValue(b, sort.key);
    if (diff !== 0) return diff * dir;
  }
  const byName = formatPlayerLoadName(a).localeCompare(formatPlayerLoadName(b), "pl", {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;
  return (a.number || 0) - (b.number || 0);
}

export function sortPlayerLoadRows(rows: LnpPlayerLoadRow[], sort: PlayerLoadSort): LnpPlayerLoadRow[] {
  return [...rows].sort((a, b) => comparePlayerLoadRows(a, b, sort));
}

export type LoadBand = "ok" | "watch" | "high";

/** Progi kontroli: 3 dni ≥ 90′ albo 7 dni ≥ 180′ = wysokie; połowa tego = obserwacja. */
export function loadBandForRow(row: Pick<LnpPlayerLoadRow, "last3Days" | "last7Days">): LoadBand {
  if (row.last3Days >= 90 || row.last7Days >= 180) return "high";
  if (row.last3Days >= 45 || row.last7Days >= 90) return "watch";
  return "ok";
}

export function formatPlayerLoadName(row: Pick<LnpPlayerLoadRow, "firstName" | "lastName">): string {
  return displayName(row.firstName, row.lastName);
}

/** Klucze wiersza i wszystkich źródeł scalonych do niego. */
export function playerLoadKeysForRow(playerKey: string, merges: LnpPlayerLoadMerge[] = []): Set<string> {
  const keys = new Set<string>([playerKey]);
  for (const m of merges) {
    const source = String(m.sourceKey ?? "").trim();
    if (!source) continue;
    if (resolvePlayerLoadMergeTarget(source, merges) === playerKey) keys.add(source);
  }
  return keys;
}

export interface PlayerLoadMatchAppearance {
  matchId: string;
  dateTime: string;
  opponent: string;
  isHome: boolean;
  scoreFinal: string | null;
  playName: string;
  minutesPlayed: number;
}

/** Mecze zawodnika z minutami — nowsze na górze. Scalenia łączą minuty z obu wierszy. */
export function playerLoadMatchAppearances(
  matches: LnpCachedMatchMinutes[],
  playerKey: string,
  playerMerges: LnpPlayerLoadMerge[] = []
): PlayerLoadMatchAppearance[] {
  const keys = playerLoadKeysForRow(playerKey, playerMerges);
  const out: PlayerLoadMatchAppearance[] = [];
  for (const match of matches) {
    if (!match.hasSquad) continue;
    let minutesPlayed = 0;
    for (const p of match.players) {
      if (!keys.has(playerLoadRowKey(p))) continue;
      const mins = Number.isFinite(p.minutesPlayed) ? Math.max(0, Math.round(p.minutesPlayed)) : 0;
      minutesPlayed += mins;
    }
    if (minutesPlayed <= 0) continue;
    out.push({
      matchId: match.matchId,
      dateTime: match.dateTime,
      opponent: match.opponent || "Rywal",
      isHome: match.isHome,
      scoreFinal: match.scoreFinal ?? null,
      playName: match.playName || "",
      minutesPlayed,
    });
  }
  return out.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export function opponentFromFixture(fixture: LaczyTeamFixture, ourTeamId: string): string {
  return isFixtureHomeForTeam(fixture, ourTeamId) ? fixture.guestName : fixture.hostName;
}

function toFixtureHint(item: PlayedMatchMinutesRequestItem, teamId: string): LaczyTeamFixture {
  return {
    matchId: item.matchId,
    dateTime: item.dateTime,
    state: "",
    playId: "",
    playName: item.playName ?? "",
    hostId: item.hostId ?? (item.isHome ? teamId : ""),
    hostName: item.hostName ?? "",
    guestId: item.guestId ?? (item.isHome === false ? teamId : ""),
    guestName: item.guestName ?? "",
    scoreFinal: item.scoreFinal ?? null,
  };
}

/** Skład naszej drużyny z events ŁNP → wpis cache. */
export function requestItemToCached(
  item: PlayedMatchMinutesRequestItem,
  teamId: string,
  events: unknown,
  fetchedAt: string
): LnpCachedMatchMinutes {
  const hint = toFixtureHint(item, teamId);
  const isHomeHint = item.isHome ?? (item.hostId ? isFixtureHomeForTeam(hint, teamId) : true);
  const payload = extractLnpMatchMinutes(events, null, item.matchId);
  const side = pickLnpMatchSquadSide(payload, [], {
    isHome: isHomeHint,
    opponent: item.opponent,
  });
  const isHome = side === "host";
  const squad = squadForSide(payload, side);
  const players = squad
    .filter((p) => p.minutesPlayed > 0)
    .map((p) => ({
      lnpId: p.lnpId,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
      minutesPlayed: p.minutesPlayed,
    }));
  return {
    matchId: item.matchId,
    dateTime: item.dateTime,
    opponent: item.opponent?.trim() || opponentFromFixture(hint, teamId),
    isHome,
    playName: item.playName ?? "",
    scoreFinal: item.scoreFinal ?? null,
    fetchedAt,
    hasSquad: players.length > 0 || squad.length > 0,
    players,
  };
}

export function summarizeLoadState(
  state: LnpPlayerLoadState,
  fixtures: LaczyTeamFixture[],
  now = new Date()
): {
  withSquad: number;
  withoutSquad: number;
  missing: number;
  played: number;
} {
  const played = playedFixturesWithData(fixtures, now);
  const usableIds = new Set(
    state.matches.filter((m) => cachedMatchHasPlayerMinutes(m)).map((m) => m.matchId)
  );
  return {
    withSquad: state.matches.filter((m) => m.hasSquad).length,
    withoutSquad: state.matches.filter((m) => !m.hasSquad).length,
    missing: played.filter((f) => !usableIds.has(f.matchId)).length,
    played: played.length,
  };
}
