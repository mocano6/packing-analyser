import assert from "node:assert/strict";
import { mergeByIdPreferPending } from "./mergeMatchArrayById";

type Row = { id: string; v: number };

const s: Row[] = [
  { id: "a", v: 1 },
  { id: "b", v: 2 },
];
const p: Row[] = [{ id: "a", v: 9 }];

assert.deepEqual(mergeByIdPreferPending(s, p), [
  { id: "a", v: 9 },
  { id: "b", v: 2 },
]);

assert.deepEqual(mergeByIdPreferPending(s, []), []);

const onlyPreferred: Row[] = [{ id: "x", v: 3 }];
assert.deepEqual(mergeByIdPreferPending([], onlyPreferred), [{ id: "x", v: 3 }]);

console.log("mergeMatchArrayById tests: OK");
