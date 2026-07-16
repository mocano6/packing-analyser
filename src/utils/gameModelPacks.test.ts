import assert from "assert";
import {
  applyGameModelPack,
  createGameModelPack,
  findPackByName,
  packSummary,
  removeGameModelPack,
  sortPacksByUpdatedAtDesc,
  upsertGameModelPack,
} from "./gameModelPacks";
import type { GameModelState } from "@/types/gameModel";
import type { PositionSystemState } from "@/types/positionSystem";

const gameModel: GameModelState = {
  templates: [{ id: "t1", title: "Pressing", level: 0, priority: "key" }],
  nodes: [{ id: "n1", templateId: "t1", phaseId: "defense", parentId: null, order: 0 }],
};

const positionSystem: PositionSystemState = {
  nodes: [
    {
      id: "p1",
      positionId: "CB",
      phaseId: "defense",
      templateId: "t1",
      parentIds: [],
      order: 0,
    },
  ],
};

const pack = createGameModelPack({
  id: "pack1",
  name: "  Model U17  ",
  gameModel,
  positionSystem,
  now: 1000,
});

assert.equal(pack.name, "Model U17");
assert.equal(pack.createdAt, 1000);
assert.equal(pack.gameModel.templates[0].title, "Pressing");
assert.notStrictEqual(pack.gameModel.templates, gameModel.templates);

const summary = packSummary(pack);
assert.equal(summary.templateCount, 1);
assert.equal(summary.gameNodeCount, 1);
assert.equal(summary.positionNodeCount, 1);

const applied = applyGameModelPack(pack);
assert.equal(applied.gameModel.nodes[0].phaseId, "defense");
assert.equal(applied.positionSystem.nodes[0].positionId, "CB");
assert.notStrictEqual(applied.gameModel, pack.gameModel);

const packs = upsertGameModelPack([], pack);
assert.equal(packs.length, 1);
assert.ok(findPackByName(packs, "model u17"));
assert.equal(findPackByName(packs, "brak"), undefined);

const updated = createGameModelPack({
  id: "pack1",
  name: "Model U17 v2",
  gameModel,
  positionSystem,
  now: 2000,
});
const afterUpsert = upsertGameModelPack(packs, updated);
assert.equal(afterUpsert.length, 1);
assert.equal(afterUpsert[0].name, "Model U17 v2");

const sorted = sortPacksByUpdatedAtDesc([
  { ...pack, id: "a", updatedAt: 1 },
  { ...pack, id: "b", updatedAt: 3 },
  { ...pack, id: "c", updatedAt: 2 },
]);
assert.deepEqual(
  sorted.map((p) => p.id),
  ["b", "c", "a"]
);

assert.equal(removeGameModelPack(afterUpsert, "pack1").length, 0);

console.log("gameModelPacks.test.ts: OK");
