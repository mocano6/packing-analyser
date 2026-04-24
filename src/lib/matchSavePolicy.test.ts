import assert from "node:assert/strict";
import { canCallerSaveMatch } from "./matchSavePolicy";

assert.equal(canCallerSaveMatch(null, "t1"), true);
assert.equal(canCallerSaveMatch(undefined, "t1"), true);
assert.equal(canCallerSaveMatch({}, "t1"), true);
assert.equal(canCallerSaveMatch({ role: "coach" }, "t1"), true);

assert.equal(canCallerSaveMatch(null, ""), false);
assert.equal(canCallerSaveMatch({ role: "coach" }, ""), false);

assert.equal(canCallerSaveMatch({ role: "player", allowedTeams: [] }, "t1"), false);
assert.equal(canCallerSaveMatch({ role: "player", allowedTeams: "" }, "t1"), false);

assert.equal(canCallerSaveMatch({ role: "player", allowedTeams: ["t1"] }, "t1"), true);
assert.equal(canCallerSaveMatch({ role: "player", allowedTeams: ["t2"] }, "t1"), false);
assert.equal(canCallerSaveMatch({ role: "player", allowedTeams: "t1" }, "t1"), true);

assert.equal(canCallerSaveMatch({ role: "coach", allowedTeams: ["t1"] }, "t1"), true);
assert.equal(canCallerSaveMatch({ role: "coach", allowedTeams: ["t2"] }, "t1"), false);

console.log("matchSavePolicy.test: OK");
