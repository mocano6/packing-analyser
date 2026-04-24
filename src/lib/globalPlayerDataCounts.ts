/**
 * Agregacja liczników powiązań zawodnika z danymi we wszystkich dokumentach meczów
 * oraz (osobno) w kolekcji gps — do widoku duplikatów / decyzji o scalaniu.
 */

import type {
  Acc8sEntry,
  Action,
  GPSDataEntry,
  PKEntry,
  PlayerMatchStats,
  PlayerMinutes,
  Shot,
} from "@/types";
import {
  MATCH_ACTION_ARRAY_KEYS,
  type MatchActionArrayKey,
} from "./duplicatePlayerMergeRewrite";
import { inferMatchArrayFieldForAction } from "./inferActionMatchField";
import {
  getActionReceiverIdFromRaw,
  getActionSenderIdFromRaw,
  normalizeFirestorePlayerId,
} from "./matchActionPlayerIds";

export type GlobalPlayerDataCounts = {
  actionsPacking: number;
  actionsUnpacking: number;
  actionsRegain: number;
  actionsLoses: number;
  /**
   * Liczba wierszy zdarzeń we wszystkich meczach, w których zawodnik brał udział
   * (4 tablice akcji: nadawca/odbiorca/obrona; strzały; PK; ACC8s) — max. 1 na wiersz.
   */
  matchEventsParticipated: number;
  /** Wystąpienia w defensePlayers we wszystkich typach akcji */
  actionsAsDefense: number;
  shotsAsShooter: number;
  shotsAsAssistant: number;
  shotsBlocking: number;
  shotsLine: number;
  pkAsSender: number;
  pkAsReceiver: number;
  /** Liczba wpisów ACC8s, w których zawodnik jest w passingPlayerIds */
  acc8sParticipations: number;
  playerMinutesRows: number;
  /**
   * Suma rozegranych minut: po każdym wierszu playerMinutes dodajemy max(0, endMinute − startMinute).
   * Zgodne z kolumną „Min Σ” w tabeli per mecz.
   */
  playerMinutesPlayedSum: number;
  /** Wiersze gpsData zagnieżdżone w dokumencie meczu */
  gpsRowsInMatchDoc: number;
  /** Wiersze playerStats w matchData dokumentu meczu */
  matchStatsRows: number;
  /** Dokumenty w kolekcji Firestore `gps` z tym playerId */
  gpsCollectionDocs: number;
};

const FIELD_TO_COUNT: Record<MatchActionArrayKey, keyof GlobalPlayerDataCounts> = {
  actions_packing: "actionsPacking",
  actions_unpacking: "actionsUnpacking",
  actions_regain: "actionsRegain",
  actions_loses: "actionsLoses",
};

export type ActionBucketDerived = Pick<
  GlobalPlayerDataCounts,
  "actionsPacking" | "actionsUnpacking" | "actionsRegain" | "actionsLoses"
>;

const ZERO_ACTION_BUCKETS: ActionBucketDerived = {
  actionsPacking: 0,
  actionsUnpacking: 0,
  actionsRegain: 0,
  actionsLoses: 0,
};

/**
 * Jednoprzebiegowo: jak accumulateMatchDocumentIntoGlobalCounts — osobno nadawca i odbiorca
 * (ten sam wpis liczy się dla obu stron akcji).
 */
export function buildDerivedActionBucketsByPlayerId(actions: Action[]): Map<string, ActionBucketDerived> {
  const m = new Map<string, ActionBucketDerived>();
  const ensure = (id: string): ActionBucketDerived => {
    let e = m.get(id);
    if (!e) {
      e = { ...ZERO_ACTION_BUCKETS };
      m.set(id, e);
    }
    return e;
  };
  const bump = (pid: unknown, src: Action["sourceMatchArray"] | undefined) => {
    const k = normalizeFirestorePlayerId(pid);
    if (!k) return;
    switch (src) {
      case "actions_packing":
        ensure(k).actionsPacking++;
        break;
      case "actions_unpacking":
        ensure(k).actionsUnpacking++;
        break;
      case "actions_regain":
        ensure(k).actionsRegain++;
        break;
      case "actions_loses":
        ensure(k).actionsLoses++;
        break;
      default:
        break;
    }
  };
  for (const a of actions) {
    const src = (a.sourceMatchArray ?? inferMatchArrayFieldForAction(a)) as Action["sourceMatchArray"];
    bump(a.senderId, src);
    bump(a.receiverId, src);
  }
  return m;
}

/**
 * Z zebranych akcji (4 tablice): +1 na wiersz dla każdego zawodnika w roli nadawcy,
 * odbiorcy lub obrony — uzupełnienie przy rozjazdach z agregacją dokumentów.
 */
