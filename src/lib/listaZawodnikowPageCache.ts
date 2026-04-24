/**
 * Persystencja agregacji listy zawodników (akcje + globalCounts + nazwy meczów).
 * Ochrona przed pustym UI po błędzie sieci / różnymi originami (localhost vs 127.0.0.1).
 */

import type { Action } from "@/types";
import { createEmptyGlobalPlayerDataCounts, type GlobalPlayerDataCounts } from "./globalPlayerDataCounts";

export const LISTA_PAGE_CACHE_KEY_V3 = "lista_zawodnikow_page_cache_v3";

/** Stary format — tylko akcje; przy odczycie liczniki trzeba dociągnąć z serwera. */
export const LISTA_PAGE_CACHE_KEY_V2_LEGACY = "lista_zawodnikow_all_actions_cache_v2";

export const LISTA_PAGE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ListaPageCachePayload = {
  ts: number;
  actions: Action[];
  globalCountsByPlayerId: Record<string, GlobalPlayerDataCounts>;
  matchNamesById: Record<string, string>;
};

function normalizeGlobalCountsRecord(
  raw: unknown,
): Record<string, GlobalPlayerDataCounts> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const empty = createEmptyGlobalPlayerDataCounts();
  const out: Record<string, GlobalPlayerDataCounts> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    out[k] = { ...empty, ...(v as GlobalPlayerDataCounts) };
  }
  return out;
}

function parseV3(raw: string, nowMs: number): ListaPageCachePayload | null {
  let p: unknown;
  try {
    p = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = p as Record<string, unknown>;
  if (typeof o.ts !== "number" || nowMs - o.ts > LISTA_PAGE_CACHE_MAX_AGE_MS) return null;
   if (!Array.isArray(o.data)) return null;
  const counts = normalizeGlobalCountsRecord(o.globalCountsByPlayerId ?? {}) ?? {};
  const names = o.matchNamesById;
  const matchNamesById =
    names && typeof names === "object" && !Array.isArray(names)
      ? (names as Record<string, string>)
      : {};
  return {
    ts: o.ts,
    actions: o.data as Action[],
    globalCountsByPlayerId: counts,
    matchNamesById,
  };
}

function parseV2Legacy(raw: string, nowMs: number): ListaPageCachePayload | null {
  let p: unknown;
  try {
    p = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = p as Record<string, unknown>;
  if (typeof o.ts !== "number" || nowMs - o.ts > LISTA_PAGE_CACHE_MAX_AGE_MS) return null;
  if (!Array.isArray(o.data)) return null;
  return {
    ts: o.ts,
    actions: o.data as Action[],
    globalCountsByPlayerId: {},
    matchNamesById: {},
  };
}

/** Odczyt z localStorage (wyłącznie w przeglądarce). */
export function readListaPageCache(nowMs = Date.now()): ListaPageCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const v3 = window.localStorage.getItem(LISTA_PAGE_CACHE_KEY_V3);
    if (v3) {
      const got = parseV3(v3, nowMs);
      if (got) return got;
    }
    const v2 = window.localStorage.getItem(LISTA_PAGE_CACHE_KEY_V2_LEGACY);
    if (v2) return parseV2Legacy(v2, nowMs);
  } catch {
    /* quota / private mode */
  }
  return null;
}

export function writeListaPageCache(payload: ListaPageCachePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LISTA_PAGE_CACHE_KEY_V3,
      JSON.stringify({
        ts: payload.ts,
        data: payload.actions,
        globalCountsByPlayerId: payload.globalCountsByPlayerId,
        matchNamesById: payload.matchNamesById,
      }),
    );
  } catch {
    /* ignore */
  }
}
