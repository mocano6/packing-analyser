/**
 * Rozbitka udziału zawodnika na poszczególne mecze — do widoku duplikatów (minuty, zdarzenia, typy akcji).
 * Logika zgodna z accumulateMatchDocumentIntoGlobalCounts, ale z bucketem matchId.
 */

import type { Acc8sEntry, PKEntry, PlayerMatchStats, PlayerMinutes, Shot } from "@/types";
import {
  MATCH_ACTION_ARRAY_KEYS,
  type MatchActionArrayKey,
} from "./duplicatePlayerMergeRewrite";
import { mergeNestedMatchArraysIntoRootForAggregation } from "./globalPlayerDataCounts";
import {
  getActionReceiverIdFromRaw,
  getActionSenderIdFromRaw,
  normalizeFirestorePlayerId,
} from "./matchActionPlayerIds";

export type ListaPerMatchParticipation = {
  matchId: string;
  matchEvents: number;
  actionsPacking: number;
  actionsUnpacking: number;
  actionsRegain: number;
  actionsLoses: number;
  actionsAsDefense: number;
  shotsAsShooter: number;
  shotsAsAssistant: number;
  shotsBlocking: number;
  shotsLine: number;
  pkAsSender: number;
  pkAsReceiver: number;
  acc8sParticipations: number;
  playerMinutesRows: number;
  /** Suma max(0, endMinute - startMinute) po wierszach playerMinutes */
  minutesPlayed: number;
  gpsRowsInMatchDoc: number;
  matchStatsRows: number;
};

const FIELD_TO_KEY: Record<MatchActionArrayKey, keyof ListaPerMatchParticipation> = {
  actions_packing: "actionsPacking",
  actions_unpacking: "actionsUnpacking",
  actions_regain: "actionsRegain",
  actions_loses: "actionsLoses",
};

function emptyRow(matchId: string): ListaPerMatchParticipation {
  return {
    matchId,
    matchEvents: 0,
    actionsPacking: 0,
    actionsUnpacking: 0,
    actionsRegain: 0,
    actionsLoses: 0,
    actionsAsDefense: 0,
    shotsAsShooter: 0,
    shotsAsAssistant: 0,
    shotsBlocking: 0,
    shotsLine: 0,
    pkAsSender: 0,
    pkAsReceiver: 0,
    acc8sParticipations: 0,
    playerMinutesRows: 0,
    minutesPlayed: 0,
    gpsRowsInMatchDoc: 0,
    matchStatsRows: 0,
  };
}

function ensureRow(
  out: Map<string, Map<string, ListaPerMatchParticipation>>,
  playerKey: string,
  matchId: string,
): ListaPerMatchParticipation {
  let inner = out.get(playerKey);
  if (!inner) {
    inner = new Map();
    out.set(playerKey, inner);
  }
  let row = inner.get(matchId);
  if (!row) {
    row = emptyRow(matchId);
    inner.set(matchId, row);
  }
  return row;
}

function bumpPlayerMatch(
  out: Map<string, Map<string, ListaPerMatchParticipation>>,
  playerId: unknown,
  matchId: string,
  field: keyof ListaPerMatchParticipation,
  delta = 1,
): void {
  const key = normalizeFirestorePlayerId(playerId);
  if (!key) return;
  const row = ensureRow(out, key, matchId);
  (row[field] as number) += delta;
}

/**
 * Jedna ramka dokumentu meczu (po mergeNestedMatchArraysIntoRootForAggregation).
 */