export function buildDerivedMatchEventParticipationsByPlayerId(actions: Action[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of actions) {
    const ids = new Set<string>();
    const put = (x: unknown) => {
      const k = normalizeFirestorePlayerId(x);
      if (k) ids.add(k);
    };
    put(a.senderId);
    put(a.receiverId);
    for (const d of a.defensePlayers ?? []) put(d);
    for (const k of ids) {
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return m;
}

/** Liczniki z zebranych Action dla jednego playerId (testy / małe zbiory). */
export function deriveActionBucketCountsFromAllActions(playerId: string, actions: Action[]): ActionBucketDerived {
  const k = normalizeFirestorePlayerId(playerId);
  if (!k) return { ...ZERO_ACTION_BUCKETS };
  return buildDerivedActionBucketsByPlayerId(actions).get(k) ?? { ...ZERO_ACTION_BUCKETS };
}

/** Gdy agregacja z dokumentów i mapa się rozjeżdża, bierzemy max. */
export function mergeGlobalCountsWithDerivedActionBuckets(
  base: GlobalPlayerDataCounts,
  derived: ActionBucketDerived | undefined,
  derivedMatchEventsParticipated?: number,
): GlobalPlayerDataCounts {
  if (!derived && derivedMatchEventsParticipated === undefined) return base;
  return {
    ...base,
    ...(derived
      ? {
          actionsPacking: Math.max(base.actionsPacking, derived.actionsPacking),
          actionsUnpacking: Math.max(base.actionsUnpacking, derived.actionsUnpacking),
          actionsRegain: Math.max(base.actionsRegain, derived.actionsRegain),
          actionsLoses: Math.max(base.actionsLoses, derived.actionsLoses),
        }
      : {}),
    matchEventsParticipated:
      derivedMatchEventsParticipated === undefined
        ? base.matchEventsParticipated
        : Math.max(base.matchEventsParticipated, derivedMatchEventsParticipated),
  };
}

export function createEmptyGlobalPlayerDataCounts(): GlobalPlayerDataCounts {
  return {
    actionsPacking: 0,
    actionsUnpacking: 0,
    actionsRegain: 0,
    actionsLoses: 0,
    matchEventsParticipated: 0,
    actionsAsDefense: 0,
    shotsAsShooter: 0,
    shotsAsAssistant: 0,
    shotsBlocking: 0,
    shotsLine: 0,
    pkAsSender: 0,
    pkAsReceiver: 0,
    acc8sParticipations: 0,
    playerMinutesRows: 0,
    playerMinutesPlayedSum: 0,
    gpsRowsInMatchDoc: 0,
    matchStatsRows: 0,
    gpsCollectionDocs: 0,
  };
}

function ensureEntry(map: Map<string, GlobalPlayerDataCounts>, id: string): GlobalPlayerDataCounts {
  let e = map.get(id);
  if (!e) {
    e = createEmptyGlobalPlayerDataCounts();
    map.set(id, e);
  }
  return e;
}

function bump(
  map: Map<string, GlobalPlayerDataCounts>,
  id: unknown,
  field: keyof GlobalPlayerDataCounts,
  delta = 1,
): void {
  const key = normalizeFirestorePlayerId(id);
  if (!key) return;
  const e = ensureEntry(map, key);
  e[field] += delta;
}

/**
 * Pojedynczy dokument z kolekcji root `actions_packing` (legacy) — tylko liczniki packing / obrona.
 */
export function bumpGlobalMapFromLegacyPackingDoc(
  map: Map<string, GlobalPlayerDataCounts>,
  raw: Record<string, unknown>,
): void {
  const sid = getActionSenderIdFromRaw(raw);
  const rid = getActionReceiverIdFromRaw(raw);
  if (sid) bump(map, sid, "actionsPacking");
  if (rid) bump(map, rid, "actionsPacking");
  const defensePlayers = raw.defensePlayers;
  if (Array.isArray(defensePlayers)) {
    for (const did of defensePlayers) {
      if (typeof did === "string") bump(map, did, "actionsAsDefense");
    }
  }
  const eventIds = new Set<string>();
  const addEvent = (x: unknown) => {
    const k = normalizeFirestorePlayerId(x);
    if (k) eventIds.add(k);
  };
  addEvent(sid);
  addEvent(rid);
  if (Array.isArray(defensePlayers)) {
    for (const did of defensePlayers) addEvent(did);
  }
  for (const k of eventIds) {
    bump(map, k, "matchEventsParticipated");
  }
}

const NESTED_MERGE_ARRAY_KEYS = [
  ...MATCH_ACTION_ARRAY_KEYS,
  "shots",
  "pkEntries",
  "acc8sEntries",
  "playerMinutes",
  "gpsData",
] as const;

/**
 * Rzadkie importy zapisują `matchData` jako string JSON zamiast mapy — bez parsowania agregacja widzi pustkę.
 */
export function coerceMatchDocumentForAggregation(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };
  const md = next.matchData;
  if (typeof md === "string") {
    const t = md.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          next.matchData = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return next;
}

/**
 * Starsze / importowane dokumenty meczu czasem trzymają tablice (strzały, PK, 4×akcje) wyłącznie
 * w zagnieżdżonym `matchData`, a główny poziom jest pusty — wtedy agregacja ∑ widziała 0.
 * Czasem tablice są w `matchData.matchData` (podwójne zagnieżdżenie).
 */
export function mergeNestedMatchArraysIntoRootForAggregation(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const coerced = coerceMatchDocumentForAggregation(raw);
  const out: Record<string, unknown> = { ...coerced };
  const nestedLayers: Record<string, unknown>[] = [];
  let cur: unknown = coerced.matchData;
  let depth = 0;
  while (cur && typeof cur === "object" && !Array.isArray(cur) && depth < 6) {
    nestedLayers.push(cur as Record<string, unknown>);
    cur = (cur as Record<string, unknown>).matchData;
    depth++;
  }
  if (nestedLayers.length === 0) {
    return out;
  }
  for (const key of NESTED_MERGE_ARRAY_KEYS) {
    const top = out[key];
    const topLen = Array.isArray(top) ? top.length : 0;
    if (topLen > 0) continue;
    for (const n of nestedLayers) {
      const inner = n[key];
      const innerLen = Array.isArray(inner) ? inner.length : 0;
      if (innerLen > 0) {
        out[key] = inner;
        break;
      }
    }
  }
  return out;
}

/**
 * Odczyt liczników dla zawodnika — bezpośrednio po znormalizowanym id oraz skan po kluczach
 * (np. `players/xyz` vs `xyz`, różnice w wielkości liter w starych danych).
 */
export function lookupGlobalPlayerDataCounts(
  record: Record<string, GlobalPlayerDataCounts>,
  playerId: string,
): GlobalPlayerDataCounts {
  const pk = normalizeFirestorePlayerId(playerId) ?? playerId;
  for (const k of [pk, playerId]) {
    const row = record[k];
    if (row) return row;
  }
  const pkLower = pk.toLowerCase();
  for (const [k, v] of Object.entries(record)) {
    const nk = normalizeFirestorePlayerId(k) ?? k;
    if (nk === pk) return v;
    if (nk.toLowerCase() === pkLower) return v;
  }
  return createEmptyGlobalPlayerDataCounts();
}

/**
 * Zlicza powiązania z jednego dokumentu matches/{id} (bez kolekcji gps).
 */
export function accumulateMatchDocumentIntoGlobalCounts(
  raw: Record<string, unknown>,
  map: Map<string, GlobalPlayerDataCounts>,
): void {
  const matchData = mergeNestedMatchArraysIntoRootForAggregation(raw);
  for (const field of MATCH_ACTION_ARRAY_KEYS) {
    const arr = matchData[field];
    if (!Array.isArray(arr)) continue;
    const countKey = FIELD_TO_COUNT[field];
    for (const actionEl of arr) {
      const row = actionEl as Record<string, unknown>;
      const sid = getActionSenderIdFromRaw(actionEl);
      const rid = getActionReceiverIdFromRaw(actionEl);
      if (sid) bump(map, sid, countKey);
      if (rid) bump(map, rid, countKey);
      const defensePlayers = row.defensePlayers;
      if (Array.isArray(defensePlayers)) {
        for (const did of defensePlayers) {
          if (typeof did === "string") bump(map, did, "actionsAsDefense");
        }
      }
      const eventIds = new Set<string>();
      const addEv = (x: unknown) => {
        const k = normalizeFirestorePlayerId(x);
        if (k) eventIds.add(k);
      };
      addEv(sid);
      addEv(rid);
      if (Array.isArray(defensePlayers)) {
        for (const did of defensePlayers) addEv(did);
      }
      for (const k of eventIds) {
        bump(map, k, "matchEventsParticipated");
      }
    }
  }

  const shots = matchData.shots;
  if (Array.isArray(shots)) {
    for (const raw of shots) {
      const s = raw as Shot & { shooterId?: string; player_id?: string };
      const shooterId = s.playerId ?? s.shooterId ?? s.player_id;
      bump(map, shooterId, "shotsAsShooter");
      bump(map, s.assistantId, "shotsAsAssistant");
      for (const id of s.blockingPlayers ?? []) {
        bump(map, id, "shotsBlocking");
      }
      for (const id of s.linePlayers ?? []) {
        bump(map, id, "shotsLine");
      }
      const shotEventIds = new Set<string>();
      const addShotEv = (x: unknown) => {
        const k = normalizeFirestorePlayerId(x);
        if (k) shotEventIds.add(k);
      };
      addShotEv(shooterId);
      addShotEv(s.assistantId);
      for (const id of s.blockingPlayers ?? []) addShotEv(id);
      for (const id of s.linePlayers ?? []) addShotEv(id);
      for (const k of shotEventIds) {
        bump(map, k, "matchEventsParticipated");
      }
    }
  }

  const pkEntries = matchData.pkEntries;
  if (Array.isArray(pkEntries)) {
    for (const raw of pkEntries) {
      const e = raw as PKEntry;
      bump(map, e.senderId, "pkAsSender");
      bump(map, e.receiverId, "pkAsReceiver");
      const pkEv = new Set<string>();
      const addPk = (x: unknown) => {
        const k = normalizeFirestorePlayerId(x);
        if (k) pkEv.add(k);
      };
      addPk(e.senderId);
      addPk(e.receiverId);
      for (const k of pkEv) {
        bump(map, k, "matchEventsParticipated");
      }
    }
  }

  const acc8s = matchData.acc8sEntries;
  if (Array.isArray(acc8s)) {
    for (const raw of acc8s) {
      const e = raw as Acc8sEntry;
      if (!Array.isArray(e.passingPlayerIds)) continue;
      for (const pid of e.passingPlayerIds) {
        bump(map, pid, "acc8sParticipations");
      }
      const accEv = new Set<string>();
      for (const pid of e.passingPlayerIds) {
        const k = normalizeFirestorePlayerId(pid);
        if (k) accEv.add(k);
      }
      for (const k of accEv) {
        bump(map, k, "matchEventsParticipated");
      }
    }
  }

  const pm = matchData.playerMinutes;
  if (Array.isArray(pm)) {
    for (const raw of pm) {
      const row = raw as PlayerMinutes;
      bump(map, row.playerId, "playerMinutesRows");
      const start = typeof row.startMinute === "number" ? row.startMinute : 0;
      const end = typeof row.endMinute === "number" ? row.endMinute : 0;
      bump(map, row.playerId, "playerMinutesPlayedSum", Math.max(0, end - start));
    }
  }

  const gpsData = matchData.gpsData;
  if (Array.isArray(gpsData)) {
    for (const raw of gpsData) {
      const g = raw as GPSDataEntry;
      bump(map, g.playerId, "gpsRowsInMatchDoc");
    }
  }

  const nested = matchData.matchData as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object" && Array.isArray(nested.playerStats)) {
    for (const raw of nested.playerStats as PlayerMatchStats[]) {
      bump(map, raw.playerId, "matchStatsRows");
    }
  }
}

/**
 * Sumaryczna liczba „punktów kontaktu” z danymi — do wyboru rekordu głównego przy scalaniu.
 * Pomija playerMinutesRows (liczba wierszy), żeby nie dublować minut z playerMinutesPlayedSum.
 */
export function globalDataContactTotal(c: GlobalPlayerDataCounts): number {
  let t = 0;
  for (const [key, v] of Object.entries(c) as [keyof GlobalPlayerDataCounts, number][]) {
    if (key === "playerMinutesRows") continue;
    t += v;
  }
  return t;
}

/**
 * Lista zawodników — suma powiązań z głównymi źródłami meczu: 4 tablice akcji + strzały (xG) + PK.
 * Bez obrony w 4 tablicach, 8s, minut, GPS (osobne pola w licznikach).
 */
export function principalMatchDataContactTotal(c: GlobalPlayerDataCounts): number {
  return (
    c.actionsPacking +
    c.actionsUnpacking +
    c.actionsRegain +
    c.actionsLoses +
    c.shotsAsShooter +
    c.pkAsSender +
    c.pkAsReceiver
  );
}

/**
 * Zlicza dokumenty kolekcji gps (pole playerId).
 */
export function accumulateGpsCollectionDocsIntoGlobalCounts(
  docs: Array<{ data: () => Record<string, unknown> }>,
  map: Map<string, GlobalPlayerDataCounts>,
): void {
  for (const d of docs) {
    const playerId = d.data().playerId as string | undefined;
    bump(map, playerId, "gpsCollectionDocs");
  }
}
