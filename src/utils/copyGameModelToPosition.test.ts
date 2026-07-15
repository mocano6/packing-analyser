import assert from "assert";
import type { GameModelNode, GameModelRuleTemplate } from "@/types/gameModel";
import type { PositionTaskNode } from "@/types/positionSystem";
import {
  copyGameModelPhaseToPositionPhase,
  copyGameModelPhasesToPosition,
  copyGameModelSubtreeToPositionTarget,
  countPositionPhaseNodes,
  dedupePositionNodesByTemplate,
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
  { id: "g3c", templateId: "t2", phaseId: "attack", parentId: "g3", order: 0 },
  { id: "g4", templateId: "t1", phaseId: "attack", parentId: null, order: 1 },
  { id: "g5", templateId: "t2", phaseId: "attack", parentId: "g4", order: 0 },
];

const existingPosition: PositionTaskNode[] = [
  {
    id: "p-old",
    templateId: "t9",
    positionId: "CB",
    phaseId: "defense",
    parentIds: [],
    order: 0,
  },
];

const defenseCopy = copyGameModelPhaseToPositionPhase(
  gameModelNodes,
  existingPosition,
  "CB",
  "defense",
  createNodeId,
  templates
);
assert.equal(defenseCopy.copiedCount, 2);
assert.equal(countPositionPhaseNodes(defenseCopy.nodes, "CB", "defense"), 2);
assert.ok(!defenseCopy.nodes.some((n) => n.id === "p-old"));
assert.ok(defenseCopy.nodes.some((n) => n.templateId === "t1" && n.parentIds.length === 0));
const t1Node = defenseCopy.nodes.find((n) => n.templateId === "t1");
const t2Node = defenseCopy.nodes.find((n) => n.templateId === "t2");
assert.ok(t1Node && t2Node);
assert.equal(t2Node.parentIds[0], t1Node!.id);

idCounter = 0;
const allCopy = copyGameModelPhasesToPosition(
  gameModelNodes,
  [],
  "GK",
  createNodeId,
  templates
);
assert.equal(allCopy.copiedCount, 5);
assert.equal(countPositionPhaseNodes(allCopy.nodes, "GK", "defense"), 2);
assert.equal(countPositionPhaseNodes(allCopy.nodes, "GK", "attack"), 3);

idCounter = 0;
const firstAttackP3 = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  [],
  templates,
  "g3",
  { positionId: "CB", phaseId: "attack", parentId: null },
  createNodeId
);
assert.equal(firstAttackP3.ok, true);

idCounter = 100;
const secondAttackP3 = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  firstAttackP3.ok ? firstAttackP3.nodes : [],
  templates,
  "g4",
  { positionId: "CB", phaseId: "attack", parentId: null },
  createNodeId
);
assert.equal(secondAttackP3.ok, true);
if (secondAttackP3.ok) {
  const sharedSub = secondAttackP3.nodes.filter((n) => n.templateId === "t2");
  assert.equal(sharedSub.length, 1);
  assert.equal(sharedSub[0]?.parentIds.length, 2);
}

const subtreeCopyInvalid = copyGameModelSubtreeToPositionTarget(
  gameModelNodes,
  [],
  templates,
  "g2",
  { positionId: "CB", phaseId: "defense", parentId: null },
  createNodeId
);
assert.equal(subtreeCopyInvalid.ok, false);

const dedupeResult = dedupePositionNodesByTemplate([
  { id: "a", templateId: "t1", positionId: "ST", phaseId: "attack", parentIds: [], order: 0 },
  { id: "b", templateId: "t1", positionId: "ST", phaseId: "attack", parentIds: [], order: 1 },
  { id: "c", templateId: "t2", positionId: "ST", phaseId: "attack", parentIds: ["a"], order: 0 },
  { id: "d", templateId: "t2", positionId: "ST", phaseId: "attack", parentIds: ["b"], order: 0 },
]);
assert.equal(dedupeResult.filter((n) => n.templateId === "t2").length, 1);
assert.equal(dedupeResult.find((n) => n.templateId === "t2")?.parentIds.length, 2);

console.log("copyGameModelToPosition.test.ts: OK");
