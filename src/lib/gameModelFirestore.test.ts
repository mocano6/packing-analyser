import assert from "assert";
import {
  buildGameModelTaskDocument,
  buildSanitizedGameModelState,
  migrateGameModelFromFirestore,
} from "./gameModelFirestore";
import type { GameModelState } from "@/types/gameModel";

const state: GameModelState = {
  templates: [{ id: "a", title: "Test", level: 0 }],
  nodes: [
    {
      id: "n1",
      templateId: "a",
      phaseId: "defense",
      parentId: null,
      order: 0,
    },
  ],
};

const inner = buildSanitizedGameModelState(state);
assert.ok(Array.isArray(inner.templates));
assert.equal((inner.templates as unknown[]).length, 1);
assert.equal((inner.nodes as unknown[]).length, 1);

const doc = buildGameModelTaskDocument(state, 1_700_000_000_000);
assert.ok(typeof doc.stateJson === "string");
assert.equal(doc.version, 2);

const migrated = migrateGameModelFromFirestore({
  stateJson: doc.stateJson as string,
  version: 1,
});
assert.equal(migrated.templates[0].title, "Test");
assert.equal(migrated.nodes[0].phaseId, "defense");

const legacyAttack = migrateGameModelFromFirestore({
  stateJson: JSON.stringify({
    templates: [{ id: "a", title: "Legacy", level: 0 }],
    nodes: [
      { id: "n1", templateId: "a", phaseId: "attack", parentId: null, order: 0 },
      { id: "n2", templateId: "a", phaseId: "transition_a2d", parentId: null, order: 0 },
      { id: "n3", templateId: "a", phaseId: "defense", parentId: null, order: 0 },
    ],
  }),
  version: 1,
});
assert.equal(legacyAttack.nodes.length, 2);
assert.ok(legacyAttack.nodes.some((n) => n.phaseId === "attack"));
assert.ok(legacyAttack.nodes.some((n) => n.phaseId === "defense"));

console.log("gameModelFirestore.test.ts: OK");
