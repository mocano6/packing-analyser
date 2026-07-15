import assert from "assert";
import {
  applyPositionTemplateLibraryUpdateWithCascade,
  buildPositionPhaseGraphLayout,
  buildPositionSystemTree,
  canDropPositionTemplateOnTarget,
  countPositionTemplateUsage,
  countUniquePositionTemplates,
  dedupePositionNodesByTemplate,
  filterNodesForPositionAndPhase,
  linkPositionNodeToParent,
  movePositionNodeWithSubtree,
  nextOrderForPositionParent,
  nodesRemovedByPositionTemplateLevelChange,
  placePositionTemplate,
  removeAllPositionNodesForTemplate,
  validatePositionTemplateLibraryUpdate,
  validatePositionTemplatePlacement,
  wouldCreatePositionCycle,
} from "./positionSystemTree";
import type { GameModelRuleTemplate } from "@/types/gameModel";
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
    parentIds: [],
    order: 0,
  },
  {
    id: "n2",
    templateId: "t2",
    positionId: "CB",
    phaseId: "defense",
    parentIds: ["n1"],
    order: 0,
  },
  {
    id: "n3",
    templateId: "t2",
    positionId: "CB",
    phaseId: "attack",
    parentIds: [],
    order: 0,
  },
  {
    id: "n4",
    templateId: "t3",
    positionId: "CB",
    phaseId: "defense",
    parentIds: ["n2"],
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
assert.equal(countUniquePositionTemplates(nodes, "CB", "defense"), 3);

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

let idCounter = 0;
const createId = () => `new-${++idCounter}`;

const linked = placePositionTemplate(
  [
    ...nodes,
    {
      id: "n1b",
      templateId: "t1",
      positionId: "CB",
      phaseId: "defense",
      parentIds: [],
      order: 1,
    },
  ],
  templates[1],
  { positionId: "CB", phaseId: "defense", parentId: "n1b" },
  templates,
  createId
);
assert.equal(linked.ok, true);
if (linked.ok) {
  assert.equal(linked.linked, true);
  assert.equal(linked.nodeId, "n2");
}

const dedupeSource: PositionTaskNode[] = [
  { id: "p1", templateId: "t1", positionId: "GK", phaseId: "attack", parentIds: [], order: 0 },
  { id: "p2", templateId: "t1", positionId: "GK", phaseId: "attack", parentIds: [], order: 1 },
  {
    id: "c1",
    templateId: "t2",
    positionId: "GK",
    phaseId: "attack",
    parentIds: ["p1"],
    order: 0,
  },
  {
    id: "c2",
    templateId: "t2",
    positionId: "GK",
    phaseId: "attack",
    parentIds: ["p2"],
    order: 0,
  },
];
const deduped = dedupePositionNodesByTemplate(dedupeSource);
assert.equal(deduped.filter((n) => n.templateId === "t2").length, 1);
const sharedChild = deduped.find((n) => n.templateId === "t2");
assert.ok(sharedChild);
assert.deepEqual(new Set(sharedChild!.parentIds), new Set(["p1", "p2"]));

const linkedNodes = linkPositionNodeToParent(deduped, sharedChild!.id, "p2");
assert.equal(
  linkedNodes.find((n) => n.id === sharedChild!.id)?.parentIds.filter((id) => id === "p2").length,
  1
);

const graphLayout = buildPositionPhaseGraphLayout(
  [
    { id: "p1", templateId: "t1", positionId: "GK", phaseId: "attack", parentIds: [], order: 0 },
    { id: "p2", templateId: "t1", positionId: "GK", phaseId: "attack", parentIds: [], order: 1 },
    {
      id: "c1",
      templateId: "t2",
      positionId: "GK",
      phaseId: "attack",
      parentIds: ["p1", "p2"],
      order: 0,
    },
    {
      id: "e1",
      templateId: "t3",
      positionId: "GK",
      phaseId: "attack",
      parentIds: ["p1"],
      order: 0,
    },
  ],
  templates
);
assert.equal(graphLayout.layers.length, 3);
assert.equal(graphLayout.layers[0]?.nodes.length, 2);
assert.equal(graphLayout.layers[1]?.nodes.length, 1);
assert.equal(graphLayout.layers[2]?.nodes.length, 1);
assert.equal(graphLayout.edges.length, 3);
assert.ok(graphLayout.edges.some((e) => e.fromId === "p1" && e.toId === "c1"));
assert.ok(graphLayout.edges.some((e) => e.fromId === "p2" && e.toId === "c1"));

console.log("positionSystemTree.test.ts: OK");
