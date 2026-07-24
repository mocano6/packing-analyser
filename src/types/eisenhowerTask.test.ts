import assert from "assert";
import {
  buildColumnOrderAfterMove,
  buildEisenhowerTaskDocument,
  groupTasksByColumn,
  insertIndexFromPointer,
  migrateLegacyStatus,
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
    status: "todo",
    order: ORDER_GAP,
    createdAt: 100,
    ...partial,
  };
}

// Migracja legacy: completed → done
assert.strictEqual(migrateLegacyStatus({ completed: true, lane: "backlog" }), "done");
assert.strictEqual(migrateLegacyStatus({ lane: "backlog" }), "backlog");
assert.strictEqual(migrateLegacyStatus({ lane: "matrix" }), "in_progress");
assert.strictEqual(migrateLegacyStatus({ status: "rework" }), "rework");

// Normalizacja — brak status / order
const legacy = normalizeEisenhowerTask("legacy-1", {
  text: "Stare zadanie",
  quadrant: "important-not-urgent",
  completed: true,
  createdAt: 50,
});
assert.strictEqual(legacy.status, "done");
assert.strictEqual(legacy.order, 50);
assert.strictEqual(legacy.quadrant, "important-not-urgent");

const withOrder = normalizeEisenhowerTask("o1", {
  text: "x",
  order: 2500,
  lane: "backlog",
  quadrant: "urgent-important",
});
assert.strictEqual(withOrder.order, 2500);
assert.strictEqual(withOrder.status, "backlog");

const matrixLegacy = normalizeEisenhowerTask("m1", {
  text: "Aktualne",
  lane: "matrix",
  quadrant: "urgent-important",
  createdAt: 10,
});
assert.strictEqual(matrixLegacy.status, "in_progress");

const doc = buildEisenhowerTaskDocument(
  task({
    id: "t1",
    text: "Analiza",
    status: "backlog",
    quadrant: "urgent-not-important",
    order: 2000,
  })
);
assert.deepStrictEqual(doc, {
  text: "Analiza",
  quadrant: "urgent-not-important",
  status: "backlog",
  order: 2000,
  createdAt: 100,
  completed: false,
  lane: "backlog",
});

const doneDoc = buildEisenhowerTaskDocument(
  task({ id: "d1", text: "Gotowe", status: "done", order: 1000 })
);
assert.strictEqual(doneDoc.completed, true);
assert.strictEqual(doneDoc.lane, "matrix");

assert.strictEqual(quadrantShortLabel("urgent-important"), "Pilne · ważne");

const a = task({ id: "a", text: "A", status: "backlog", order: 1000 });
const b = task({
  id: "b",
  text: "B",
  status: "backlog",
  order: 2000,
  quadrant: "important-not-urgent",
});
const c = task({
  id: "c",
  text: "C",
  status: "backlog",
  order: 3000,
});
const m = task({ id: "m", text: "M", status: "in_progress", order: 1000 });

const grouped = groupTasksByColumn([a, b, c, m]);
assert.strictEqual(grouped.backlog.length, 3);
assert.strictEqual(grouped.backlog[0].id, "a");
assert.strictEqual(grouped.backlog[1].id, "b");
assert.strictEqual(grouped.backlog[2].id, "c");
assert.strictEqual(grouped.in_progress.length, 1);
assert.strictEqual(grouped.todo.length, 0);

// Wstawienie między karty
const ordered = buildColumnOrderAfterMove([a, b, c], m, 1);
assert.deepStrictEqual(
  ordered.map((t) => t.id),
  ["a", "m", "b", "c"]
);

assert.strictEqual(nextOrderAtEnd([a, b]), 2000 + ORDER_GAP);
assert.strictEqual(insertIndexFromPointer([a, b], "a", false), 0);
assert.strictEqual(insertIndexFromPointer([a, b], "a", true), 1);
assert.strictEqual(insertIndexFromPointer([a, b], null, false), 2);

// Przeniesienie z „w trakcie” na początek backlogu — quadrant bez zmian
const moved = moveTaskInBoard([a, b, m], "m", "backlog", 0);
assert.strictEqual(moved.changed.length > 0, true);
const backlogAfter = groupTasksByColumn(moved.tasks).backlog;
assert.strictEqual(backlogAfter[0].id, "m");
assert.strictEqual(backlogAfter[0].status, "backlog");
assert.strictEqual(backlogAfter[0].quadrant, "urgent-important");
assert.ok(backlogAfter[0].order < backlogAfter[1].order);

// Drop do „done”
const toDone = moveTaskInBoard([a, m], "m", "done", 0);
assert.strictEqual(groupTasksByColumn(toDone.tasks).done[0].status, "done");

// Zmiana kolejności w backlogu: b przed a
const reordered = moveTaskInBoard([a, b], "b", "backlog", 0);
const ids = groupTasksByColumn(reordered.tasks).backlog.map((t) => t.id);
assert.deepStrictEqual(ids, ["b", "a"]);

// Drop w to samo miejsce = brak zmian
const noop = moveTaskInBoard([a, b], "a", "backlog", 0);
assert.strictEqual(noop.changed.length, 0);

console.log("eisenhowerTask.test: OK");
