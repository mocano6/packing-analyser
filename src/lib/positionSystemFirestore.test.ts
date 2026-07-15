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
      parentIds: [],
      order: 0,
    },
    {
      id: "n2",
      templateId: "b",
      positionId: "CB",
      phaseId: "defense",
      parentIds: ["n1", "n3"],
      order: 0,
    },
  ],
};

const inner = buildSanitizedPositionSystemState(state);
assert.ok(Array.isArray(inner.nodes));
assert.equal((inner.nodes as unknown[]).length, 2);
const firstNode = (inner.nodes as { parentIds: string[] }[])[0];
assert.ok(Array.isArray(firstNode.parentIds));
assert.ok(!("templates" in inner));

const doc = buildPositionSystemTaskDocument(state, 1_700_000_000_000);
assert.ok(typeof doc.stateJson === "string");
assert.equal(doc.version, 3);

const migrated = migratePositionSystemFromFirestore({
  stateJson: doc.stateJson as string,
  version: 3,
});
assert.equal(migrated.nodes[0].positionId, "CB");
assert.equal(migrated.nodes[0].phaseId, "defense");
assert.deepEqual(migrated.nodes[1].parentIds, ["n1", "n3"]);

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
      { id: "c1", templateId: "b", positionId: "CB", phaseId: "attack", parentId: "n1", order: 0 },
      { id: "c2", templateId: "b", positionId: "CB", phaseId: "attack", parentId: "n9", order: 0 },
    ],
  }),
  version: 2,
});
assert.equal(legacy.nodes.length, 2);
assert.equal(legacy.nodes.filter((n) => n.templateId === "b").length, 1);
assert.equal(legacy.nodes.find((n) => n.templateId === "b")?.parentIds.length, 2);

console.log("positionSystemFirestore.test.ts: OK");
