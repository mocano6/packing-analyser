import assert from "node:assert/strict";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import { buildStatsBombCorrelation } from "./statsbombCorrelation";
import {
  buildStatsBombCorrelationTree,
  countCorrelationTreeLeaves,
  DEFAULT_CORRELATION_TREE_BRANCH_FACTOR,
  DEFAULT_CORRELATION_TREE_DEPTH,
  layoutCorrelationTree,
} from "./statsBombCorrelationTree";

const csv =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Goals Conceded,Opposition xG,Pressures,Game Week,Game SBD ID\n" +
  "Jagiellonia Białystok vs. A,2026-01-01,2.0,3,20,0,0.5,100,1,1\n" +
  "Jagiellonia Białystok vs. B,2026-01-08,1.0,1,10,1,1.0,50,2,2\n" +
  "Jagiellonia Białystok vs. C,2026-01-15,0.5,0,5,2,2.0,30,3,3\n";

const rows = parseStatsBombMatchStatsCsv(csv);
const corr = buildStatsBombCorrelation(rows, 3);
assert.ok(corr);

const goalsTree = buildStatsBombCorrelationTree(corr!, "sb_goals");
assert.ok(goalsTree);
assert.equal(goalsTree!.metricId, "sb_goals");
assert.equal(goalsTree!.rFromParent, null);
assert.ok(goalsTree!.children.length > 0);
assert.ok(goalsTree!.children.every((child) => child.rFromParent !== null));

const visitedPaths = new Set<string>();
function collectPathIds(node: typeof goalsTree, path: Set<string>): void {
  assert.ok(node);
  assert.ok(!path.has(node.metricId), "metric must not repeat on a single branch");
  path.add(node.metricId);
  for (const child of node.children) collectPathIds(child, new Set(path));
}
collectPathIds(goalsTree, visitedPaths);

const shallowTree = buildStatsBombCorrelationTree(corr!, "sb_goals", { maxDepth: 1 });
assert.ok(shallowTree);
assert.ok(shallowTree!.children.length > 0);
assert.ok(shallowTree!.children.every((child) => child.children.length === 0));

const limitedTree = buildStatsBombCorrelationTree(corr!, "sb_gd", {
  maxDepth: DEFAULT_CORRELATION_TREE_DEPTH,
  branchFactor: DEFAULT_CORRELATION_TREE_BRANCH_FACTOR,
});
assert.ok(limitedTree);
for (const child of limitedTree!.children) {
  assert.ok(child.children.length <= DEFAULT_CORRELATION_TREE_BRANCH_FACTOR);
}

const layout = layoutCorrelationTree(limitedTree!);
assert.equal(layout.nodes.length, countTreeNodes(limitedTree!));
assert.equal(layout.edges.length, layout.nodes.length - 1);
assert.ok(layout.width > 0 && layout.height > 0);
assert.equal(layout.leafCount, countCorrelationTreeLeaves(limitedTree!));

function countTreeNodes(node: NonNullable<typeof limitedTree>): number {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

console.log("statsBombCorrelationTree tests: OK");
