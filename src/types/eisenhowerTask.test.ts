import assert from "assert";
import {
  buildColumnOrderAfterMove,
  buildEisenhowerTaskDocument,
  groupTasksByColumn,
  insertIndexFromPointer,
  moveTaskInBoard,
  nextOrderAtEnd,
  normalizeEisenhowerTask,
  ORDER_GAP,
  quadrantShortLabel,
  type EisenhowerTask,
} from "./eisenhowerTask";

function task(
  partial: Partial<EisenhowerTask> & Pick<EisenhowerTask, "id" | "text">
): EisenhowerTask {
  return {
    quadrant: "urgent-important",
    lane: "matrix",
    order: ORDER_GAP,
    completed: false,
    createdAt: 100,
    ...partial,
  };
}

// Normalizacja — brak lane / order
const legacy = normalizeEisenhowerTask("legacy-1", {
  text: "Stare zadanie",
  quadrant: "important-not-urgent",
  completed: true,
  createdAt: 50,
});
assert.strictEqual(legacy.lane, "matrix");
assert.strictEqual(legacy.order, 50);
assert.strictEqual(legacy.quadrant, "important-not-urgent");

const withOrder = normalizeEisenhowerTask("o1", {
  text: "x",
  order: 2500,
  lane: "backlog",
  quadrant: "urgent-important",
});
assert.strictEqual(withOrder.order, 2500);
assert.strictEqual(withOrder.lane, "backlog");

const doc = buildEisenhowerTaskDocument(
  task({
    id: "t1",
    text: "Analiza",
    lane: "backlog",
    quadrant: "urgent-not-important",
    order: 2000,
  })
);
assert.deepStrictEqual(doc, {
  text: "Analiza",
  quadrant: "urgent-not-important",
  lane: "backlog",
  order: 2000,
  completed: false,
  createdAt: 100,
});

assert.strictEqual(quadrantShortLabel("urgent-important"), "Pilne · ważne");

const a = task({ id: "a", text: "A", lane: "backlog", order: 1000 });
const b = task({
  id: "b",
  text: "B",
  lane: "backlog",
  order: 2000,
  quadrant: "important-not-urgent",
});
const c = task({
  id: "c",
  text: "C",
  lane: "backlog",
  order: 3000,
  completed: true,
});
const m = task({ id: "m", text: "M", lane: "matrix", order: 1000 });

const grouped = groupTasksByColumn([a, b, c, m]);
assert.strictEqual(grouped.backlog.length, 3);
assert.strictEqual(grouped.backlog[0].id, "a");
assert.strictEqual(grouped.backlog[1].id, "b");
assert.strictEqual(grouped.backlog[2].id, "c");
assert.strictEqual(grouped["urgent-important"].length, 1);

// Wstawienie między karty
const ordered = buildColumnOrderAfterMove([a, b, c], m, 1);
assert.deepStrictEqual(
  ordered.map((t) => t.id),
  ["a", "m", "b", "c"]
);

// Ukończone nie wchodzą między aktywne
const done = task({ id: "d", text: "D", lane: "backlog", completed: true, order: 1 });
const orderedDone = buildColumnOrderAfterMove([a, b], done, 0);
assert.deepStrictEqual(
  orderedDone.map((t) => t.id),
  ["a", "b", "d"]
);

assert.strictEqual(nextOrderAtEnd([a, b]), 2000 + ORDER_GAP);
assert.strictEqual(insertIndexFromPointer([a, b], "a", false), 0);
assert.strictEqual(insertIndexFromPointer([a, b], "a", true), 1);
assert.strictEqual(insertIndexFromPointer([a, b], null, false), 2);

// Przeniesienie z macierzy na początek backlogu
const moved = moveTaskInBoard([a, b, m], "m", "backlog", 0);
assert.strictEqual(moved.changed.length > 0, true);
const backlogAfter = groupTasksByColumn(moved.tasks).backlog;
assert.strictEqual(backlogAfter[0].id, "m");
assert.strictEqual(backlogAfter[0].lane, "backlog");
assert.ok(backlogAfter[0].order < backlogAfter[1].order);

// Zmiana kolejności w backlogu: b przed a
const reordered = moveTaskInBoard([a, b], "b", "backlog", 0);
const ids = groupTasksByColumn(reordered.tasks).backlog.map((t) => t.id);
assert.deepStrictEqual(ids, ["b", "a"]);

// Drop w to samo miejsce = brak zmian
const noop = moveTaskInBoard([a, b], "a", "backlog", 0);
assert.strictEqual(noop.changed.length, 0);

console.log("eisenhowerTask.test: OK");
