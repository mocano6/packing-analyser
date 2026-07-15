import assert from "assert";
import {
  buildPositionSystemTaskDocument,
  buildSanitizedPositionSystemState,
  migratePositionSystemFromFirestore,
} from "./positionSystemFirestore";
import type { PositionSystemState } from "@/types/positionSystem";

const state: PositionSystemState = {
  nodes: [
    {
      id: "n1",
      templateId: "a",
      positionId: "CB",
      phaseId: "defense",
      parentId: null,
      order: 0,
    },
  ],
};

const inner = buildSanitizedPositionSystemState(state);
assert.ok(Array.isArray(inner.nodes));
assert.equal((inner.nodes as unknown[]).length, 1);
assert.ok(!("templates" in inner));

const doc = buildPositionSystemTaskDocument(state, 1_700_000_000_000);
assert.ok(typeof doc.stateJson === "string");
assert.equal(doc.version, 2);

const migrated = migratePositionSystemFromFirestore({
  stateJson: doc.stateJson as string,
  version: 2,
});
assert.equal(migrated.nodes[0].positionId, "CB");
assert.equal(migrated.nodes[0].phaseId, "defense");

const legacy = migratePositionSystemFromFirestore({
  stateJson: JSON.stringify({
    templates: [{ id: "legacy-t", title: "Old", level: 0 }],
    nodes: [
      {
        id: "n1",
        templateId: "a",
        positionId: "CB",
        phaseId: "attack",
        parentId: null,
        order: 0,
      },
    ],
  }),
  version: 1,
});
assert.equal(legacy.nodes.length, 1);
assert.equal(legacy.nodes[0].phaseId, "attack");

console.log("positionSystemFirestore.test.ts: OK");
