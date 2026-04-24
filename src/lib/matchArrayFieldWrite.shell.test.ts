import assert from "node:assert/strict";
import { minimalMatchDocShellForLocalCache } from "./minimalMatchDocShellForLocalCache";

{
  const shell = minimalMatchDocShellForLocalCache("mid-1");
  assert.equal(shell.matchId, "mid-1");
  assert.ok(Array.isArray(shell.actions_packing));
  assert.ok(Array.isArray(shell.actions_regain));
  assert.ok(Array.isArray(shell.actions_loses));
  assert.equal(shell.actions_packing.length, 0);
}

console.log("matchArrayFieldWrite.shell tests: OK");
