import assert from "assert";
import {
  mergeMatchDataForFirestoreWrite,
  stripEmptyHeavyArraysThatWouldWipeServer,
} from "./matchDocumentMergeForSave";

// mergeMatchDataForWrite — zachowuje playerStats gdy modal nie wysyła tego pola
{
  const existing = {
    possession: { teamFirstHalf: 20, opponentFirstHalf: 15 },
    playerStats: [{ playerId: "p1", possessionMinutes: 5 }],
    successful8sActions: { teamFirstHalf: 1 },
  };
  const incoming = {
    possession: { teamFirstHalf: 22 },
    passes: { teamFirstHalf: 10 },
  };
  const merged = mergeMatchDataForFirestoreWrite(existing, incoming);
  assert.strictEqual(merged?.playerStats?.length, 1);
  assert.strictEqual(merged?.playerStats?.[0].playerId, "p1");
  assert.strictEqual(merged?.possession?.teamFirstHalf, 22);
  assert.strictEqual(merged?.possession?.opponentFirstHalf, 15);
  assert.strictEqual(merged?.passes?.teamFirstHalf, 10);
  assert.strictEqual(merged?.successful8sActions?.teamFirstHalf, 1);
}

// stripEmptyHeavyArraysThatWouldWipeServer — usuwa pustą tablicę, żeby merge nie nadpisał serwera
{
  const payload = {
    team: "t1",
    actions_packing: [] as unknown[],
    shots: [{ id: "s1" }],
  };
  const server = { actions_packing: [{ id: "a1" }], shots: [] };
  const out = stripEmptyHeavyArraysThatWouldWipeServer(payload, server);
  assert.strictEqual("actions_packing" in out, false);
  assert.strictEqual(Array.isArray(out.shots) ? out.shots.length : 0, 1);
}

// Nie usuwa, gdy serwer też pusty
{
  const payload = { actions_packing: [] as unknown[] };
  const server = { actions_packing: [] as unknown[] };
  const out = stripEmptyHeavyArraysThatWouldWipeServer(payload, server);
  assert.deepStrictEqual(out.actions_packing, []);
}
