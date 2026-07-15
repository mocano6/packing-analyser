"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameModelRuleLevel, GameModelRuleTemplate } from "@/types/gameModel";
import type { PositionRoleId, PositionTaskNode } from "@/types/positionSystem";
import { POSITION_TASK_LEVEL_LABELS } from "@/types/positionSystem";
import {
  buildPositionPhaseGraphLayout,
  positionNodeIsShared,
  positionNodeParentIds,
  positionNodeIsRoot,
  positionTemplateById,
  type PositionPhaseGraphEdge,
} from "@/utils/positionSystemTree";
import type { TemplateLibraryUpdatePatch } from "@/utils/gameModelTree";
import styles from "./PositionSystemTab.module.css";

type DropTarget =
  | {
      kind: "phase";
      positionId: PositionRoleId;
      phaseId: PositionTaskNode["phaseId"];
      parentId: null;
    }
  | {
      kind: "node";
      positionId: PositionRoleId;
      phaseId: PositionTaskNode["phaseId"];
      parentId: string;
    };

function dropTargetKey(target: DropTarget): string {
  return target.kind === "phase"
    ? `pos:${target.positionId}:phase:${target.phaseId}`
    : `pos:${target.positionId}:node:${target.phaseId}:${target.parentId}`;
}

type NodeRect = { x: number; y: number; w: number; h: number };

/** Paleta kolorów nitki — każda zasada P3 (korzeń) dostaje inny odcień. */
const THREAD_PALETTE = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#65a30d",
  "#ea580c",
  "#0d9488",
  "#9333ea",
];

function buildRootThreadColors(rootIds: string[]): Map<string, string> {
  const sorted = [...rootIds].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  sorted.forEach((id, index) => {
    map.set(id, THREAD_PALETTE[index % THREAD_PALETTE.length] ?? "#64748b");
  });
  return map;
}

