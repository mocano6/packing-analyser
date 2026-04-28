import assert from "assert";
import {
  assignPlayerToFormationSlot,
  createEmptyFormationBoard,
  normalizeTeamFormationBoardStorage,
  pruneFormationBoardPlayers,
  removePlayerFromFormationBoard,
} from "./teamFormationBoard";

const board = createEmptyFormationBoard("4-3-3");
assert.deepEqual(board.gk, []);
assert.ok("st" in board);

const withPlayer = assignPlayerToFormationSlot(board, "gk", "p1");
assert.deepEqual(withPlayer.gk, ["p1"]);

const movedPlayer = assignPlayerToFormationSlot(withPlayer, "st", "p1");
assert.deepEqual(movedPlayer.gk, []);
assert.deepEqual(movedPlayer.st, ["p1"]);

const withTwoPlayers = assignPlayerToFormationSlot(movedPlayer, "st", "p2");
assert.deepEqual(withTwoPlayers.st, ["p1", "p2"]);

const withoutPlayer = removePlayerFromFormationBoard(withTwoPlayers, "p1");
assert.deepEqual(withoutPlayer.st, ["p2"]);

const pruned = pruneFormationBoardPlayers(withTwoPlayers, new Set(["p1"]));
assert.deepEqual(pruned.st, ["p1"]);

const normalized = normalizeTeamFormationBoardStorage({
  selectedFormationId: "3-4-3",
  formations: { "3-4-3": { gk: ["p1"] } },
});
assert.equal(normalized.selectedFormationId, "3-4-3");
assert.deepEqual(normalized.formations["3-4-3"].gk, ["p1"]);
assert.ok("4-4-2" in normalized.formations);
