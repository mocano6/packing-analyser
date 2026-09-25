import type {
  LnpCachedMatchMinutes,
  LnpPlayerLoadMerge,
  LnpPlayerLoadState,
} from "@/types/lnpPlayerLoad";
import { LNP_PLAYER_LOAD_VERSION } from "@/types/lnpPlayerLoad";

const MAX_CACHED_MATCHES = 80;

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

function nullableString(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function normalizePlayers(raw: unknown): LnpCachedMatchMinutes["players"] {
  if (!Array.isArray(raw)) return [];
  const out: LnpCachedMatchMinutes["players"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const firstName = String(rec.firstName ?? "");
    const lastName = String(rec.lastName ?? "");
    if (!firstName && !lastName) continue;
    const minutes = Number(rec.minutesPlayed);
    out.push({
      lnpId: String(rec.lnpId ?? ""),
      firstName,
      lastName,
      number: Number.isFinite(Number(rec.number)) ? Math.trunc(Number(rec.number)) : 0,
      minutesPlayed: Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0,
    });
  }
  return out;
}

const MAX_ROSTER_EDITS = 200;

function normalizeHiddenPlayerKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = String(item ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_ROSTER_EDITS) break;
  }
  return out;
}

function normalizePlayerMerges(raw: unknown): LnpPlayerLoadMerge[] {
  if (!Array.isArray(raw)) return [];
  const bySource = new Map<string, string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const sourceKey = String(rec.sourceKey ?? "").trim();
    const targetKey = String(rec.targetKey ?? "").trim();
    if (!sourceKey || !targetKey || sourceKey === targetKey) continue;
    bySource.set(sourceKey, targetKey);
    if (bySource.size >= MAX_ROSTER_EDITS) break;
  }
  return [...bySource.entries()].map(([sourceKey, targetKey]) => ({ sourceKey, targetKey }));
}

export function normalizeCachedMatchMinutes(raw: unknown): LnpCachedMatchMinutes[] {
  if (!Array.isArray(raw)) return [];
  const out: LnpCachedMatchMinutes[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const matchId = String(rec.matchId ?? "");
    if (!matchId || seen.has(matchId)) continue;
    seen.add(matchId);
    out.push({
      matchId,
      dateTime: String(rec.dateTime ?? ""),
      opponent: String(rec.opponent ?? ""),
      isHome: rec.isHome === true,
      playName: String(rec.playName ?? ""),
      scoreFinal: rec.scoreFinal == null || rec.scoreFinal === "" ? null : String(rec.scoreFinal),
      fetchedAt: String(rec.fetchedAt ?? ""),
      hasSquad: rec.hasSquad !== false,
      players: normalizePlayers(rec.players),
    });
  }
  return out
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
    .slice(0, MAX_CACHED_MATCHES);
}

export function buildSanitizedLnpPlayerLoadState(state: LnpPlayerLoadState): LnpPlayerLoadState {
  return {
    matches: normalizeCachedMatchMinutes(state.matches),
    fetchedAt: nullableString(state.fetchedAt),
    lnpTeamId: nullableString(state.lnpTeamId),
    hiddenPlayerKeys: normalizeHiddenPlayerKeys(state.hiddenPlayerKeys),
    playerMerges: normalizePlayerMerges(state.playerMerges),
  };
}

export function migrateLnpPlayerLoadFromFirestore(raw: Record<string, unknown>): LnpPlayerLoadState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;
  return buildSanitizedLnpPlayerLoadState({
    matches: normalizeCachedMatchMinutes(inner.matches),
    fetchedAt: nullableString(inner.fetchedAt),
    lnpTeamId: nullableString(inner.lnpTeamId),
    hiddenPlayerKeys: normalizeHiddenPlayerKeys(inner.hiddenPlayerKeys),
    playerMerges: normalizePlayerMerges(inner.playerMerges),
  });
}

export function buildLnpPlayerLoadDocument(
  state: LnpPlayerLoadState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedLnpPlayerLoadState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(LNP_PLAYER_LOAD_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : LNP_PLAYER_LOAD_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
