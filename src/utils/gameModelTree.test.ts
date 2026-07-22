import assert from "assert";
import {
  applyTemplateLibraryUpdate,
  applyTemplateLibraryUpdateWithCascade,
  buildGameModelTree,
  buildTemplateUsageCounts,
  canDropTemplateOnTarget,
  countTemplateUsage,
  deleteTemplateFromLibrary,
  groupTemplatesByLevel,
  hasDuplicateTemplateUnderParent,
  moveModelNodeWithSubtree,
  nextOrderForParent,
  nodesRemovedByTemplateLevelChange,
  removeAllNodesForTemplate,
  validateNodeMove,
  validateTemplateLibraryUpdate,
  collectDescendantTemplatesForDrop,
  filterTemplatesByPhase,
  templatePhaseIds,
  templatesToAssignOnMicrocycleDrop,
  validateTemplatePlacement,
  wouldCreateCycle,
} from "./gameModelTree";
import type { GameModelNode, GameModelRuleTemplate } from "@/types/gameModel";

const templates: GameModelRuleTemplate[] = [
  { id: "t1", title: "Pressing", level: 0 },
  { id: "t2", title: "Wysoki pressing", level: 1 },
  { id: "t3", title: "Trigger na bramkarzu", level: 2 },
];

const nodes: GameModelNode[] = [
  { id: "n1", templateId: "t1", phaseId: "defense", parentId: null, order: 0 },
  { id: "n2", templateId: "t2", phaseId: "defense", parentId: "n1", order: 0 },
  { id: "n3", templateId: "t2", phaseId: "attack", parentId: null, order: 0 },
  { id: "n4", templateId: "t3", phaseId: "defense", parentId: "n2", order: 0 },
];

const tree = buildGameModelTree(nodes.filter((n) => n.phaseId === "defense"));
assert.equal(tree.length, 1);
assert.equal(tree[0].children.length, 1);
assert.equal(tree[0].children[0].templateId, "t2");

assert.equal(canDropTemplateOnTarget(templates[0], null, templates), true);
assert.equal(canDropTemplateOnTarget(templates[1], null, templates), false);
assert.equal(canDropTemplateOnTarget(templates[1], nodes[0], templates), true);

assert.equal(nextOrderForParent(nodes, "defense", "n1"), 1);
assert.equal(countTemplateUsage(nodes, "t2"), 2);

const titleOk = validateTemplateLibraryUpdate(templates, nodes, "t1", {
  title: "Nowy pressing",
  level: 0,
});
assert.equal(titleOk.ok, true);

// Pola merytoryczne: patch je stosuje...
const enriched = applyTemplateLibraryUpdate(templates, "t1", {
  title: "Pressing",
  level: 0,
  description: "  Wysoko i agresywnie  ",
  trigger: "strata w ataku",
  priority: "key",
});
const enrichedT1 = enriched.find((t) => t.id === "t1");
assert.equal(enrichedT1?.description, "Wysoko i agresywnie");
assert.equal(enrichedT1?.trigger, "strata w ataku");
assert.equal(enrichedT1?.priority, "key");

// ...a patch bez tych pól (np. zmiana poziomu przez drag) je zachowuje.
const levelOnly = applyTemplateLibraryUpdate(enriched, "t1", {
  title: "Pressing",
  level: 0,
});
const preservedT1 = levelOnly.find((t) => t.id === "t1");
assert.equal(preservedT1?.description, "Wysoko i agresywnie");
assert.equal(preservedT1?.priority, "key");

// Pusty patch pola czyści wartość.
const cleared = applyTemplateLibraryUpdate(enriched, "t1", {
  title: "Pressing",
  level: 0,
  description: "",
  priority: undefined,
});
const clearedT1 = cleared.find((t) => t.id === "t1");
assert.equal(clearedT1?.description, undefined);
assert.equal(clearedT1?.trigger, "strata w ataku");

const deleted = deleteTemplateFromLibrary(templates, nodes, "t2");
assert.equal(deleted.templates.length, 2);
assert.equal(deleted.removedNodeCount, 3);
assert.ok(!deleted.nodes.some((n) => n.templateId === "t2"));

const demoteRemoved = nodesRemovedByTemplateLevelChange(nodes, templates, "t2", {
  title: "Wysoki pressing",
  level: 0,
});
assert.ok(demoteRemoved.includes("n2"));
assert.ok(demoteRemoved.includes("n4"));
assert.ok(!demoteRemoved.includes("n3"));

const cascaded = applyTemplateLibraryUpdateWithCascade(templates, nodes, "t2", {
  title: "Wysoki pressing",
  level: 0,
});
assert.equal(cascaded.templates.find((t) => t.id === "t2")?.level, 0);
assert.ok(!cascaded.nodes.some((n) => n.id === "n2"));

const ruleDescendants = collectDescendantTemplatesForDrop(templates, nodes, "t1");
assert.equal(ruleDescendants.length, 2);
assert.ok(ruleDescendants.some((t) => t.id === "t2"));
assert.ok(ruleDescendants.some((t) => t.id === "t3"));

const subDescendants = collectDescendantTemplatesForDrop(templates, nodes, "t2");
assert.equal(subDescendants.length, 1);
assert.equal(subDescendants[0].id, "t3");

const dropList = templatesToAssignOnMicrocycleDrop(templates, nodes, "t1");
assert.equal(dropList.length, 3);
assert.equal(dropList[0].id, "t1");

assert.deepEqual(templatePhaseIds(nodes, "t1"), ["defense"]);
assert.deepEqual(templatePhaseIds(nodes, "t2"), ["defense", "attack"]);
assert.deepEqual(templatePhaseIds(nodes, "t3"), ["defense"]);
assert.equal(filterTemplatesByPhase(templates, nodes, "defense").length, 3);
assert.equal(filterTemplatesByPhase(templates, nodes, "attack").length, 1);
assert.equal(filterTemplatesByPhase(templates, nodes, "unassigned").length, 0);
assert.equal(
  filterTemplatesByPhase(
    [...templates, { id: "orphan", title: "Orphan", level: 0 }],
    nodes,
    "unassigned"
  ).length,
  1
);

const dupPlacement = validateTemplatePlacement(
  nodes,
  templates[1],
  { phaseId: "defense", parentId: "n1" },
  templates
);
assert.equal(dupPlacement.ok, false);

const subtreeMove = moveModelNodeWithSubtree(
  nodes,
  "n1",
  { phaseId: "set_pieces", parentId: null },
  templates
);
assert.equal(subtreeMove.ok, true);
if (subtreeMove.ok) {
  assert.ok(subtreeMove.nodes.filter((n) => n.phaseId === "set_pieces").map((n) => n.id).sort().join(",") === "n1,n2,n4");
  assert.equal(subtreeMove.nodes.find((n) => n.id === "n3")?.phaseId, "attack");
}

console.log("gameModelTree.test.ts: OK");
