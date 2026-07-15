"use client";

import React, { useMemo } from "react";
import type { PositionTaskNode } from "@/types/positionSystem";
import {
  buildPositionSystemTree,
  positionNodeParentIds,
  positionTemplateById,
  type PositionSystemTreeNode,
} from "@/utils/positionSystemTree";
import type { PositionGraphHandlers } from "./PositionPhaseGraphView";
import styles from "./PositionSystemTab.module.css";

function SharedBadge({ parentCount }: { parentCount: number }) {
  if (parentCount <= 1) return null;
  return (
    <span
      className={styles.sharedBadge}
      title={`Współdzielona przez ${parentCount} zasad`}
      aria-label={`Współdzielona przez ${parentCount} zasad`}
    >
      wspólna
    </span>
  );
}

function PositionTreeNode({
  item,
  depth,
  underParentId,
  handlers,
  expandedIds,
  toggleExpanded,
}: {
  item: PositionSystemTreeNode<PositionTaskNode>;
  depth: number;
  underParentId: string | null;
  handlers: PositionGraphHandlers;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const tpl = positionTemplateById(handlers.templates, item.templateId);
  const title = tpl?.title ?? "Nieznane zadanie";
  const level = tpl?.level ?? 0;
  const parentCount = positionNodeParentIds(item).length;
  const hasChildren = item.children.length > 0;
  const expanded = expandedIds.has(item.id);
  const isEditing = handlers.editingTemplateId === item.templateId;
  const nodeTarget = {
    kind: "node" as const,
    positionId: handlers.positionId,
    phaseId: item.phaseId,
    parentId: item.id,
  };
  const targetKey =
    nodeTarget.kind === "node"
      ? `pos:${nodeTarget.positionId}:node:${nodeTarget.phaseId}:${nodeTarget.parentId}`
      : "";
  const canAcceptChildren = level < 2 && !isEditing;

  return (
    <li className={styles.treeItem}>
      <div className={styles.modelNodeRow} style={{ paddingLeft: depth * 10 }}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => toggleExpanded(item.id)}
            aria-expanded={expanded}
            aria-label={expanded ? "Zwiń" : "Rozwiń"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={styles.expandSpacer} aria-hidden />
        )}
        <div
          className={`${styles.modelNodeChip} ${
            isEditing ? styles.chipNotDraggable : ""
          } ${handlers.dragNodeId === item.id ? styles.modelNodeChipDragging : ""} ${
            handlers.dragOverTarget === targetKey && canAcceptChildren
              ? styles.modelNodeChipDragOver
              : ""
          }`}
          data-level={level}
          draggable={!isEditing}
          onDragStart={
            isEditing ? undefined : (e) => handlers.onDragStartNode(e, item.id)
          }
          onDragEnd={handlers.onDragEnd}
          onDragOver={
            canAcceptChildren
              ? (e) => handlers.onDragOverTarget(e, nodeTarget)
              : undefined
          }
          onDragLeave={canAcceptChildren ? handlers.onDragLeaveTarget : undefined}
          onDrop={
            canAcceptChildren ? (e) => handlers.onDropOnTarget(e, nodeTarget) : undefined
          }
        >
          <div className={styles.chipBody}>
            <button
              type="button"
              className={styles.chipTitleButton}
              onClick={() => handlers.onStartEditTemplate(item.templateId)}
              title="Edytuj treść i poziom"
            >
              {title}
            </button>
          </div>
          <div className={styles.chipMeta}>
            <SharedBadge parentCount={parentCount} />
            <div className={styles.chipActionsRow}>
              <button
                type="button"
                className={`${styles.editButton} ${isEditing ? styles.editButtonActive : ""}`}
                onClick={() =>
                  isEditing
                    ? handlers.onCancelEditTemplate()
                    : handlers.onStartEditTemplate(item.templateId)
                }
                aria-label={isEditing ? "Zamknij edycję" : `Edytuj ${title}`}
              >
                {isEditing ? "✕" : "✎"}
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => handlers.onRemoveNode(item.id, underParentId)}
                aria-label={`Usuń z pozycji: ${title}`}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
      {isEditing && handlers.renderEditForm(item.templateId)}
      {hasChildren && expanded && (
        <ul className={styles.nestedList} data-level={level < 2 ? level + 1 : 2}>
          {item.children.map((child) => (
            <PositionTreeNode
              key={`${underParentId ?? "root"}-${child.id}`}
              item={child}
              depth={depth + 1}
              underParentId={item.id}
              handlers={handlers}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PositionPhaseListView({
  phaseNodes,
  handlers,
  expandedIds,
  toggleExpanded,
}: {
  phaseNodes: PositionTaskNode[];
  handlers: PositionGraphHandlers;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
}) {
  const tree = useMemo(() => buildPositionSystemTree(phaseNodes), [phaseNodes]);

  if (tree.length === 0) return null;

  return (
    <ul className={styles.treeList} role="tree" aria-label="Lista zadań">
      {tree.map((item) => (
        <PositionTreeNode
          key={item.id}
          item={item}
          depth={0}
          underParentId={null}
          handlers={handlers}
          expandedIds={expandedIds}
          toggleExpanded={toggleExpanded}
        />
      ))}
    </ul>
  );
}
