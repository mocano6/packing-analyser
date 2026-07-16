import assert from "assert";
import {
  buildGameModelPacksTaskDocument,
  buildSanitizedGameModelPacksState,
  migrateGameModelPacksFromFirestore,
} from "./gameModelPacksFirestore";
import type { GameModelPacksState } from "@/types/gameModelPack";

const state: GameModelPacksState = {
  packs: [
    {
      id: "p1",
      name: "  Bazowy model  ",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_100,
      gameModel: {
        templates: [
          {
            id: "t1",
            title: "Blok",
            level: 0,
            description: "  Linia  ",
            trigger: "strata",
            priority: "key",
          },
        ],
        nodes: [
          { id: "n1", templateId: "t1", phaseId: "defense", parentId: null, order: 0 },
        ],
      },
      positionSystem: {
        nodes: [
          {
            id: "pos1",
            positionId: "CB",
            phaseId: "defense",
            templateId: "t1",
            parentIds: [],
            order: 0,
          },
        ],
      },
    },
  ],
};

const sanitized = buildSanitizedGameModelPacksState(state);
assert.equal((sanitized.packs as unknown[]).length, 1);
const pack = (sanitized.packs as Record<string, unknown>[])[0];
assert.equal(pack.name, "Bazowy model");
const gm = pack.gameModel as { templates: Record<string, unknown>[]; nodes: unknown[] };
assert.equal(gm.templates[0].description, "Linia");
assert.equal(gm.nodes.length, 1);

const doc = buildGameModelPacksTaskDocument(state, 1_700_000_000_200);
assert.ok(typeof doc.stateJson === "string");
assert.equal(doc.version, 1);

const migrated = migrateGameModelPacksFromFirestore({
  stateJson: doc.stateJson as string,
  version: 1,
});
assert.equal(migrated.packs.length, 1);
assert.equal(migrated.packs[0].name, "Bazowy model");
assert.equal(migrated.packs[0].gameModel.templates[0].priority, "key");
assert.equal(migrated.packs[0].gameModel.nodes.length, 1);
assert.equal(migrated.packs[0].positionSystem.nodes[0].positionId, "CB");

const withLegacyPhase = migrateGameModelPacksFromFirestore({
  stateJson: JSON.stringify({
    packs: [
      {
        id: "legacy",
        name: "Legacy",
        createdAt: 1,
        updatedAt: 1,
        gameModel: {
          templates: [{ id: "t1", title: "X", level: 0 }],
          nodes: [
            { id: "n1", templateId: "t1", phaseId: "defense", parentId: null, order: 0 },
            { id: "n2", templateId: "t1", phaseId: "transition_a2d", parentId: null, order: 0 },
          ],
        },
        positionSystem: { nodes: [] },
      },
    ],
  }),
  version: 1,
});
assert.equal(withLegacyPhase.packs[0].gameModel.nodes.length, 1);

const empty = migrateGameModelPacksFromFirestore({ stateJson: "{}", version: 1 });
assert.equal(empty.packs.length, 0);

const dropped = migrateGameModelPacksFromFirestore({
  stateJson: JSON.stringify({
    packs: [{ id: "", name: "x", gameModel: { templates: [], nodes: [] }, positionSystem: { nodes: [] } }],
  }),
  version: 1,
});
assert.equal(dropped.packs.length, 0);

console.log("gameModelPacksFirestore.test.ts: OK");
