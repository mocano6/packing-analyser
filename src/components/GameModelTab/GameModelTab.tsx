"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type {
  GameModelNode,
  GameModelPhaseId,
  GameModelRuleLevel,
  GameModelRuleTemplate,
  GameModelState,
} from "@/types/gameModel";
import type { GameModelRulePriority } from "@/types/gameModel";
import {
  GAME_MODEL_LEVEL_LABELS,
  GAME_MODEL_PHASES,
  GAME_MODEL_PRIORITY_LABELS,
} from "@/types/gameModel";
import {
  applyTemplateLibraryUpdateWithCascade,
  buildGameModelTree,
  buildTemplateLevelChangeConfirmMessage,
  buildTemplateUsageCounts,
  countTemplateUsage,
  deleteTemplateFromLibrary,
  filterNodesForPhase,
  groupTemplatesByLevel,
  moveModelNodeWithSubtree,
  nextOrderForParent,
  nodesRemovedByTemplateLevelChange,
  templateById,
  validateTemplateLibraryUpdate,
  validateTemplatePlacement,
  type GameModelTreeNode,
  type TemplateLibraryUpdatePatch,
} from "@/utils/gameModelTree";
import styles from "./GameModelTab.module.css";

const LIBRARY_LEVELS: GameModelRuleLevel[] = [0, 1, 2];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type DragPayload =
  | { kind: "template"; templateId: string }
  | { kind: "node"; nodeId: string };

type DropTarget =
  | { kind: "phase"; phaseId: GameModelPhaseId; parentId: null }
  | { kind: "node"; phaseId: GameModelPhaseId; parentId: string };

function parseDragPayload(raw: string): DragPayload | null {
  try {
    const o = JSON.parse(raw) as DragPayload;
    if (o.kind === "template" && typeof o.templateId === "string") return o;
    if (o.kind === "node" && typeof o.nodeId === "string") return o;
  } catch {
    return null;
  }
  return null;
}

function dropTargetKey(target: DropTarget): string {
  return target.kind === "phase"
    ? `phase:${target.phaseId}`
    : `node:${target.phaseId}:${target.parentId}`;
}

export interface GameModelTabProps {
  state: GameModelState;
  setGameModelState: React.Dispatch<React.SetStateAction<GameModelState>>;
  loading: boolean;
  /** Wspólny panel — bez własnej biblioteki (biblioteka w ModelPanel). */
  embedded?: boolean;
  templates?: GameModelRuleTemplate[];
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
}

const GAME_MODEL_NODE_DRAG_MIME = "application/x-game-model-node+json";

