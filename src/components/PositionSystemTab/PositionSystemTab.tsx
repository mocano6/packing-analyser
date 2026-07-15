"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { GameModelNode, GameModelRuleLevel, GameModelRuleTemplate } from "@/types/gameModel";
import type {
  PositionRoleId,
  PositionSystemPhaseId,
  PositionSystemState,
  PositionTaskNode,
} from "@/types/positionSystem";
import {
  POSITION_ROLES,
  POSITION_SYSTEM_PHASES,
} from "@/types/positionSystem";
import {
  buildPositionSystemTree,
  copyGameModelSubtreeToPositionTarget,
  countNodesForPosition,
  filterNodesForPositionAndPhase,
  movePositionNodeWithSubtree,
  nextOrderForPositionParent,
  positionTemplateById,
  validatePositionTemplatePlacement,
  type PositionSystemTreeNode,
} from "@/utils/positionSystemTree";
import type { TemplateLibraryUpdatePatch } from "@/utils/gameModelTree";
import styles from "./PositionSystemTab.module.css";

const LIBRARY_DRAG_MIME = "application/json";
const POSITION_NODE_DRAG_MIME = "application/x-position-system+json";
const GAME_MODEL_NODE_DRAG_MIME = "application/x-game-model-node+json";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type DragPayload =
  | { kind: "template"; templateId: string }
  | { kind: "node"; nodeId: string }
  | { kind: "gameModelNode"; nodeId: string };

type DropTarget =
  | {
      kind: "phase";
      positionId: PositionRoleId;
      phaseId: PositionSystemPhaseId;
      parentId: null;
    }
  | {
      kind: "node";
      positionId: PositionRoleId;
      phaseId: PositionSystemPhaseId;
      parentId: string;
    };

function parseDragPayload(raw: string, mime: string): DragPayload | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as DragPayload;
    if (mime === LIBRARY_DRAG_MIME && o.kind === "template") return o;
    if (mime === POSITION_NODE_DRAG_MIME && o.kind === "node") return o;
    if (mime === GAME_MODEL_NODE_DRAG_MIME && o.kind === "gameModelNode") return o;
  } catch {
    return null;
  }
  return null;
}

function parseDropPayload(e: React.DragEvent): DragPayload | null {
  return (
    parseDragPayload(e.dataTransfer.getData(POSITION_NODE_DRAG_MIME), POSITION_NODE_DRAG_MIME) ??
    parseDragPayload(
      e.dataTransfer.getData(GAME_MODEL_NODE_DRAG_MIME),
      GAME_MODEL_NODE_DRAG_MIME
    ) ??
    parseDragPayload(e.dataTransfer.getData(LIBRARY_DRAG_MIME), LIBRARY_DRAG_MIME)
  );
}

function dropTargetKey(target: DropTarget): string {
  return target.kind === "phase"
    ? `pos:${target.positionId}:phase:${target.phaseId}`
    : `pos:${target.positionId}:node:${target.phaseId}:${target.parentId}`;
}

export interface PositionSystemTabProps {
  templates: GameModelRuleTemplate[];
  state: PositionSystemState;
  setPositionSystemState: React.Dispatch<React.SetStateAction<PositionSystemState>>;
  loading: boolean;
  embedded?: boolean;
  usageCounts?: Map<string, number>;
  editingTemplateId?: string | null;
  onStartEditTemplate?: (templateId: string) => void;
  onCancelEditTemplate?: () => void;
  onSaveTemplate?: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
  dragTemplateId?: string | null;
  onLibraryDragEnd?: () => void;
  selectedPositionId?: PositionRoleId;
  onSelectedPositionChange?: (positionId: PositionRoleId) => void;
  /** Węzły modelu drużyny — źródło przeciągania w trybie embedded. */
  gameModelNodes?: GameModelNode[];
}

