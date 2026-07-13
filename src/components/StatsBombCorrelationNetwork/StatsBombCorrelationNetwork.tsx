"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { StatsBombCorrelationResult } from "@/utils/statsbombCorrelation";
import { STATSBOMB_STRONG_CORR_THRESHOLD } from "@/utils/statsBombTeamReport";
import {
  buildStatsBombCorrelationTree,
  DEFAULT_CORRELATION_TREE_BRANCH_FACTOR,
  DEFAULT_CORRELATION_TREE_DEPTH,
  getCorrelationTreeLayoutConstants,
  layoutCorrelationTree,
  type CorrelationTreeLayoutNode,
} from "@/utils/statsBombCorrelationTree";
import styles from "./StatsBombCorrelationNetwork.module.css";

export type StatsBombCorrelationNetworkProps = {
  data: StatsBombCorrelationResult;
  rootMetricId: string;
  rootMetricLabel: string;
  onRootMetricChange: (metricId: string) => void;
};

function edgeToneClasses(r: number): { edge: string; label: string } {
  if (r >= STATSBOMB_STRONG_CORR_THRESHOLD) {
    return { edge: styles.edgeStrongPos, label: styles.edgeLabelPosStrong };
  }
  if (r <= -STATSBOMB_STRONG_CORR_THRESHOLD) {
    return { edge: styles.edgeStrongNeg, label: styles.edgeLabelNegStrong };
  }
  return { edge: "", label: "" };
}

function nodeRectClass(node: CorrelationTreeLayoutNode, isRoot: boolean): string {
  const classes = [styles.nodeRect];
  if (isRoot) classes.push(styles.nodeRectRoot);
  switch (node.axisSide) {
    case "outcome":
      classes.push(styles.nodeRectOutcome);
      break;
    case "my":
      classes.push(styles.nodeRectMy);
      break;
    case "opp":
      classes.push(styles.nodeRectOpp);
      break;
    default:
      classes.push(styles.nodeRectNeutral);
      break;
  }
  return classes.join(" ");
}

