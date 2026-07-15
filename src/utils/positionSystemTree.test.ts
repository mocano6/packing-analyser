import assert from "assert";
import {
  applyPositionTemplateLibraryUpdateWithCascade,
  buildPositionSystemTree,
  canDropPositionTemplateOnTarget,
  countPositionTemplateUsage,
  removeAllPositionNodesForTemplate,
  filterNodesForPositionAndPhase,
  movePositionNodeWithSubtree,
  nextOrderForPositionParent,
  nodesRemovedByPositionTemplateLevelChange,
  validatePositionTemplateLibraryUpdate,
  validatePositionTemplatePlacement,
  wouldCreatePositionCycle,
} from "./positionSystemTree";
import type { GameModelNode, GameModelRuleTemplate } from "@/types/gameModel";
import type { PositionTaskNode } from "@/types/positionSystem";

const templates: GameModelRuleTemplate[] = [
  { id: "t1", title: "Utrzymanie linii", level: 0 },
  { id: "t2", title: "Komunikacja z partnerem", level: 1 },
  { id: "t3", title: "Sygnalizacja offside", level: 2 },
];

const nodes: PositionTaskNode[] = [
  {
    id: "n1",
    templateId: "t1",
    positionId: "CB",
    phaseId: "defense",
    parentId: null,
    order: 0,
  },
  {
    id: "n2",
    templateId: "t2",
    positionId: "CB",
    phaseId: "defense",
    parentId: "n1",
    order: 0,
  },
  {
    id: "n3",
    templateId: "t2",
    positionId: "CB",
    phaseId: "attack",
    parentId: null,
    order: 0,
  },
  {
    id: "n4",
    templateId: "t3",
    positionId: "CB",
    phaseId: "defense",
    parentId: "n2",
    order: 0,
  },
];

const defenseTree = buildPositionSystemTree(
  filterNodesForPositionAndPhase(nodes, "CB", "defense")
);
assert.equal(defenseTree.length, 1);
assert.equal(defenseTree[0].children.length, 1);
assert.equal(defenseTree[0].children[0].templateId, "t2");

assert.equal(canDropPositionTemplateOnTarget(templates[0], null, templates), true);
assert.equal(canDropPositionTemplateOnTarget(templates[1], null, templates), false);
assert.equal(canDropPositionTemplateOnTarget(templates[1], nodes[0], templates), true);

assert.equal(nextOrderForPositionParent(nodes, "CB", "defense", "n1"), 1);
assert.equal(countPositionTemplateUsage(nodes, "t2"), 2);

const titleOk = validatePositionTemplateLibraryUpdate(templates, "t1", {
  title: "Nowa linia",
  level: 0,
});
assert.equal(titleOk.ok, true);

const deleted = removeAllPositionNodesForTemplate(nodes, "t2");
assert.equal(deleted.length, 1);
assert.ok(!deleted.some((n) => n.templateId === "t2"));

const demoteRemoved = nodesRemovedByPositionTemplateLevelChange(nodes, templates, "t2", {
  title: "Komunikacja",
  level: 0,
});
assert.ok(demoteRemoved.includes("n2"));
assert.ok(demoteRemoved.includes("n4"));
assert.ok(!demoteRemoved.includes("n3"));

const cascaded = applyPositionTemplateLibraryUpdateWithCascade(templates, nodes, "t2", {
  title: "Komunikacja",
  level: 0,
});
assert.equal(cascaded.templates.find((t) => t.id === "t2")?.level, 0);
assert.ok(!cascaded.nodes.some((n) => n.id === "n2"));

assert.equal(wouldCreatePositionCycle(nodes, "n1", "n2"), true);

const placementOk = validatePositionTemplatePlacement(
  nodes,
  templates[0],
  { positionId: "CB", phaseId: "attack", parentId: null },
  templates
);
assert.equal(placementOk.ok, true);

const moved = movePositionNodeWithSubtree(
  nodes,
  "n1",
  { positionId: "GK", phaseId: "defense", parentId: null },
  templates
);
assert.equal(moved.ok, true);
assert.ok(moved.ok && moved.nodes.find((n) => n.id === "n1")?.positionId === "GK");

console.log("positionSystemTree.test.ts: OK");
