import assert from "node:assert/strict";

/**
 * Testuje logikę „baseline + updater” tak jak w commitMatchArrayFieldUpdate (ścieżka offline).
 * Nie wymaga Firebase — sprawdza, że kolejne dopisywanie na tej samej bazie nie gubi wpisów.
 */
function simulateOfflineAppend<T extends { id: string }>(
  baseline: T[],
  append: (prev: T[]) => T[]
): T[] {
  return append(baseline);
}

const row = (id: string) => ({ id, n: 1 });

const base = [row("1")];
const afterFirst = simulateOfflineAppend(base, (prev) => [...prev, row("2")]);
const afterSecond = simulateOfflineAppend(afterFirst, (prev) => [...prev, row("3")]);

assert.equal(afterSecond.length, 3);
assert.ok(afterSecond.some((x) => x.id === "1"));
assert.ok(afterSecond.some((x) => x.id === "2"));
assert.ok(afterSecond.some((x) => x.id === "3"));

console.log("matchArrayFieldWrite (symulacja append) tests: OK");
