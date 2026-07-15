import assert from "assert";
import type { GameModelNode, GameModelRuleTemplate } from "@/types/gameModel";
import type { PositionTaskNode } from "@/types/positionSystem";
import {
  copyGameModelPhaseToPositionPhase,
  copyGameModelPhasesToPosition,
  copyGameModelSubtreeToPositionTarget,
  countPositionPhaseNodes,
} from "./positionSystemTree";

const templates: GameModelRuleTemplate[] = [
  { id: "t1", title: "Zasada 1", level: 0 },
  { id: "t2", title: "Sub-zasada", level: 1 },
  { id: "t3", title: "Atak", level: 0 },
  { id: "t9", title: "Stara", level: 0 },
];

let idCounter = 0;
function createNodeId(): string {
  idCounter += 1;
  return `new-${idCounter}`;
}

const gameModelNodes: GameModelNode[] = [
  { id: "g1", templateId: "t1", phaseId: "defense", parentId: null, order: 0 },
  { id: "g2", templateId: "t2", phaseId: "defense", parentId: "g1", order: 0 },
  { id: "g3", templateId: "t3", phaseId: "attack", parentId: null, order: 0 },
];

const existingPosition: PositionTaskNode[] = [
  {
    id: "p-old",
    templateId: "t9",
    positionId: "CB",
    phaseId: "defense",
    parentId: null,
    order: 0,
  },
];

const defenseCopy = copyGameModelPhaseToPositionPhase(
  gameModelNodes,
  existingPosition,
  "CB",
  "defense",
  createNodeId
);
assert.equal(defenseCopy.copiedCount, 2);
assert.equal(countPositionPhaseNodes(defenseCopy.nodes, "CB", "defense"), 2);
assert.ok(!defenseCopy.nodes.some((n) => n.id === "p-old"));
assert.ok(defenseCopy.nodes.some((n) => n.templateId === "t1" && n.parentId === null));
const t1Node = defenseCopy.nodes.find((n) => n.templateId === "t1");
const t2Node = defenseCopy.nodes.find((n) => n.templateId === "t2");
assert.ok(t1Node && t2Node);
assert.equal(t2Node.parentId, t1Node!.id);

idCounter = 0;
const allCopy = copyGameModelPhasesToPosition(gameModelNodes, [], "GK", createNodeId);
assert.equal(allCopy.copiedCount, 3);
assert.equal(countPositionPhaseNodes(allCopy.nodes, "GK", "defense"), 2);
assert.equal(countPositionPhaseNodes(allCopy.nodes, "GK", "attack"), 1);

idCounter = 0;
const subtreeCopyInvalid = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  [],
  templates,
  "g2",
  { positionId: "CB", phaseId: "defense", parentId: null },
  createNodeId
);
assert.equal(subtreeCopyInvalid.ok, false);

const subtreeWithParent = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  [],
  templates,
  "g1",
  { positionId: "CB", phaseId: "defense", parentId: null },
  createNodeId
);
assert.equal(subtreeWithParent.ok, true);
if (subtreeWithParent.ok) {
  assert.equal(subtreeWithParent.copiedCount, 2);
  const root = subtreeWithParent.nodes.find((n) => n.templateId === "t1");
  const child = subtreeWithParent.nodes.find((n) => n.templateId === "t2");
  assert.ok(root && child);
  assert.equal(child.parentId, root.id);
}

const wrongPhase = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  [],
  templates,
  "g1",
  { positionId: "CB", phaseId: "attack", parentId: null },
  createNodeId
);
assert.equal(wrongPhase.ok, false);

console.log("copyGameModelToPosition.test.ts: OK");
