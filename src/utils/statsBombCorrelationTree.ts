import type { CorrelationMatrixAxisSide } from "./correlationMatrixAxis";
import type { StatsBombCorrelationResult, StatsBombMetric } from "./statsbombCorrelation";

export type CorrelationTreeNode = {
  /** Unikalny identyfikator węzła w drzewie (ścieżka od korzenia). */
  nodeId: string;
  metricId: string;
  label: string;
  axisSide: CorrelationMatrixAxisSide;
  description?: string;
  rFromParent: number | null;
  children: CorrelationTreeNode[];
};

export type CorrelationTreeLayoutNode = {
  id: string;
  metricId: string;
  label: string;
  axisSide: CorrelationMatrixAxisSide;
  description?: string;
  rFromParent: number | null;
  depth: number;
  x: number;
  y: number;
  parentId: string | null;
};

export type CorrelationTreeEdge = {
  fromId: string;
  toId: string;
  r: number;
};

export type CorrelationTreeLayout = {
  nodes: CorrelationTreeLayoutNode[];
  edges: CorrelationTreeEdge[];
  width: number;
  height: number;
  leafCount: number;
};

export const DEFAULT_CORRELATION_TREE_DEPTH = 3;
export const DEFAULT_CORRELATION_TREE_BRANCH_FACTOR = 4;

export type BuildStatsBombCorrelationTreeOptions = {
  maxDepth?: number;
  branchFactor?: number;
  minAbsR?: number;
};

function getSymmetricCorrelation(
  matrix: (number | null)[][],
  indexA: number,
  indexB: number,
): number | null {
  if (indexA === indexB) return 1;
  const direct = matrix[indexA]?.[indexB];
  if (direct != null) return direct;
  return matrix[indexB]?.[indexA] ?? null;
}

function buildNode(
  data: StatsBombCorrelationResult,
  metricIndex: number,
  metric: StatsBombMetric,
  nodeId: string,
  depth: number,
  visited: Set<string>,
  rFromParent: number | null,
  maxDepth: number,
  branchFactor: number,
  minAbsR: number,
): CorrelationTreeNode {
  const node: CorrelationTreeNode = {
    nodeId,
    metricId: metric.id,
    label: metric.label,
    axisSide: metric.axisSide,
    description: metric.description,
    rFromParent,
    children: [],
  };

  if (depth >= maxDepth) return node;

  const nextVisited = new Set(visited);
  nextVisited.add(metric.id);

  const candidates: { metric: StatsBombMetric; index: number; r: number }[] = [];
  for (let i = 0; i < data.metrics.length; i++) {
    const candidate = data.metrics[i];
    if (nextVisited.has(candidate.id)) continue;
    const r = getSymmetricCorrelation(data.matrix, metricIndex, i);
    if (r === null || Math.abs(r) < minAbsR) continue;
    candidates.push({ metric: candidate, index: i, r });
  }

  candidates.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  node.children = candidates.slice(0, branchFactor).map(({ metric: child, index, r }) =>
    buildNode(
      data,
      index,
      child,
      `${nodeId}>${child.id}`,
      depth + 1,
      nextVisited,
      r,
      maxDepth,
      branchFactor,
      minAbsR,
    ),
  );

  return node;
}

export function buildStatsBombCorrelationTree(
  data: StatsBombCorrelationResult,
  rootMetricId: string,
  options: BuildStatsBombCorrelationTreeOptions = {},
): CorrelationTreeNode | null {
  const rootIndex = data.metrics.findIndex((metric) => metric.id === rootMetricId);
  if (rootIndex < 0) return null;
  const rootMetric = data.metrics[rootIndex];
  const maxDepth = options.maxDepth ?? DEFAULT_CORRELATION_TREE_DEPTH;
  const branchFactor = options.branchFactor ?? DEFAULT_CORRELATION_TREE_BRANCH_FACTOR;
  const minAbsR = options.minAbsR ?? 0;

  return buildNode(
    data,
    rootIndex,
    rootMetric,
    rootMetric.id,
    0,
    new Set<string>(),
    null,
    maxDepth,
    branchFactor,
    minAbsR,
  );
}

export function countCorrelationTreeLeaves(node: CorrelationTreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countCorrelationTreeLeaves(child), 0);
}

const NODE_WIDTH = 148;
const NODE_HEIGHT = 34;
const COLUMN_GAP = 108;
const ROW_GAP = 10;
const PADDING = 28;

export function layoutCorrelationTree(root: CorrelationTreeNode): CorrelationTreeLayout {
  const nodes: CorrelationTreeLayoutNode[] = [];
  const edges: CorrelationTreeEdge[] = [];
  let leafCounter = 0;

  function assign(node: CorrelationTreeNode, depth: number, parentId: string | null): number {
    let y: number;
    if (node.children.length === 0) {
      y = PADDING + leafCounter * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT / 2;
      leafCounter += 1;
    } else {
      const childYs = node.children.map((child) => assign(child, depth + 1, node.nodeId));
      y = childYs.reduce((sum, value) => sum + value, 0) / childYs.length;
    }

    nodes.push({
      id: node.nodeId,
      metricId: node.metricId,
      label: node.label,
      axisSide: node.axisSide,
      description: node.description,
      rFromParent: node.rFromParent,
      depth,
      x: PADDING + depth * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2,
      y,
      parentId,
    });

    if (parentId !== null && node.rFromParent !== null) {
      edges.push({ fromId: parentId, toId: node.nodeId, r: node.rFromParent });
    }

    return y;
  }

  assign(root, 0, null);

  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0);
  const width = PADDING * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP;
  const height = PADDING * 2 + Math.max(leafCounter, 1) * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;

  return { nodes, edges, width, height, leafCount: leafCounter };
}

export function getCorrelationTreeLayoutConstants() {
  return { NODE_WIDTH, NODE_HEIGHT, COLUMN_GAP, ROW_GAP, PADDING };
}
