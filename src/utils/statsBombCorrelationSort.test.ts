import assert from "node:assert/strict";
import {
  correlationListSortLabel,
  defaultCorrelationListSort,
  sortCorrelationListRows,
  toggleCorrelationListSort,
} from "./statsBombCorrelationSort";

type Row = { id: string; r: number };

const positive: Row[] = [
  { id: "a", r: 0.2 },
  { id: "b", r: 0.9 },
  { id: "c", r: 0.5 },
];

const negative: Row[] = [
  { id: "a", r: -0.1 },
  { id: "b", r: -0.9 },
  { id: "c", r: -0.4 },
];

// Domyślnie: najsilniejsze |r| na górze.
assert.deepEqual(
  sortCorrelationListRows(positive, defaultCorrelationListSort("positive")).map((row) => row.id),
  ["b", "c", "a"],
);
assert.deepEqual(
  sortCorrelationListRows(negative, defaultCorrelationListSort("negative")).map((row) => row.id),
  ["b", "c", "a"],
);

// Rosnąco po r: dodatnie od najmniejszych, ujemne od najbardziej ujemnych.
assert.deepEqual(
  sortCorrelationListRows(positive, "ascending").map((row) => row.id),
  ["a", "c", "b"],
);
assert.deepEqual(
  sortCorrelationListRows(negative, "ascending").map((row) => row.id),
  ["b", "c", "a"],
);

// Malejąco po r.
assert.deepEqual(
  sortCorrelationListRows(positive, "descending").map((row) => row.id),
  ["b", "c", "a"],
);
assert.deepEqual(
  sortCorrelationListRows(negative, "descending").map((row) => row.id),
  ["a", "c", "b"],
);

assert.equal(defaultCorrelationListSort("positive"), "descending");
assert.equal(defaultCorrelationListSort("negative"), "ascending");
assert.equal(toggleCorrelationListSort("ascending"), "descending");
assert.equal(correlationListSortLabel("ascending"), "Od najmniejszych r do największych");

console.log("statsBombCorrelationSort tests: OK");
