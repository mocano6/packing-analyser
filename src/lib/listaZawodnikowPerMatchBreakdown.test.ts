import assert from "assert";
import {
  accumulateMatchDocumentPerMatchParticipation,
  sortedParticipationRowsForPlayer,
  type ListaPerMatchParticipation,
} from "./listaZawodnikowPerMatchBreakdown";

const MID = "m1";

const doc = {
  actions_packing: [
    { id: "a1", senderId: "p1", receiverId: "p2", defensePlayers: [] },
  ],
  actions_unpacking: [{ id: "u1", senderId: "p2", receiverId: "p1" }],
  playerMinutes: [
    { playerId: "p1", startMinute: 0, endMinute: 45 },
    { playerId: "p1", startMinute: 46, endMinute: 90 },
  ],
  shots: [{ playerId: "p1", assistantId: "p2" }],
  pkEntries: [{ senderId: "p1", receiverId: "p2" }],
  acc8sEntries: [{ passingPlayerIds: ["p1", "p2"] }],
};

{
  const out = new Map<string, Map<string, ListaPerMatchParticipation>>();
  accumulateMatchDocumentPerMatchParticipation(doc, MID, out);
  const r1 = sortedParticipationRowsForPlayer(out, "p1", { [MID]: "Team A vs B" })[0];
  assert.strictEqual(r1.matchId, MID);
  assert.strictEqual(r1.actionsPacking, 1);
  assert.strictEqual(r1.actionsUnpacking, 1);
  assert.strictEqual(r1.shotsAsShooter, 1);
  assert.strictEqual(r1.pkAsSender, 1);
  assert.strictEqual(r1.acc8sParticipations, 1);
  assert.strictEqual(r1.playerMinutesRows, 2);
  assert.strictEqual(r1.minutesPlayed, 89);
  assert.strictEqual(r1.matchEvents, 5);
}

console.log("listaZawodnikowPerMatchBreakdown tests: OK");