/** Wszystkie korzenie (P3), z których da się dojść do węzła w górę grafu. */
function getAncestorRootIds(
  nodeId: string,
  phaseNodes: PositionTaskNode[],
  rootIds: Set<string>
): string[] {
  const found = new Set<string>();
  const stack = [nodeId];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const node = phaseNodes.find((n) => n.id === id);
    if (!node) continue;

    const parentIds = positionNodeParentIds(node);
    if (parentIds.length === 0) {
      if (rootIds.has(id)) found.add(id);
      continue;
    }
    for (const parentId of parentIds) stack.push(parentId);
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

function connectorPath(from: NodeRect, to: NodeRect, offsetX = 0): string {
  const x1 = from.x + from.w / 2 + offsetX;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2 + offsetX;
  const y2 = to.y;
  const midY = y1 + Math.max(12, (y2 - y1) * 0.42);
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

type ColoredEdgePath = { key: string; d: string; color: string };

function buildColoredEdgePaths(
  edges: PositionPhaseGraphEdge[],
  rects: Map<string, NodeRect>,
  phaseNodes: PositionTaskNode[],
  rootIds: string[],
  rootColors: Map<string, string>
): ColoredEdgePath[] {
  const rootSet = new Set(rootIds);
  const paths: ColoredEdgePath[] = [];

  for (const { fromId, toId } of edges) {
    const from = rects.get(fromId);
    const to = rects.get(toId);
    if (!from || !to) continue;

    const threads = getAncestorRootIds(fromId, phaseNodes, rootSet);
    if (threads.length === 0) continue;

    threads.forEach((rootId, index) => {
      const offsetX =
        threads.length > 1 ? (index - (threads.length - 1) / 2) * 5 : 0;
      paths.push({
        key: `${fromId}->${toId}:${rootId}`,
        d: connectorPath(from, to, offsetX),
        color: rootColors.get(rootId) ?? "#64748b",
      });
    });
  }

  return paths;
}

export type PositionGraphHandlers = {
  positionId: PositionRoleId;
  templates: GameModelRuleTemplate[];
  dragNodeId: string | null;
  dragOverTarget: string | null;
  editingTemplateId: string | null;
  onDragStartNode: (e: React.DragEvent, nodeId: string) => void;
  onDragEnd: () => void;
  onDragOverTarget: (e: React.DragEvent, target: DropTarget) => void;
  onDragLeaveTarget: () => void;
  onDropOnTarget: (e: React.DragEvent, target: DropTarget) => void;
  onRemoveNode: (nodeId: string, underParentId: string | null) => void;
  onStartEditTemplate: (templateId: string) => void;
  onCancelEditTemplate: () => void;
  onSaveTemplate: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
  renderEditForm: (templateId: string) => React.ReactNode;
};

function PositionGraphNode({
  node,
  handlers,
  registerRef,
  threadColor,
}: {
  node: PositionTaskNode;
  handlers: PositionGraphHandlers;
  registerRef: (nodeId: string, el: HTMLDivElement | null) => void;
  threadColor?: string;
}) {
  const tpl = positionTemplateById(handlers.templates, node.templateId);
  const title = tpl?.title ?? "Nieznane zadanie";
  const level = tpl?.level ?? 0;
  const isShared = positionNodeIsShared(node);
  const isEditing = handlers.editingTemplateId === node.templateId;
  const nodeTarget: DropTarget = {
    kind: "node",
    positionId: handlers.positionId,
    phaseId: node.phaseId,
    parentId: node.id,
  };
  const targetKey = dropTargetKey(nodeTarget);
  const canAcceptChildren = level < 2 && !isEditing;
  const isRoot = positionNodeIsRoot(node);

  return (
    <div
      ref={(el) => registerRef(node.id, el)}
      className={`${styles.graphNode} ${isShared ? styles.graphNodeShared : ""} ${
        isRoot ? styles.graphNodeRoot : ""
      }`}
      data-node-id={node.id}
      data-level={level}
    >
      <div
        className={`${styles.modelNodeChip} ${styles.graphNodeChip} ${
          isEditing ? styles.chipNotDraggable : ""
        } ${handlers.dragNodeId === node.id ? styles.modelNodeChipDragging : ""} ${
          handlers.dragOverTarget === targetKey && canAcceptChildren
            ? styles.modelNodeChipDragOver
            : ""
        } ${isRoot && threadColor ? styles.graphNodeChipThread : ""}`}
        data-level={level}
        style={
          isRoot && threadColor
            ? ({ ["--thread-color" as string]: threadColor } as React.CSSProperties)
            : undefined
        }
        draggable={!isEditing}
        onDragStart={isEditing ? undefined : (e) => handlers.onDragStartNode(e, node.id)}
        onDragEnd={handlers.onDragEnd}
        onDragOver={canAcceptChildren ? (e) => handlers.onDragOverTarget(e, nodeTarget) : undefined}
        onDragLeave={canAcceptChildren ? handlers.onDragLeaveTarget : undefined}
        onDrop={canAcceptChildren ? (e) => handlers.onDropOnTarget(e, nodeTarget) : undefined}
      >
        <div className={styles.chipBody}>
          <button
            type="button"
            className={styles.chipTitleButton}
            onClick={() => handlers.onStartEditTemplate(node.templateId)}
            title="Edytuj treść i poziom"
          >
            {title}
          </button>
        </div>
        <div className={styles.chipMeta}>
          {isShared && (
            <span className={styles.graphMergeBadge} title="Linie z wielu zasad łączą się tutaj">
              ⨉
            </span>
          )}
          <div className={styles.chipActionsRow}>
            <button
              type="button"
              className={`${styles.editButton} ${isEditing ? styles.editButtonActive : ""}`}
              onClick={() =>
                isEditing
                  ? handlers.onCancelEditTemplate()
                  : handlers.onStartEditTemplate(node.templateId)
              }
              aria-label={isEditing ? "Zamknij edycję" : `Edytuj ${title}`}
            >
              {isEditing ? "✕" : "✎"}
            </button>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => handlers.onRemoveNode(node.id, null)}
              aria-label={`Usuń z pozycji: ${title}`}
            >
              ×
            </button>
          </div>
        </div>
      </div>
      {isEditing && handlers.renderEditForm(node.templateId)}
    </div>
  );
}

function GraphEdges({
  edges,
  rects,
  phaseNodes,
  rootColors,
}: {
  edges: PositionPhaseGraphEdge[];
  rects: Map<string, NodeRect>;
  phaseNodes: PositionTaskNode[];
  rootColors: Map<string, string>;
}) {
  const rootIds = [...rootColors.keys()];
  const paths = buildColoredEdgePaths(edges, rects, phaseNodes, rootIds, rootColors);

  if (paths.length === 0) return null;

  return (
    <svg
      className={styles.graphEdgesSvg}
      aria-hidden="true"
      focusable="false"
    >
      {paths.map(({ key, d, color }) => (
        <path key={key} d={d} className={styles.graphEdge} stroke={color} />
      ))}
    </svg>
  );
}

export default function PositionPhaseGraphView({
  phaseNodes,
  handlers,
}: {
  phaseNodes: PositionTaskNode[];
  handlers: PositionGraphHandlers;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [rects, setRects] = useState<Map<string, NodeRect>>(new Map());

  const layout = useMemo(
    () => buildPositionPhaseGraphLayout(phaseNodes, handlers.templates),
    [phaseNodes, handlers.templates]
  );

  const rootThreadColors = useMemo(() => {
    const roots = phaseNodes.filter(positionNodeIsRoot).map((n) => n.id);
    return buildRootThreadColors(roots);
  }, [phaseNodes]);

  const registerRef = useCallback((nodeId: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(nodeId, el);
    else nodeRefs.current.delete(nodeId);
  }, []);

  const measureGraph = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerBox = container.getBoundingClientRect();
    const nextRects = new Map<string, NodeRect>();
    for (const [nodeId, el] of nodeRefs.current.entries()) {
      const box = el.getBoundingClientRect();
      nextRects.set(nodeId, {
        x: box.left - containerBox.left,
        y: box.top - containerBox.top,
        w: box.width,
        h: box.height,
      });
    }
    setRects(nextRects);
  }, []);

  useLayoutEffect(() => {
    measureGraph();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measureGraph());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measureGraph, layout, handlers.editingTemplateId]);

  if (layout.layers.length === 0) return null;

  return (
    <div ref={containerRef} className={styles.phaseGraph} role="tree" aria-label="Drzewo zadań">
      <GraphEdges
        edges={layout.edges}
        rects={rects}
        phaseNodes={phaseNodes}
        rootColors={rootThreadColors}
      />
      {layout.layers.map((layer) => (
        <div
          key={layer.level}
          className={styles.graphLayer}
          data-level={layer.level}
          role="group"
          aria-label={POSITION_TASK_LEVEL_LABELS[layer.level as GameModelRuleLevel]}
        >
          <div className={styles.graphLayerLabel}>
            {POSITION_TASK_LEVEL_LABELS[layer.level as GameModelRuleLevel]}
          </div>
          <div className={styles.graphLayerNodes}>
            {layer.nodes.map((node) => (
              <PositionGraphNode
                key={node.id}
                node={node}
                handlers={handlers}
                registerRef={registerRef}
                threadColor={
                  positionNodeIsRoot(node) ? rootThreadColors.get(node.id) : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