function truncateLabel(label: string, maxLength = 22): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function buildEdgePath(
  from: CorrelationTreeLayoutNode,
  to: CorrelationTreeLayoutNode,
  nodeWidth: number,
  nodeHeight: number,
): string {
  const x1 = from.x + nodeWidth / 2;
  const y1 = from.y;
  const x2 = to.x - nodeWidth / 2;
  const y2 = to.y;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

export default function StatsBombCorrelationNetwork({
  data,
  rootMetricId,
  rootMetricLabel,
  onRootMetricChange,
}: StatsBombCorrelationNetworkProps) {
  const [maxDepth, setMaxDepth] = useState(DEFAULT_CORRELATION_TREE_DEPTH);
  const [branchFactor, setBranchFactor] = useState(DEFAULT_CORRELATION_TREE_BRANCH_FACTOR);
  const layoutConstants = getCorrelationTreeLayoutConstants();

  const tree = useMemo(
    () =>
      buildStatsBombCorrelationTree(data, rootMetricId, {
        maxDepth,
        branchFactor,
      }),
    [branchFactor, data, maxDepth, rootMetricId],
  );

  const layout = useMemo(() => (tree ? layoutCorrelationTree(tree) : null), [tree]);

  const nodeById = useMemo(() => {
    const map = new Map<string, CorrelationTreeLayoutNode>();
    for (const node of layout?.nodes ?? []) {
      map.set(node.id, node);
    }
    return map;
  }, [layout]);

  const onNodeActivate = useCallback(
    (metricId: string) => {
      onRootMetricChange(metricId);
    },
    [onRootMetricChange],
  );

  const onMaxDepthChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setMaxDepth(Number(event.target.value));
  }, []);

  const onBranchFactorChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setBranchFactor(Number(event.target.value));
  }, []);

  if (!tree || !layout) {
    return <p className={styles.empty}>Nie udało się zbudować sieci korelacji.</p>;
  }

  const { NODE_WIDTH, NODE_HEIGHT } = layoutConstants;
  const depthLabels = ["Parametr główny", "Poziom 1", "Poziom 2", "Poziom 3", "Poziom 4"];

  return (
    <div className={styles.root}>
      <p className={styles.hint}>
        Sieć pokazuje najsilniejsze korelacje w dół od metryki głównej ({rootMetricLabel}). Każdy
        poziom to kolejne parametry skorelowane z rodzicem (bez powtórzeń na gałęzi). Kliknij
        węzeł, aby ustawić go jako nowy parametr główny. Grubość i kolor krawędzi: |r| ≥{" "}
        {STATSBOMB_STRONG_CORR_THRESHOLD.toFixed(2)}.
      </p>
      <div className={styles.controls}>
        <label className={styles.controlLabel} htmlFor="statsbomb-network-depth">
          Głębokość
        </label>
        <select
          id="statsbomb-network-depth"
          className={styles.controlSelect}
          value={maxDepth}
          onChange={onMaxDepthChange}
          aria-label="Głębokość drzewa korelacji"
        >
          {[2, 3, 4].map((depth) => (
            <option key={depth} value={depth}>
              {depth} poziomy
            </option>
          ))}
        </select>
        <label className={styles.controlLabel} htmlFor="statsbomb-network-branch">
          Gałęzie na poziom
        </label>
        <select
          id="statsbomb-network-branch"
          className={styles.controlSelect}
          value={branchFactor}
          onChange={onBranchFactorChange}
          aria-label="Liczba gałęzi na poziom drzewa korelacji"
        >
          {[3, 4, 5, 6].map((factor) => (
            <option key={factor} value={factor}>
              Top {factor}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchRoot}`} />
          Parametr główny
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchPos}`} />
          Silna korelacja dodatnia
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchNeg}`} />
          Silna korelacja ujemna
        </span>
      </div>
      <div className={styles.viewport} role="region" aria-label={`Sieć korelacji od ${rootMetricLabel}`}>
        <svg
          className={styles.svg}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {Array.from({ length: maxDepth + 1 }, (_, depth) => {
            const x =
              layoutConstants.PADDING + depth * (NODE_WIDTH + layoutConstants.COLUMN_GAP) + NODE_WIDTH / 2;
            return (
              <text
                key={`depth-${depth}`}
                className={styles.depthGuide}
                x={x}
                y={14}
                textAnchor="middle"
              >
                {depthLabels[depth] ?? `Poziom ${depth}`}
              </text>
            );
          })}
          {layout.edges.map((edge) => {
            const from = nodeById.get(edge.fromId);
            const to = nodeById.get(edge.toId);
            if (!from || !to) return null;
            const tone = edgeToneClasses(edge.r);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={`${edge.fromId}-${edge.toId}`}>
                <path
                  d={buildEdgePath(from, to, NODE_WIDTH, NODE_HEIGHT)}
                  className={`${styles.edge} ${tone.edge}`}
                />
                <text
                  className={`${styles.edgeLabel} ${tone.label}`}
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                >
                  r={edge.r.toFixed(2)}
                </text>
              </g>
            );
          })}
          {layout.nodes.map((node) => {
            const isRoot = node.parentId === null;
            const rectX = node.x - NODE_WIDTH / 2;
            const rectY = node.y - NODE_HEIGHT / 2;
            return (
              <g
                key={node.id}
                className={styles.nodeGroup}
                role="button"
                tabIndex={0}
                aria-label={
                  isRoot
                    ? `Parametr główny: ${node.label}`
                    : `Ustaw ${node.label} jako parametr główny (r=${node.rFromParent?.toFixed(3) ?? "—"})`
                }
                onClick={() => onNodeActivate(node.metricId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNodeActivate(node.metricId);
                  }
                }}
              >
                <title>{node.description ?? node.label}</title>
                <rect
                  className={nodeRectClass(node, isRoot)}
                  x={rectX}
                  y={rectY}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                />
                <text className={styles.nodeLabel} x={node.x} y={node.y + 4} textAnchor="middle">
                  {truncateLabel(node.label)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