function TemplateEditForm({
  templateId,
  templates,
  nodes,
  onSave,
  onCancel,
  compact,
}: {
  templateId: string;
  templates: GameModelRuleTemplate[];
  nodes: GameModelNode[];
  onSave: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const template = templateById(templates, templateId);
  const [title, setTitle] = useState(template?.title ?? "");
  const [level, setLevel] = useState<GameModelRuleLevel>(template?.level ?? 0);
  const [description, setDescription] = useState(template?.description ?? "");
  const [trigger, setTrigger] = useState(template?.trigger ?? "");
  const [priority, setPriority] = useState<GameModelRulePriority | "">(template?.priority ?? "");

  useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setLevel(template.level);
    setDescription(template.description ?? "");
    setTrigger(template.trigger ?? "");
    setPriority(template.priority ?? "");
  }, [template]);

  const handleSave = () => {
    onSave(templateId, { title, level, description, trigger, priority: priority || undefined });
  };

  if (!template) return null;

  return (
    <div className={styles.editPanel} style={compact ? { marginLeft: 0 } : undefined}>
      <label className={styles.editPanelLabel} htmlFor={`edit-title-${templateId}`}>
        Treść
      </label>
      <input
        id={`edit-title-${templateId}`}
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <label className={styles.editPanelLabel} htmlFor={`edit-desc-${templateId}`}>
        Definicja (co to znaczy u nas)
      </label>
      <textarea
        id={`edit-desc-${templateId}`}
        className={styles.textarea}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="1–3 zdania, jak rozumiemy tę zasadę"
      />
      <label className={styles.editPanelLabel} htmlFor={`edit-trigger-${templateId}`}>
        Trigger / kiedy
      </label>
      <input
        id={`edit-trigger-${templateId}`}
        className={styles.input}
        value={trigger}
        onChange={(e) => setTrigger(e.target.value)}
        placeholder="Np. strata w środkowej strefie"
      />
      <label className={styles.editPanelLabel} htmlFor={`edit-level-${templateId}`}>
        Poziom
      </label>
      <select
        id={`edit-level-${templateId}`}
        className={styles.select}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value) as GameModelRuleLevel)}
      >
        <option value={0}>Zasada</option>
        <option value={1}>Sub-zasada</option>
        <option value={2}>Sub-sub-zasada</option>
      </select>
      <label className={styles.editPanelLabel} htmlFor={`edit-priority-${templateId}`}>
        Priorytet
      </label>
      <select
        id={`edit-priority-${templateId}`}
        className={styles.select}
        value={priority}
        onChange={(e) => setPriority(e.target.value as GameModelRulePriority | "")}
      >
        <option value="">—</option>
        <option value="key">{GAME_MODEL_PRIORITY_LABELS.key}</option>
        <option value="support">{GAME_MODEL_PRIORITY_LABELS.support}</option>
      </select>
      <p className={styles.editPanelHint}>
        Rodzica wybierasz przy przeciąganiu na model — sub-zasada może należeć do wielu zasad.
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
      title={`Użyta w modelu: ${count}×`}
      aria-label={`Użyta w modelu ${count} razy`}
    >
      {count}
    </span>
  );
}

function LibraryTemplateItem({
  template,
  usageCount,
  dragTemplateId,
  editingTemplateId,
  templates,
  nodes,
  onDragStartTemplate,
  onDragEnd,
  onDeleteTemplate,
  onStartEditTemplate,
  onCancelEditTemplate,
  onSaveTemplate,
}: {
  template: GameModelRuleTemplate;
  usageCount: number;
  dragTemplateId: string | null;
  editingTemplateId: string | null;
  templates: GameModelRuleTemplate[];
  nodes: GameModelNode[];
  onDragStartTemplate: (e: React.DragEvent, templateId: string) => void;
  onDragEnd: () => void;
  onDeleteTemplate: (id: string) => void;
  onStartEditTemplate: (templateId: string) => void;
  onCancelEditTemplate: () => void;
  onSaveTemplate: (
    templateId: string,
    patch: TemplateLibraryUpdatePatch,
    options?: { skipConfirm?: boolean }
  ) => void;
}) {
  const isEditing = editingTemplateId === template.id;

  return (
    <li className={styles.libraryRow}>
      <div
        className={`${styles.draggableChip} ${
          isEditing ? styles.chipNotDraggable : ""
        } ${dragTemplateId === template.id ? styles.draggableChipDragging : ""}`}
        data-level={template.level}
        draggable={!isEditing}
        onDragStart={isEditing ? undefined : (e) => onDragStartTemplate(e, template.id)}
        onDragEnd={onDragEnd}
        title={isEditing ? undefined : `${template.title} — przeciągnij na fazę lub inną kategorię`}
      >
        <div className={styles.chipBody}>
          <button
            type="button"
            className={styles.chipTitleButton}
            onClick={() => onStartEditTemplate(template.id)}
            title="Edytuj treść i poziom"
          >
            {template.title}
          </button>
        </div>
        <div className={styles.chipMeta}>
          <UsageBadge count={usageCount} />
          <div className={styles.chipActionsRow}>
            <button
              type="button"
              className={`${styles.editButton} ${isEditing ? styles.editButtonActive : ""}`}
              onClick={() =>
                isEditing ? onCancelEditTemplate() : onStartEditTemplate(template.id)
              }
              aria-label={isEditing ? "Zamknij edycję" : `Edytuj ${template.title}`}
            >
              {isEditing ? "✕" : "✎"}
            </button>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => onDeleteTemplate(template.id)}
              aria-label={`Usuń ${template.title}`}
            >
              ×
            </button>
          </div>
        </div>
      </div>
      {isEditing && (
        <TemplateEditForm
          templateId={template.id}
          templates={templates}
          nodes={nodes}
          onSave={onSaveTemplate}
          onCancel={onCancelEditTemplate}
        />
      )}
    </li>
  );
}

