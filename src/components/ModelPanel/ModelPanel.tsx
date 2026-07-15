"use client";

import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import GameModelTab from "@/components/GameModelTab/GameModelTab";
import PositionSystemTab from "@/components/PositionSystemTab/PositionSystemTab";
import type { GameModelRuleLevel, GameModelState } from "@/types/gameModel";
import {
  GAME_MODEL_LEVEL_LABELS,
} from "@/types/gameModel";
import type { PositionRoleId, PositionSystemState } from "@/types/positionSystem";
import type { GameModelNode } from "@/types/gameModel";
import type { PositionTaskNode } from "@/types/positionSystem";
import {
  applyTemplateLibraryUpdateWithCascade,
  buildTemplateUsageCounts,
  countTemplateUsage,
  deleteTemplateFromLibrary,
  groupTemplatesByLevel,
  nodesRemovedByTemplateLevelChange,
  templateById,
  validateTemplateLibraryUpdate,
  type TemplateLibraryUpdatePatch,
} from "@/utils/gameModelTree";
import {
  nodesRemovedByPositionTemplateLevelChange,
  removeAllPositionNodesForTemplate,
  removePositionNodeIds,
} from "@/utils/positionSystemTree";
import styles from "./ModelPanel.module.css";

const LIBRARY_LEVELS: GameModelRuleLevel[] = [0, 1, 2];
const LIBRARY_DRAG_MIME = "application/json";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildCombinedTemplateUsageCounts(
  gameNodes: GameModelNode[],
  positionNodes: PositionTaskNode[]
): Map<string, number> {
  const counts = buildTemplateUsageCounts(gameNodes);
  for (const node of positionNodes) {
    counts.set(node.templateId, (counts.get(node.templateId) ?? 0) + 1);
  }
  return counts;
}

export interface ModelPanelProps {
  gameModelState: GameModelState;
  setGameModelState: React.Dispatch<React.SetStateAction<GameModelState>>;
  gameModelLoading: boolean;
  positionSystemState: PositionSystemState;
  setPositionSystemState: React.Dispatch<React.SetStateAction<PositionSystemState>>;
  positionSystemLoading: boolean;
}

function TemplateEditForm({
  templateId,
  templates,
  onSave,
  onCancel,
}: {
  templateId: string;
  templates: GameModelState["templates"];
  onSave: (templateId: string, patch: TemplateLibraryUpdatePatch) => void;
  onCancel: () => void;
}) {
  const template = templateById(templates, templateId);
  const [title, setTitle] = useState(template?.title ?? "");
  const [level, setLevel] = useState<GameModelRuleLevel>(template?.level ?? 0);

  React.useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setLevel(template.level);
  }, [template]);

  if (!template) return null;

  return (
    <div className={styles.editPanel}>
      <label className={styles.editPanelLabel} htmlFor={`lib-edit-title-${templateId}`}>
        Treść
      </label>
      <input
        id={`lib-edit-title-${templateId}`}
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(templateId, { title, level });
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <label className={styles.editPanelLabel} htmlFor={`lib-edit-level-${templateId}`}>
        Poziom
      </label>
      <select
        id={`lib-edit-level-${templateId}`}
        className={styles.select}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value) as GameModelRuleLevel)}
      >
        <option value={0}>Zasada</option>
        <option value={1}>Sub-zasada</option>
        <option value={2}>Sub-sub-zasada</option>
      </select>
      <p className={styles.editPanelHint}>
        Te same zasady przypisujesz do modelu drużyny i do poszczególnych pozycji.
      </p>
      <div className={styles.editActions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => onSave(templateId, { title, level })}
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