function TemplateEditForm({
  templateId,
  templates,
  onSave,
  onCancel,
  compact,
}: {
  templateId: string;
  templates: GameModelRuleTemplate[];
  onSave: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const template = positionTemplateById(templates, templateId);
  const [title, setTitle] = useState(template?.title ?? "");
  const [level, setLevel] = useState<GameModelRuleLevel>(template?.level ?? 0);

  useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setLevel(template.level);
  }, [template]);

  const handleSave = () => {
    onSave(templateId, { title, level });
  };

  if (!template) return null;

  return (
    <div className={styles.editPanel} style={compact ? { marginLeft: 0 } : undefined}>
      <label className={styles.editPanelLabel} htmlFor={`pos-edit-title-${templateId}`}>
        Treść
      </label>
      <input
        id={`pos-edit-title-${templateId}`}
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <label className={styles.editPanelLabel} htmlFor={`pos-edit-level-${templateId}`}>
        Poziom
      </label>
      <select
        id={`pos-edit-level-${templateId}`}
        className={styles.select}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value) as GameModelRuleLevel)}
      >
        <option value={0}>Zasada</option>
        <option value={1}>Sub-zasada</option>
        <option value={2}>Sub-sub-zasada</option>
      </select>
      <p className={styles.editPanelHint}>
        Rodzica wybierasz przy przeciąganiu na drzewo pozycji — sub-zasada może należeć do wielu
        zasad.
      </p>
      <div className={styles.editActions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={!title.trim()}
        >
          Zapisz
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

function UsageBadge({ count }: { count: number }) {
  return (
    <span
      className={`${styles.usageBadge} ${count > 0 ? styles.usageBadgeActive : ""}`}
      title={`Przypisana w systemie: ${count}×`}
      aria-label={`Przypisana w systemie ${count} razy`}
    >
      {count}
    </span>
  );
}

function PositionTreeNode({
  item,
  depth,
  positionId,
  templates,
  usageCounts,
  expandedIds,
  toggleExpanded,
  dragNodeId,
  dragOverTarget,
  editingTemplateId,
  onDragStartNode,
  onDragEnd,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropOnTarget,
  onRemoveNode,
  onStartEditTemplate,
  onCancelEditTemplate,
  onSaveTemplate,
}: {
  item: PositionSystemTreeNode<PositionTaskNode>;
  depth: number;
  positionId: PositionRoleId;
  templates: GameModelRuleTemplate[];
  usageCounts: Map<string, number>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  dragNodeId: string | null;
  dragOverTarget: string | null;
  editingTemplateId: string | null;
  onDragStartNode: (e: React.DragEvent, nodeId: string) => void;
  onDragEnd: () => void;
  onDragOverTarget: (e: React.DragEvent, target: DropTarget) => void;
  onDragLeaveTarget: () => void;
  onDropOnTarget: (e: React.DragEvent, target: DropTarget) => void;
  onRemoveNode: (id: string) => void;
  onStartEditTemplate: (templateId: string) => void;
  onCancelEditTemplate: () => void;
  onSaveTemplate: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
}) {
  const tpl = positionTemplateById(templates, item.templateId);
  const title = tpl?.title ?? "Nieznane zadanie";
  const level = tpl?.level ?? 0;
  const usageCount = usageCounts.get(item.templateId) ?? 0;
  const hasChildren = item.children.length > 0;
  const expanded = expandedIds.has(item.id);
  const isEditing = editingTemplateId === item.templateId;
  const nodeTarget: DropTarget = {
    kind: "node",
    positionId,
    phaseId: item.phaseId,
    parentId: item.id,
  };
  const targetKey = dropTargetKey(nodeTarget);
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
          } ${dragNodeId === item.id ? styles.modelNodeChipDragging : ""} ${
            dragOverTarget === targetKey && canAcceptChildren ? styles.modelNodeChipDragOver : ""
          }`}
          data-level={level}
          draggable={!isEditing}
          onDragStart={isEditing ? undefined : (e) => onDragStartNode(e, item.id)}
          onDragEnd={onDragEnd}
          onDragOver={
            canAcceptChildren ? (e) => onDragOverTarget(e, nodeTarget) : undefined
          }
          onDragLeave={canAcceptChildren ? onDragLeaveTarget : undefined}
          onDrop={canAcceptChildren ? (e) => onDropOnTarget(e, nodeTarget) : undefined}
        >
          <div className={styles.chipBody}>
            <button
              type="button"
              className={styles.chipTitleButton}
              onClick={() => onStartEditTemplate(item.templateId)}
              title="Edytuj treść i poziom"
            >
              {title}
            </button>
          </div>
          <div className={styles.chipMeta}>
            <UsageBadge count={usageCount} />
            <div className={styles.chipActionsRow}>
              <button
                type="button"
                className={`${styles.editButton} ${isEditing ? styles.editButtonActive : ""}`}
                onClick={() =>
                  isEditing ? onCancelEditTemplate() : onStartEditTemplate(item.templateId)
                }
                aria-label={isEditing ? "Zamknij edycję" : `Edytuj ${title}`}
              >
                {isEditing ? "✕" : "✎"}
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => onRemoveNode(item.id)}
                aria-label={`Usuń z pozycji: ${title}`}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
      {isEditing && (
        <TemplateEditForm
          templateId={item.templateId}
          templates={templates}
          onSave={onSaveTemplate}
          onCancel={onCancelEditTemplate}
          compact
        />
      )}
      {hasChildren && expanded && (
        <ul className={styles.nestedList} data-level={level < 2 ? level + 1 : 2}>
          {item.children.map((child) => (
            <PositionTreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              positionId={positionId}
              templates={templates}
              usageCounts={usageCounts}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              dragNodeId={dragNodeId}
              dragOverTarget={dragOverTarget}
              editingTemplateId={editingTemplateId}
              onDragStartNode={onDragStartNode}
              onDragEnd={onDragEnd}
              onDragOverTarget={onDragOverTarget}
              onDragLeaveTarget={onDragLeaveTarget}
              onDropOnTarget={onDropOnTarget}
              onRemoveNode={onRemoveNode}
              onStartEditTemplate={onStartEditTemplate}
              onCancelEditTemplate={onCancelEditTemplate}
              onSaveTemplate={onSaveTemplate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PositionSystemTab({
  templates,
  state,
  setPositionSystemState,
  loading,
  embedded = false,
  usageCounts: usageCountsProp,
  editingTemplateId: editingTemplateIdProp,
  onStartEditTemplate: onStartEditTemplateProp,
  onCancelEditTemplate: onCancelEditTemplateProp,
  onSaveTemplate: onSaveTemplateProp,
  dragTemplateId: dragTemplateIdProp,
  onLibraryDragEnd,
  selectedPositionId: selectedPositionIdProp,
  onSelectedPositionChange,
  gameModelNodes = [],
}: PositionSystemTabProps) {
  const [selectedPositionIdLocal, setSelectedPositionIdLocal] = useState<PositionRoleId>("GK");
  const selectedPositionId = embedded
    ? (selectedPositionIdProp ?? "GK")
    : selectedPositionIdLocal;
  const setSelectedPositionId = useCallback(
    (positionId: PositionRoleId) => {
      if (embedded && onSelectedPositionChange) {
        onSelectedPositionChange(positionId);
        return;
      }
      setSelectedPositionIdLocal(positionId);
    },
    [embedded, onSelectedPositionChange]
  );
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<PositionSystemPhaseId>>(
    () => new Set(["defense"])
  );
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [editingTemplateIdLocal, setEditingTemplateIdLocal] = useState<string | null>(null);

  const editingTemplateId = embedded
    ? (editingTemplateIdProp ?? null)
    : editingTemplateIdLocal;

  const usageCounts = useMemo(() => {
    if (usageCountsProp) return usageCountsProp;
    const counts = new Map<string, number>();
    for (const node of state.nodes) {
      counts.set(node.templateId, (counts.get(node.templateId) ?? 0) + 1);
    }
    return counts;
  }, [usageCountsProp, state.nodes]);

  const positionNodeCounts = useMemo(() => {
    const map = new Map<PositionRoleId, number>();
    for (const role of POSITION_ROLES) {
      map.set(role.id, countNodesForPosition(state.nodes, role.id));
    }
    return map;
  }, [state.nodes]);

  const toggleTreeExpanded = useCallback((id: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePhaseExpanded = useCallback((phaseId: PositionSystemPhaseId) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  const expandPhase = useCallback((phaseId: PositionSystemPhaseId) => {
    setExpandedPhases((prev) => {
      if (prev.has(phaseId)) return prev;
      const next = new Set(prev);
      next.add(phaseId);
      return next;
    });
  }, []);

  const startEditTemplate = useCallback(
    (templateId: string) => {
      if (embedded && onStartEditTemplateProp) {
        onStartEditTemplateProp(templateId);
        return;
      }
      setEditingTemplateIdLocal(templateId);
    },
    [embedded, onStartEditTemplateProp]
  );

  const cancelEditTemplate = useCallback(() => {
    if (embedded && onCancelEditTemplateProp) {
      onCancelEditTemplateProp();
      return;
    }
    setEditingTemplateIdLocal(null);
  }, [embedded, onCancelEditTemplateProp]);

  const saveTemplate = useCallback(
    (
      templateId: string,
      patch: TemplateLibraryUpdatePatch,
      options?: { skipConfirm?: boolean }
    ) => {
      if (embedded && onSaveTemplateProp) {
        onSaveTemplateProp(templateId, patch, options);
        return;
      }
      setEditingTemplateIdLocal(null);
    },
    [embedded, onSaveTemplateProp]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const toRemove = new Set<string>();
      const collect = (id: string) => {
        toRemove.add(id);
        state.nodes.filter((n) => n.parentId === id).forEach((n) => collect(n.id));
      };
      collect(nodeId);
      setPositionSystemState((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => !toRemove.has(n.id)),
      }));
    },
    [state.nodes, setPositionSystemState]
  );

  const placeTemplate = useCallback(
    (templateId: string, target: DropTarget) => {
      const template = positionTemplateById(templates, templateId);
      if (!template) return;
      const result = validatePositionTemplatePlacement(
        state.nodes,
        template,
        {
          positionId: target.positionId,
          phaseId: target.phaseId,
          parentId: target.parentId,
        },
        templates
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const id = generateId();
      const order = nextOrderForPositionParent(
        state.nodes,
        target.positionId,
        target.phaseId,
        target.parentId
      );
      setPositionSystemState((prev) => ({
        ...prev,
        nodes: [
          ...prev.nodes,
          {
            id,
            templateId,
            positionId: target.positionId,
            phaseId: target.phaseId,
            parentId: target.parentId,
            order,
          },
        ],
      }));
      if (target.parentId) {
        setTreeExpanded((prev) => new Set(prev).add(target.parentId!));
      }
    },
    [state.nodes, templates, setPositionSystemState]
  );

  const moveNode = useCallback(
    (nodeId: string, target: DropTarget) => {
      const result = movePositionNodeWithSubtree(
        state.nodes,
        nodeId,
        {
          positionId: target.positionId,
          phaseId: target.phaseId,
          parentId: target.parentId,
        },
        templates
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPositionSystemState((prev) => ({
        ...prev,
        nodes: result.nodes,
      }));
      if (target.parentId) {
        setTreeExpanded((prev) => new Set(prev).add(target.parentId!));
      }
      setTreeExpanded((prev) => new Set(prev).add(nodeId));
    },
    [state.nodes, templates, setPositionSystemState]
  );

  const copyGameModelSubtree = useCallback(
    (gameModelNodeId: string, target: DropTarget) => {
      const result = copyGameModelSubtreeToPositionTarget(
        gameModelNodes,
        state.nodes,
        templates,
        gameModelNodeId,
        {
          positionId: target.positionId,
          phaseId: target.phaseId,
          parentId: target.parentId,
        },
        generateId
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setPositionSystemState({ nodes: result.nodes });
      if (target.parentId) {
        setTreeExpanded((prev) => new Set(prev).add(target.parentId!));
      }
      toast.success(
        result.copiedCount === 1
          ? "Skopiowano 1 element z modelu drużyny."
          : `Skopiowano ${result.copiedCount} elementów z modelu drużyny.`
      );
    },
    [gameModelNodes, state.nodes, templates, setPositionSystemState]
  );

  const handleDragStartNode = useCallback((e: React.DragEvent, nodeId: string) => {
    setDragNodeId(nodeId);
    e.dataTransfer.setData(
      POSITION_NODE_DRAG_MIME,
      JSON.stringify({ kind: "node", nodeId } satisfies DragPayload)
    );
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragNodeId(null);
    setDragOverTarget(null);
    onLibraryDragEnd?.();
  }, [onLibraryDragEnd]);

  const handleDragOverTarget = useCallback((e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    const isPositionNode = e.dataTransfer.types.includes(POSITION_NODE_DRAG_MIME);
    e.dataTransfer.dropEffect = isPositionNode ? "move" : "copy";
    setDragOverTarget(dropTargetKey(target));
  }, []);

  const handleDragLeaveTarget = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDropOnTarget = useCallback(
    (e: React.DragEvent, target: DropTarget) => {
      e.preventDefault();
      setDragOverTarget(null);
      const payload = parseDropPayload(e);
      if (!payload) return;
      if (payload.kind === "template") {
        placeTemplate(payload.templateId, target);
      } else if (payload.kind === "gameModelNode") {
        copyGameModelSubtree(payload.nodeId, target);
      } else {
        if (payload.nodeId === target.parentId) return;
        moveNode(payload.nodeId, target);
      }
      handleDragEnd();
    },
    [placeTemplate, copyGameModelSubtree, moveNode, handleDragEnd]
  );

  if (loading && !embedded) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie systemu pozycji…
      </div>
    );
  }

  const selectedRole = POSITION_ROLES.find((r) => r.id === selectedPositionId);

  const assignSection = (
      <section
        className={embedded ? styles.assignSectionEmbedded : styles.assignSection}
        aria-label="Zadania pozycji — obrona i atak"
      >
        <h2 className={styles.assignSectionTitle}>Zadania per pozycja</h2>
        <p className={styles.assignSectionHint}>
          Wybierz rolę taktyczną, potem przypisz zasady z biblioteki po lewej lub przeciągnij z
          modelu drużyny powyżej.
        </p>

        <div className={styles.positionPicker} role="tablist" aria-label="Role taktyczne">
          {POSITION_ROLES.map((role) => {
            const count = positionNodeCounts.get(role.id) ?? 0;
            const isActive = selectedPositionId === role.id;
            return (
              <button
                key={role.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.positionPill} ${isActive ? styles.positionPillActive : ""}`}
                onClick={() => setSelectedPositionId(role.id)}
                title={role.label}
              >
                {role.shortLabel}
                {count > 0 && (
                  <span className={styles.positionPillCount} aria-label={`${count} przypisań`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className={styles.assignSectionHint} aria-live="polite">
          Aktywna pozycja: <strong>{selectedRole?.label ?? selectedPositionId}</strong>
        </p>

        <div className={styles.phasesStack}>
          {POSITION_SYSTEM_PHASES.map((phase) => {
            const phaseNodes = filterNodesForPositionAndPhase(
              state.nodes,
              selectedPositionId,
              phase.id
            );
            const tree = buildPositionSystemTree(phaseNodes);
            const phaseTarget: DropTarget = {
              kind: "phase",
              positionId: selectedPositionId,
              phaseId: phase.id,
              parentId: null,
            };
            const phaseTargetKey = dropTargetKey(phaseTarget);
            const isPhaseExpanded = expandedPhases.has(phase.id);
            const nodeCount = phaseNodes.length;

            return (
              <article
                key={phase.id}
                className={styles.phaseCard}
                data-phase={phase.id}
                aria-label={`${selectedRole?.label ?? selectedPositionId} — ${phase.label}`}
                onDragOver={(e) => {
                  if (isPhaseExpanded) return;
                  e.preventDefault();
                  expandPhase(phase.id);
                  handleDragOverTarget(e, phaseTarget);
                }}
              >
                <div className={styles.phaseHeaderRow}>
                  <button
                    type="button"
                    className={styles.phaseHeader}
                    aria-expanded={isPhaseExpanded}
                    aria-controls={`pos-phase-body-${phase.id}`}
                    onClick={() => togglePhaseExpanded(phase.id)}
                  >
                    <span className={styles.phaseChevron} aria-hidden="true">
                      {isPhaseExpanded ? "▼" : "▶"}
                    </span>
                    <h3 className={styles.phaseTitle}>{phase.label}</h3>
                    <span className={styles.phaseMeta}>
                      {nodeCount} {nodeCount === 1 ? "element" : "elementów"}
                    </span>
                  </button>
                </div>
                <div
                  id={`pos-phase-body-${phase.id}`}
                  className={`${styles.phaseBody} ${
                    !isPhaseExpanded ? styles.phaseBodyCollapsed : ""
                  }`}
                  hidden={!isPhaseExpanded}
                >
                  <div
                    className={`${styles.dropZone} ${
                      dragOverTarget === phaseTargetKey ? styles.dropZoneDragOver : ""
                    }`}
                    onDragOver={(e) => {
                      expandPhase(phase.id);
                      handleDragOverTarget(e, phaseTarget);
                    }}
                    onDragLeave={handleDragLeaveTarget}
                    onDrop={(e) => handleDropOnTarget(e, phaseTarget)}
                  >
                    {tree.length === 0 ? (
                      <p className={styles.emptyHint}>
                        Upuść zasadę (poziom główny) tutaj — z biblioteki po lewej lub z modelu
                        drużyny powyżej.
                      </p>
                    ) : (
                      <ul className={styles.treeList}>
                        {tree.map((item) => (
                          <PositionTreeNode
                            key={item.id}
                            item={item}
                            depth={0}
                            positionId={selectedPositionId}
                            templates={templates}
                            usageCounts={usageCounts}
                            expandedIds={treeExpanded}
                            toggleExpanded={toggleTreeExpanded}
                            dragNodeId={dragNodeId}
                            dragOverTarget={dragOverTarget}
                            editingTemplateId={editingTemplateId}
                            onDragStartNode={handleDragStartNode}
                            onDragEnd={handleDragEnd}
                            onDragOverTarget={handleDragOverTarget}
                            onDragLeaveTarget={handleDragLeaveTarget}
                            onDropOnTarget={handleDropOnTarget}
                            onRemoveNode={removeNode}
                            onStartEditTemplate={startEditTemplate}
                            onCancelEditTemplate={cancelEditTemplate}
                            onSaveTemplate={saveTemplate}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
  );

  if (embedded) {
    return assignSection;
  }

  return <div className={styles.positionSystemTab}>{assignSection}</div>;
}