function ModelTreeNode({
  item,
  depth,
  templates,
  nodes,
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
  item: GameModelTreeNode<GameModelNode>;
  depth: number;
  templates: GameModelRuleTemplate[];
  nodes: GameModelNode[];
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
  const tpl = templateById(templates, item.templateId);
  const title = tpl?.title ?? "Nieznana zasada";
  const level = tpl?.level ?? 0;
  const usageCount = usageCounts.get(item.templateId) ?? 0;
  const hasChildren = item.children.length > 0;
  const expanded = expandedIds.has(item.id);
  const isEditing = editingTemplateId === item.templateId;
  const nodeTarget: DropTarget = {
    kind: "node",
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
            canAcceptChildren
              ? (e) => onDragOverTarget(e, nodeTarget)
              : undefined
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
                aria-label={`Usuń z modelu: ${title}`}
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
          nodes={nodes}
          onSave={onSaveTemplate}
          onCancel={onCancelEditTemplate}
          compact
        />
      )}
      {hasChildren && expanded && (
        <ul className={styles.nestedList} data-level={level < 2 ? level + 1 : 2}>
          {item.children.map((child) => (
            <ModelTreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              templates={templates}
              nodes={nodes}
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

export default function GameModelTab({
  state,
  setGameModelState,
  loading,
  embedded = false,
  templates: templatesProp,
  usageCounts: usageCountsProp,
  editingTemplateId: editingTemplateIdProp,
  onStartEditTemplate: onStartEditTemplateProp,
  onCancelEditTemplate: onCancelEditTemplateProp,
  onSaveTemplate: onSaveTemplateProp,
  dragTemplateId: dragTemplateIdProp,
  onLibraryDragEnd,
}: GameModelTabProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState<GameModelRuleLevel>(0);
  const [modelExpanded, setModelExpanded] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<GameModelPhaseId>>(
    () => new Set(["defense"])
  );
  const [expandedLibraryLevels, setExpandedLibraryLevels] = useState<Set<GameModelRuleLevel>>(
    () => new Set([0])
  );
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dragOverLibraryLevel, setDragOverLibraryLevel] = useState<GameModelRuleLevel | null>(null);
  const [editingTemplateIdLocal, setEditingTemplateIdLocal] = useState<string | null>(null);
  const editingTemplateId = embedded
    ? (editingTemplateIdProp ?? null)
    : editingTemplateIdLocal;

  const templates = templatesProp ?? state.templates;

  const usageCounts = useMemo(
    () => usageCountsProp ?? buildTemplateUsageCounts(state.nodes),
    [usageCountsProp, state.nodes]
  );

  const templatesByLevel = useMemo(
    () => groupTemplatesByLevel(state.templates),
    [state.templates]
  );

  const toggleModelExpanded = useCallback((id: string) => {
    setModelExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePhaseExpanded = useCallback((phaseId: GameModelPhaseId) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  const expandPhase = useCallback((phaseId: GameModelPhaseId) => {
    setExpandedPhases((prev) => {
      if (prev.has(phaseId)) return prev;
      const next = new Set(prev);
      next.add(phaseId);
      return next;
    });
  }, []);

  const toggleLibraryLevelExpanded = useCallback((level: GameModelRuleLevel) => {
    setExpandedLibraryLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const expandLibraryLevel = useCallback((level: GameModelRuleLevel) => {
    setExpandedLibraryLevels((prev) => {
      if (prev.has(level)) return prev;
      const next = new Set(prev);
      next.add(level);
      return next;
    });
  }, []);

  const addTemplate = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    const id = generateId();
    setGameModelState((prev) => ({
      ...prev,
      templates: [...prev.templates, { id, title, level: newLevel }],
    }));
    setNewTitle("");
  }, [newTitle, newLevel, setGameModelState]);

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
      const template = templateById(state.templates, templateId);
      if (!template) return;

      const result = validateTemplateLibraryUpdate(
        state.templates,
        state.nodes,
        templateId,
        patch
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const levelChanging = patch.level !== template.level;
      const removedIds = nodesRemovedByTemplateLevelChange(
        state.nodes,
        state.templates,
        templateId,
        patch
      );
      const usage = countTemplateUsage(state.nodes, templateId);

      if (
        levelChanging &&
        removedIds.length > 0 &&
        !options?.skipConfirm &&
        typeof window !== "undefined"
      ) {
        const confirmed = window.confirm(
          buildTemplateLevelChangeConfirmMessage(template.title, usage, removedIds.length)
        );
        if (!confirmed) return;
      }

      const { templates: nextTemplates, nodes, removedNodeCount } =
        applyTemplateLibraryUpdateWithCascade(state.templates, state.nodes, templateId, patch);
      setGameModelState({ templates: nextTemplates, nodes });
      if (embedded) {
        onCancelEditTemplateProp?.();
      } else {
        setEditingTemplateIdLocal(null);
      }

      if (removedNodeCount > 0) {
        toast.success(
          `Zapisano zmiany. Usunięto ${removedNodeCount} przypisań z modelu gry.`
        );
      } else {
        toast.success("Zapisano zmiany.");
      }
    },
    [state.templates, state.nodes, setGameModelState, embedded, onSaveTemplateProp, onCancelEditTemplateProp]
  );

  const deleteTemplate = useCallback(
    (templateId: string) => {
      if (editingTemplateId === templateId) {
        cancelEditTemplate();
      }
      const { templates: nextTemplates, nodes, removedNodeCount } = deleteTemplateFromLibrary(
        state.templates,
        state.nodes,
        templateId
      );
      setGameModelState({ templates: nextTemplates, nodes });
      if (removedNodeCount > 0) {
        toast.success(
          `Usunięto z biblioteki i z modelu gry (${removedNodeCount} przypisań).`
        );
      }
    },
    [state.templates, state.nodes, setGameModelState, editingTemplateId, cancelEditTemplate]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const toRemove = new Set<string>();
      const collect = (id: string) => {
        toRemove.add(id);
        state.nodes.filter((n) => n.parentId === id).forEach((n) => collect(n.id));
      };
      collect(nodeId);
      setGameModelState((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => !toRemove.has(n.id)),
      }));
    },
    [state.nodes, setGameModelState]
  );

  const placeTemplate = useCallback(
    (templateId: string, target: DropTarget) => {
      const template = templateById(templates, templateId);
      if (!template) return;
      const result = validateTemplatePlacement(
        state.nodes,
        template,
        { phaseId: target.phaseId, parentId: target.parentId },
        templates
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const id = generateId();
      const order = nextOrderForParent(state.nodes, target.phaseId, target.parentId);
      setGameModelState((prev) => ({
        ...prev,
        nodes: [
          ...prev.nodes,
          {
            id,
            templateId,
            phaseId: target.phaseId,
            parentId: target.parentId,
            order,
          },
        ],
      }));
      if (target.parentId) {
        setModelExpanded((prev) => new Set(prev).add(target.parentId!));
      }
    },
    [state.nodes, templates, setGameModelState]
  );

  const moveNode = useCallback(
    (nodeId: string, target: DropTarget) => {
      const result = moveModelNodeWithSubtree(
        state.nodes,
        nodeId,
        { phaseId: target.phaseId, parentId: target.parentId },
        templates
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setGameModelState((prev) => ({
        ...prev,
        nodes: result.nodes,
      }));
      if (target.parentId) {
        setModelExpanded((prev) => new Set(prev).add(target.parentId!));
      }
      setModelExpanded((prev) => new Set(prev).add(nodeId));
    },
    [state.nodes, templates, setGameModelState]
  );

  const changeTemplateLevel = useCallback(
    (templateId: string, newLevel: GameModelRuleLevel) => {
      const template = templateById(templates, templateId);
      if (!template || template.level === newLevel) return;
      saveTemplate(templateId, { title: template.title, level: newLevel });
    },
    [templates, saveTemplate]
  );

  const handleDragStartTemplate = useCallback((e: React.DragEvent, templateId: string) => {
    setDragTemplateId(templateId);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ kind: "template", templateId } satisfies DragPayload)
    );
    e.dataTransfer.effectAllowed = "copyMove";
  }, []);

  const handleDragStartNode = useCallback(
    (e: React.DragEvent, nodeId: string) => {
      setDragNodeId(nodeId);
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ kind: "node", nodeId } satisfies DragPayload)
      );
      if (embedded) {
        e.dataTransfer.setData(
          GAME_MODEL_NODE_DRAG_MIME,
          JSON.stringify({ kind: "gameModelNode", nodeId })
        );
        e.dataTransfer.effectAllowed = "copyMove";
      } else {
        e.dataTransfer.effectAllowed = "move";
      }
    },
    [embedded]
  );

  const handleDragEnd = useCallback(() => {
    setDragTemplateId(null);
    setDragNodeId(null);
    setDragOverTarget(null);
    setDragOverLibraryLevel(null);
    onLibraryDragEnd?.();
  }, [onLibraryDragEnd]);

  const effectiveDragTemplateId = embedded ? (dragTemplateIdProp ?? null) : dragTemplateId;

  const handleDragOverLibrary = useCallback(
    (e: React.DragEvent, level: GameModelRuleLevel) => {
      if (!dragTemplateId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      expandLibraryLevel(level);
      setDragOverLibraryLevel(level);
    },
    [dragTemplateId, expandLibraryLevel]
  );

  const handleDropOnLibrary = useCallback(
    (e: React.DragEvent, level: GameModelRuleLevel) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverLibraryLevel(null);
      const raw = e.dataTransfer.getData("application/json");
      const payload = parseDragPayload(raw);
      if (!payload || payload.kind !== "template") return;
      changeTemplateLevel(payload.templateId, level);
      handleDragEnd();
    },
    [changeTemplateLevel, handleDragEnd]
  );

  const handleDragOverTarget = useCallback((e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragNodeId ? "move" : "copy";
    setDragOverTarget(dropTargetKey(target));
  }, [dragNodeId]);

  const handleDragLeaveTarget = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDropOnTarget = useCallback(
    (e: React.DragEvent, target: DropTarget) => {
      e.preventDefault();
      setDragOverTarget(null);
      const raw = e.dataTransfer.getData("application/json");
      const payload = parseDragPayload(raw);
      if (!payload) return;
      if (payload.kind === "template") {
        placeTemplate(payload.templateId, target);
      } else {
        if (payload.nodeId === target.parentId) return;
        moveNode(payload.nodeId, target);
      }
      handleDragEnd();
    },
    [placeTemplate, moveNode, handleDragEnd]
  );

  if (loading && !embedded) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie modelu gry…
      </div>
    );
  }

  const hasTemplates = templates.length > 0;

  const phasesSection = (
      <section className={styles.modelSection} aria-label="Model gry — fazy">
        <h2 className={styles.modelSectionTitle}>Model gry — fazy</h2>
        <p className={styles.modelSectionHint}>
          {embedded
            ? "Obrona nad atakiem, poniżej SFG. Przeciągnij zasady z biblioteki po lewej lub w dół na aktywną pozycję."
            : "Obrona nad atakiem, poniżej SFG. Kliknij nagłówek fazy, aby rozwinąć lub zwinąć. Przeciągnij elementy z biblioteki obok."}
        </p>
        <div className={styles.phasesStack}>
        {GAME_MODEL_PHASES.map((phase) => {
          const phaseNodes = filterNodesForPhase(state.nodes, phase.id);
          const tree = buildGameModelTree(phaseNodes);
          const phaseTarget: DropTarget = {
            kind: "phase",
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
              aria-label={phase.label}
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
                  aria-controls={`phase-body-${phase.id}`}
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
                id={`phase-body-${phase.id}`}
                className={`${styles.phaseBody} ${!isPhaseExpanded ? styles.phaseBodyCollapsed : ""}`}
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
                      Upuść zasadę (poziom główny) tutaj.
                    </p>
                  ) : (
                    <ul className={styles.treeList}>
                      {tree.map((item) => (
                        <ModelTreeNode
                          key={item.id}
                          item={item}
                          depth={0}
                          templates={templates}
                          nodes={state.nodes}
                          usageCounts={usageCounts}
                          expandedIds={modelExpanded}
                          toggleExpanded={toggleModelExpanded}
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
    return phasesSection;
  }

  return (
    <div className={styles.gameModelTab}>
      <aside className={styles.library} aria-label="Biblioteka zasad">
        <h2 className={styles.libraryTitle}>Biblioteka zasad</h2>
        <p className={styles.libraryHint}>
          Niebieskie = zasady, zielone = sub-zasady, fioletowe = sub-sub-zasady. Przeciągnij między
          kolumnami, aby zmienić kategorię, albo na fazę modelu obok.
        </p>

        <div className={styles.addForm}>
          <label className={styles.srOnly} htmlFor="game-model-rule-title">
            Tytuł zasady
          </label>
          <input
            id="game-model-rule-title"
            className={styles.input}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Np. Pressing po stracie"
            onKeyDown={(e) => {
              if (e.key === "Enter") addTemplate();
            }}
          />
          <label className={styles.srOnly} htmlFor="game-model-rule-level">
            Poziom zasady
          </label>
          <select
            id="game-model-rule-level"
            className={styles.select}
            value={newLevel}
            onChange={(e) => setNewLevel(Number(e.target.value) as GameModelRuleLevel)}
          >
            <option value={0}>Zasada</option>
            <option value={1}>Sub-zasada</option>
            <option value={2}>Sub-sub-zasada</option>
          </select>
          <button
            type="button"
            className={styles.addButton}
            onClick={addTemplate}
            disabled={!newTitle.trim()}
          >
            Dodaj do biblioteki
          </button>
        </div>

        <div className={styles.librarySectionsGrid}>
          {LIBRARY_LEVELS.map((level) => {
            const items = templatesByLevel[level];
            const isExpanded = expandedLibraryLevels.has(level);
            return (
              <section
                key={level}
                className={`${styles.librarySection} ${
                  dragOverLibraryLevel === level ? styles.librarySectionDragOver : ""
                }`}
                data-level={level}
                aria-label={GAME_MODEL_LEVEL_LABELS[level]}
                onDragOver={(e) => handleDragOverLibrary(e, level)}
                onDragLeave={() => setDragOverLibraryLevel(null)}
                onDrop={(e) => handleDropOnLibrary(e, level)}
              >
                <button
                  type="button"
                  className={styles.librarySectionHeader}
                  aria-expanded={isExpanded}
                  aria-controls={`library-level-body-${level}`}
                  onClick={() => toggleLibraryLevelExpanded(level)}
                >
                  <span className={styles.librarySectionChevron} aria-hidden="true">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <h3 className={styles.librarySectionTitle}>
                    {GAME_MODEL_LEVEL_LABELS[level]} ({items.length})
                  </h3>
                </button>
                <div
                  id={`library-level-body-${level}`}
                  className={`${styles.librarySectionBody} ${
                    !isExpanded ? styles.librarySectionBodyCollapsed : ""
                  }`}
                  hidden={!isExpanded}
                >
                  {items.length === 0 ? (
                    <p className={styles.emptyHint}>Upuść tutaj, aby przenieść do tej kategorii.</p>
                  ) : (
                    <ul className={styles.librarySectionList}>
                      {items.map((template) => (
                        <LibraryTemplateItem
                          key={template.id}
                          template={template}
                          usageCount={usageCounts.get(template.id) ?? 0}
                          dragTemplateId={effectiveDragTemplateId}
                          editingTemplateId={editingTemplateId}
                          templates={templates}
                          nodes={state.nodes}
                          onDragStartTemplate={handleDragStartTemplate}
                          onDragEnd={handleDragEnd}
                          onDeleteTemplate={deleteTemplate}
                          onStartEditTemplate={startEditTemplate}
                          onCancelEditTemplate={cancelEditTemplate}
                          onSaveTemplate={saveTemplate}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        {!hasTemplates && (
          <p className={styles.emptyHint}>Brak zasad w bibliotece — dodaj pierwszą powyżej.</p>
        )}
      </aside>
      {phasesSection}
    </div>
  );
}