export default function ModelPanel({
  gameModelState,
  setGameModelState,
  gameModelLoading,
  positionSystemState,
  setPositionSystemState,
  positionSystemLoading,
}: ModelPanelProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState<GameModelRuleLevel>(0);
  const [expandedLibraryLevels, setExpandedLibraryLevels] = useState<Set<GameModelRuleLevel>>(
    () => new Set([0])
  );
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragOverLibraryLevel, setDragOverLibraryLevel] = useState<GameModelRuleLevel | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<PositionRoleId>("GK");

  const loading = gameModelLoading || positionSystemLoading;

  const usageCounts = useMemo(
    () =>
      buildCombinedTemplateUsageCounts(gameModelState.nodes, positionSystemState.nodes),
    [gameModelState.nodes, positionSystemState.nodes]
  );

  const templatesByLevel = useMemo(
    () => groupTemplatesByLevel(gameModelState.templates),
    [gameModelState.templates]
  );

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

  const deleteTemplate = useCallback(
    (templateId: string) => {
      if (editingTemplateId === templateId) setEditingTemplateId(null);
      const template = templateById(gameModelState.templates, templateId);
      if (!template) return;
      const usage =
        countTemplateUsage(gameModelState.nodes, templateId) +
        positionSystemState.nodes.filter((n) => n.templateId === templateId).length;
      if (usage > 0 && typeof window !== "undefined") {
        const confirmed = window.confirm(
          `"${template.title}" jest przypisana ${usage}× (drużyna + pozycje). Usunąć z biblioteki?`
        );
        if (!confirmed) return;
      }
      const { templates, nodes, removedNodeCount: gameRemoved } = deleteTemplateFromLibrary(
        gameModelState.templates,
        gameModelState.nodes,
        templateId
      );
      const positionNodes = removeAllPositionNodesForTemplate(
        positionSystemState.nodes,
        templateId
      );
      const positionRemoved = positionSystemState.nodes.length - positionNodes.length;
      setGameModelState({ templates, nodes });
      setPositionSystemState({ nodes: positionNodes });
      const total = gameRemoved + positionRemoved;
      if (total > 0) {
        toast.success(`Usunięto szablon i ${total} przypisań.`);
      }
    },
    [
      gameModelState.templates,
      gameModelState.nodes,
      positionSystemState.nodes,
      setGameModelState,
      setPositionSystemState,
      editingTemplateId,
    ]
  );

  const saveTemplate = useCallback(
    (templateId: string, patch: TemplateLibraryUpdatePatch, options?: { skipConfirm?: boolean }) => {
      const template = templateById(gameModelState.templates, templateId);
      if (!template) return;

      const result = validateTemplateLibraryUpdate(
        gameModelState.templates,
        gameModelState.nodes,
        templateId,
        patch
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const levelChanging = patch.level !== template.level;
      const gameRemovedIds = nodesRemovedByTemplateLevelChange(
        gameModelState.nodes,
        gameModelState.templates,
        templateId,
        patch
      );
      const positionRemovedIds = nodesRemovedByPositionTemplateLevelChange(
        positionSystemState.nodes,
        gameModelState.templates,
        templateId,
        patch
      );
      const totalRemoved = gameRemovedIds.length + positionRemovedIds.length;
      const usage = usageCounts.get(templateId) ?? 0;

      if (
        levelChanging &&
        totalRemoved > 0 &&
        !options?.skipConfirm &&
        typeof window !== "undefined"
      ) {
        const confirmed = window.confirm(
          `"${template.title}" jest użyta ${usage}×. Po zmianie kategorii zostanie usunięta z ${totalRemoved} miejsc. Kontynuować?`
        );
        if (!confirmed) return;
      }

      const { templates, nodes } = applyTemplateLibraryUpdateWithCascade(
        gameModelState.templates,
        gameModelState.nodes,
        templateId,
        patch
      );
      const positionNodes = removePositionNodeIds(positionSystemState.nodes, positionRemovedIds);
      setGameModelState({ templates, nodes });
      setPositionSystemState({ nodes: positionNodes });
      setEditingTemplateId(null);

      if (totalRemoved > 0) {
        toast.success(`Zapisano. Usunięto ${totalRemoved} przypisań.`);
      } else {
        toast.success("Zapisano zmiany.");
      }
    },
    [
      gameModelState.templates,
      gameModelState.nodes,
      positionSystemState.nodes,
      setGameModelState,
      setPositionSystemState,
      usageCounts,
    ]
  );

  const changeTemplateLevel = useCallback(
    (templateId: string, newLevel: GameModelRuleLevel) => {
      const template = templateById(gameModelState.templates, templateId);
      if (!template || template.level === newLevel) return;
      saveTemplate(templateId, { title: template.title, level: newLevel });
    },
    [gameModelState.templates, saveTemplate]
  );

  const handleDragStartTemplate = useCallback((e: React.DragEvent, templateId: string) => {
    setDragTemplateId(templateId);
    e.dataTransfer.setData(
      LIBRARY_DRAG_MIME,
      JSON.stringify({ kind: "template", templateId })
    );
    e.dataTransfer.effectAllowed = "copyMove";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragTemplateId(null);
    setDragOverLibraryLevel(null);
  }, []);

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
      try {
        const raw = e.dataTransfer.getData(LIBRARY_DRAG_MIME);
        const o = JSON.parse(raw) as { kind?: string; templateId?: string };
        if (o.kind === "template" && typeof o.templateId === "string") {
          changeTemplateLevel(o.templateId, level);
        }
      } catch {
        /* ignore */
      }
      handleDragEnd();
    },
    [changeTemplateLevel, handleDragEnd]
  );

  if (loading) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie modelu…
      </div>
    );
  }

  const hasTemplates = gameModelState.templates.length > 0;

  return (
    <div className={styles.modelPanel}>
      <aside className={styles.library} aria-label="Biblioteka zasad zespołowych">
        <h2 className={styles.libraryTitle}>Biblioteka zasad</h2>
        <p className={styles.libraryHint}>
          Niebieskie = zasady, zielone = sub-zasady, fioletowe = sub-sub-zasady. Przeciągnij na
          model drużyny lub zadania pozycji obok. Liczba przy zasadzie = wszystkie przypisania.
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
                      {items.map((template) => {
                        const isEditing = editingTemplateId === template.id;
                        const usageCount = usageCounts.get(template.id) ?? 0;
                        return (
                          <li key={template.id} className={styles.libraryRow}>
                            <div
                              className={`${styles.draggableChip} ${
                                isEditing ? styles.chipNotDraggable : ""
                              } ${dragTemplateId === template.id ? styles.draggableChipDragging : ""}`}
                              data-level={template.level}
                              draggable={!isEditing}
                              onDragStart={
                                isEditing
                                  ? undefined
                                  : (e) => handleDragStartTemplate(e, template.id)
                              }
                              onDragEnd={handleDragEnd}
                            >
                              <div className={styles.chipBody}>
                                <button
                                  type="button"
                                  className={styles.chipTitleButton}
                                  onClick={() => setEditingTemplateId(template.id)}
                                >
                                  {template.title}
                                </button>
                              </div>
                              <div className={styles.chipMeta}>
                                <span
                                  className={`${styles.usageBadge} ${
                                    usageCount > 0 ? styles.usageBadgeActive : ""
                                  }`}
                                  title={`Przypisania: ${usageCount}×`}
                                >
                                  {usageCount}
                                </span>
                                <div className={styles.chipActionsRow}>
                                  <button
                                    type="button"
                                    className={`${styles.editButton} ${
                                      isEditing ? styles.editButtonActive : ""
                                    }`}
                                    onClick={() =>
                                      isEditing
                                        ? setEditingTemplateId(null)
                                        : setEditingTemplateId(template.id)
                                    }
                                  >
                                    {isEditing ? "✕" : "✎"}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.deleteButton}
                                    onClick={() => deleteTemplate(template.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            </div>
                            {isEditing && (
                              <TemplateEditForm
                                templateId={template.id}
                                templates={gameModelState.templates}
                                onSave={saveTemplate}
                                onCancel={() => setEditingTemplateId(null)}
                              />
                            )}
                          </li>
                        );
                      })}
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

      <div className={styles.modelPanelMain}>
        <GameModelTab
          embedded
          state={gameModelState}
          setGameModelState={setGameModelState}
          loading={false}
          templates={gameModelState.templates}
          usageCounts={usageCounts}
          editingTemplateId={editingTemplateId}
          onStartEditTemplate={setEditingTemplateId}
          onCancelEditTemplate={() => setEditingTemplateId(null)}
          onSaveTemplate={saveTemplate}
          dragTemplateId={dragTemplateId}
          onLibraryDragEnd={handleDragEnd}
        />
        <PositionSystemTab
          embedded
          templates={gameModelState.templates}
          state={positionSystemState}
          setPositionSystemState={setPositionSystemState}
          loading={false}
          editingTemplateId={editingTemplateId}
          onStartEditTemplate={setEditingTemplateId}
          onCancelEditTemplate={() => setEditingTemplateId(null)}
          onSaveTemplate={saveTemplate}
          dragTemplateId={dragTemplateId}
          onLibraryDragEnd={handleDragEnd}
          selectedPositionId={selectedPositionId}
          onSelectedPositionChange={setSelectedPositionId}
          gameModelNodes={gameModelState.nodes}
        />
      </div>
    </div>
  );
}
