import assert from "assert";
import {
  assignPlayerToLineupSlot,
  createStartingLineup,
  mergeStartingLineupIntoPlayerMinutes,
  removePlayerFromLineup,
} from "./startingLineup";

const lineup = createStartingLineup("4-3-3");

assert.equal(lineup.formationId, "4-3-3");
assert.equal(lineup.slots.length, 11);

const withPlayer = assignPlayerToLineupSlot(lineup, "st", "player-1");
assert.equal(withPlayer.slots.find((slot) => slot.slotId === "st")?.playerId, "player-1");

const movedPlayer = assignPlayerToLineupSlot(withPlayer, "rw", "player-1");
assert.equal(movedPlayer.slots.find((slot) => slot.slotId === "st")?.playerId, undefined);
assert.equal(movedPlayer.slots.find((slot) => slot.slotId === "rw")?.playerId, "player-1");

const removedPlayer = removePlayerFromLineup(movedPlayer, "player-1");
assert.equal(removedPlayer.slots.find((slot) => slot.slotId === "rw")?.playerId, undefined);

const minutesLineup = assignPlayerToLineupSlot(lineup, "gk", "player-2");
const minutesLineupWithTwoPlayers = assignPlayerToLineupSlot(minutesLineup, "st", "player-4");
const mergedMinutes = mergeStartingLineupIntoPlayerMinutes(
  [
    { playerId: "player-3", startMinute: 20, endMinute: 75, position: "CM", status: "dostepny" },
    { playerId: "player-4", startMinute: 15, endMinute: 60, position: "ST", status: "dostepny" },
  ],
  minutesLineupWithTwoPlayers
);

assert.deepEqual(
  mergedMinutes.find((pm) => pm.playerId === "player-2"),
  { playerId: "player-2", startMinute: 1, endMinute: 90, position: "GK", status: "dostepny" }
);
assert.deepEqual(
  mergedMinutes.find((pm) => pm.playerId === "player-3"),
  { playerId: "player-3", startMinute: 20, endMinute: 75, position: "CM", status: "dostepny" }
);
assert.deepEqual(
  mergedMinutes.find((pm) => pm.playerId === "player-4"),
  { playerId: "player-4", startMinute: 1, endMinute: 60, position: "ST", status: "dostepny" }
);
