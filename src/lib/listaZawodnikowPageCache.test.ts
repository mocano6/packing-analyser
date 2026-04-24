import assert from "assert";
import {
  LISTA_PAGE_CACHE_MAX_AGE_MS,
  readListaPageCache,
  type ListaPageCachePayload,
} from "./listaZawodnikowPageCache";
import { createEmptyGlobalPlayerDataCounts } from "./globalPlayerDataCounts";

function testParseV3RequiresCounts() {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    ts: now,
    data: [{ id: "a1", matchId: "m1", senderId: "p1", minute: 1, actionType: "pass", isSecondHalf: false }],
    globalCountsByPlayerId: {
      p1: { ...createEmptyGlobalPlayerDataCounts(), actionsPacking: 2 },
    },
    matchNamesById: { m1: "A vs B" },
  });
  (global as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (k: string) => (k === "lista_zawodnikow_page_cache_v3" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
  const got = readListaPageCache(now);
  assert.ok(got);
  assert.strictEqual(got!.actions.length, 1);
  assert.strictEqual(got!.globalCountsByPlayerId.p1?.actionsPacking, 2);
  assert.strictEqual(got!.matchNamesById.m1, "A vs B");
}

function testExpiredReturnsNull() {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    ts: now - LISTA_PAGE_CACHE_MAX_AGE_MS - 1000,
    data: [],
    globalCountsByPlayerId: {},
    matchNamesById: {},
  });
  (global as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (k: string) => (k === "lista_zawodnikow_page_cache_v3" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
  assert.strictEqual(readListaPageCache(now), null);
}

function testV2LegacyActionsOnly() {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    ts: now,
    data: [{ id: "a1", matchId: "m1", senderId: "p1", minute: 1, actionType: "pass", isSecondHalf: false }],
  });
  (global as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (k: string) => (k === "lista_zawodnikow_all_actions_cache_v2" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
  const got = readListaPageCache(now);
  assert.ok(got);
  assert.strictEqual(got!.actions.length, 1);
  assert.deepStrictEqual(got!.globalCountsByPlayerId, {});
}

function testV3AllowsEmptyCountsWhenActionsPresent() {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    ts: now,
    data: [{ id: "a1", matchId: "m1", senderId: "p1", minute: 1, actionType: "pass", isSecondHalf: false }],
    matchNamesById: {},
  });
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (k: string) => (k === "lista_zawodnikow_page_cache_v3" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
  const got = readListaPageCache(now);
  assert.ok(got);
  assert.strictEqual(got!.actions.length, 1);
  assert.deepStrictEqual(got!.globalCountsByPlayerId, {});
}

function testNormalizesMissingCountFields() {
  const now = 1_700_000_000_000;
  const raw = JSON.stringify({
    ts: now,
    data: [],
    globalCountsByPlayerId: {
      p1: { actionsPacking: 1 },
    },
    matchNamesById: {},
  });
  (global as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (k: string) => (k === "lista_zawodnikow_page_cache_v3" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    },
  };
  const got = readListaPageCache(now) as ListaPageCachePayload;
  assert.strictEqual(got.globalCountsByPlayerId.p1?.matchEventsParticipated, 0);
  assert.strictEqual(got.globalCountsByPlayerId.p1?.actionsPacking, 1);
}

testParseV3RequiresCounts();
testExpiredReturnsNull();
testV2LegacyActionsOnly();
testV3AllowsEmptyCountsWhenActionsPresent();
testNormalizesMissingCountFields();

delete (globalThis as unknown as { window?: unknown }).window;

console.log("listaZawodnikowPageCache tests: OK");