export function accumulateMatchDocumentPerMatchParticipation(
  raw: Record<string, unknown>,
  matchId: string,
  out: Map<string, Map<string, ListaPerMatchParticipation>>,
): void {
  const matchData = mergeNestedMatchArraysIntoRootForAggregation(raw);

  for (const field of MATCH_ACTION_ARRAY_KEYS) {
    const arr = matchData[field];
    if (!Array.isArray(arr)) continue;
    const countKey = FIELD_TO_KEY[field];
    for (const actionEl of arr) {
      const row = actionEl as Record<string, unknown>;
      const sid = getActionSenderIdFromRaw(actionEl);
      const rid = getActionReceiverIdFromRaw(actionEl);
      if (sid) bumpPlayerMatch(out, sid, matchId, countKey);
      if (rid) bumpPlayerMatch(out, rid, matchId, countKey);
      const defensePlayers = row.defensePlayers;
      if (Array.isArray(defensePlayers)) {
        for (const did of defensePlayers) {
          if (typeof did === "string") bumpPlayerMatch(out, did, matchId, "actionsAsDefense");
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
        bumpPlayerMatch(out, k, matchId, "matchEvents");
      }
    }
  }

  const shots = matchData.shots;
  if (Array.isArray(shots)) {
    for (const rawS of shots) {
      const s = rawS as Shot & { shooterId?: string; player_id?: string };
      const shooterId = s.playerId ?? s.shooterId ?? s.player_id;
      bumpPlayerMatch(out, shooterId, matchId, "shotsAsShooter");
      bumpPlayerMatch(out, s.assistantId, matchId, "shotsAsAssistant");
      for (const id of s.blockingPlayers ?? []) {
        bumpPlayerMatch(out, id, matchId, "shotsBlocking");
      }
      for (const id of s.linePlayers ?? []) {
        bumpPlayerMatch(out, id, matchId, "shotsLine");
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
        bumpPlayerMatch(out, k, matchId, "matchEvents");
      }
    }
  }

  const pkEntries = matchData.pkEntries;
  if (Array.isArray(pkEntries)) {
    for (const rawP of pkEntries) {
      const e = rawP as PKEntry;
      bumpPlayerMatch(out, e.senderId, matchId, "pkAsSender");
      bumpPlayerMatch(out, e.receiverId, matchId, "pkAsReceiver");
      const pkEv = new Set<string>();
      const addPk = (x: unknown) => {
        const k = normalizeFirestorePlayerId(x);
        if (k) pkEv.add(k);
      };
      addPk(e.senderId);
      addPk(e.receiverId);
      for (const k of pkEv) {
        bumpPlayerMatch(out, k, matchId, "matchEvents");
      }
    }
  }

  const acc8s = matchData.acc8sEntries;
  if (Array.isArray(acc8s)) {
    for (const rawA of acc8s) {
      const e = rawA as Acc8sEntry;
      if (!Array.isArray(e.passingPlayerIds)) continue;
      for (const pid of e.passingPlayerIds) {
        bumpPlayerMatch(out, pid, matchId, "acc8sParticipations");
      }
      const accEv = new Set<string>();
      for (const pid of e.passingPlayerIds) {
        const k = normalizeFirestorePlayerId(pid);
        if (k) accEv.add(k);
      }
      for (const k of accEv) {
        bumpPlayerMatch(out, k, matchId, "matchEvents");
      }
    }
  }

  const pm = matchData.playerMinutes;
  if (Array.isArray(pm)) {
    for (const rawM of pm) {
      const mrow = rawM as PlayerMinutes;
      const pk = normalizeFirestorePlayerId(mrow.playerId);
      if (!pk) continue;
      const row = ensureRow(out, pk, matchId);
      row.playerMinutesRows += 1;
      const start = typeof mrow.startMinute === "number" ? mrow.startMinute : 0;
      const end = typeof mrow.endMinute === "number" ? mrow.endMinute : 0;
      row.minutesPlayed += Math.max(0, end - start);
    }
  }

  const gpsData = matchData.gpsData;
  if (Array.isArray(gpsData)) {
    for (const rawG of gpsData) {
      const g = rawG as { playerId?: string };
      bumpPlayerMatch(out, g.playerId, matchId, "gpsRowsInMatchDoc");
    }
  }

  const nested = matchData.matchData as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object" && Array.isArray(nested.playerStats)) {
    for (const rawSt of nested.playerStats as PlayerMatchStats[]) {
      bumpPlayerMatch(out, rawSt.playerId, matchId, "matchStatsRows");
    }
  }
}

/** Konwersja do posortowanych wierszy dla jednego zawodnika (etykieta meczu). */
export function sortedParticipationRowsForPlayer(
  map: Map<string, Map<string, ListaPerMatchParticipation>>,
  playerId: string,
  matchNamesById: Record<string, string>,
): ListaPerMatchParticipation[] {
  const pk = normalizeFirestorePlayerId(playerId) ?? playerId;
  let inner = map.get(pk) ?? map.get(playerId);
  if (!inner) {
    const pkLower = pk.toLowerCase();
    for (const [k, v] of map.entries()) {
      const nk = normalizeFirestorePlayerId(k) ?? k;
      if (nk === pk || nk.toLowerCase() === pkLower) {
        inner = v;
        break;
      }
    }
  }
  if (!inner) return [];
  const rows = [...inner.values()];
  rows.sort((a, b) => {
    const la = (matchNamesById[a.matchId] ?? a.matchId).toLocaleLowerCase("pl");
    const lb = (matchNamesById[b.matchId] ?? b.matchId).toLocaleLowerCase("pl");
    return la.localeCompare(lb, "pl", { sensitivity: "base" });
  });
  return rows;
}

export function participationMapToRecord(
  map: Map<string, Map<string, ListaPerMatchParticipation>>,
  matchNamesById: Record<string, string>,
): Record<string, ListaPerMatchParticipation[]> {
  const out: Record<string, ListaPerMatchParticipation[]> = {};
  for (const playerKey of map.keys()) {
    out[playerKey] = sortedParticipationRowsForPlayer(map, playerKey, matchNamesById);
  }
  return out;
}

/** Odczyt wierszy per mecz dla playerId (jak lookupGlobalPlayerDataCounts). */
export function lookupPerMatchParticipationRows(
  record: Record<string, ListaPerMatchParticipation[]>,
  playerId: string,
): ListaPerMatchParticipation[] {
  const pk = normalizeFirestorePlayerId(playerId) ?? playerId;
  for (const k of [pk, playerId]) {
    const row = record[k];
    if (row && row.length > 0) return row;
  }
  const pkLower = pk.toLowerCase();
  for (const [k, v] of Object.entries(record)) {
    if (!v?.length) continue;
    const nk = normalizeFirestorePlayerId(k) ?? k;
    if (nk === pk || nk.toLowerCase() === pkLower) return v;
  }
  return [];
}
