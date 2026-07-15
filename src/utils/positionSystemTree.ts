import type { GameModelNode, GameModelRuleLevel, GameModelRuleTemplate } from "@/types/gameModel";
import type {
  PositionRoleId,
  PositionSystemPhaseId,
  PositionTaskNode,
} from "@/types/positionSystem";
import { POSITION_SYSTEM_PHASES } from "@/types/positionSystem";
import { collectModelSubtreeNodeIds } from "@/utils/gameModelTree";

export type PositionSystemTreeNode<T extends { id: string; parentId: string | null }> = T & {
  children: PositionSystemTreeNode<T>[];
};

function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function buildPositionSystemTree<
  T extends { id: string; parentId: string | null; order?: number },
>(items: T[], parentId: string | null = null): PositionSystemTreeNode<T>[] {
  return sortByOrder(items.filter((item) => item.parentId === parentId)).map((item) => ({
    ...item,
    children: buildPositionSystemTree(items, item.id),
  }));
}

export function positionTemplateById(
  templates: GameModelRuleTemplate[],
  id: string
): GameModelRuleTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function positionNodeById(
  nodes: PositionTaskNode[],
  id: string
): PositionTaskNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function positionNodeLevel(
  node: PositionTaskNode,
  templates: GameModelRuleTemplate[]
): GameModelRuleLevel | null {
  const tpl = positionTemplateById(templates, node.templateId);
  return tpl?.level ?? null;
}

export function canDropPositionTemplateOnTarget(
  template: GameModelRuleTemplate,
  targetParentNode: PositionTaskNode | null,
  templates: GameModelRuleTemplate[]
): boolean {
  if (template.level === 0) return targetParentNode === null;
  if (!targetParentNode) return false;
  const parentLevel = positionNodeLevel(targetParentNode, templates);
  if (parentLevel === null) return false;
  return template.level === parentLevel + 1;
}

export function canMovePositionNodeUnderParent(
  node: PositionTaskNode,
  newParent: PositionTaskNode | null,
  templates: GameModelRuleTemplate[]
): boolean {
  const tpl = positionTemplateById(templates, node.templateId);
  if (!tpl) return false;
  return canDropPositionTemplateOnTarget(tpl, newParent, templates);
}

export function wouldCreatePositionCycle(
  nodes: PositionTaskNode[],
  nodeId: string,
  candidateParentId: string | null
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === nodeId) return true;
  let current: string | null = candidateParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === nodeId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const parent = positionNodeById(nodes, current);
    current = parent?.parentId ?? null;
  }
  return false;
}

export function nextOrderForPositionParent(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  parentId: string | null
): number {
  const siblings = nodes.filter(
    (n) => n.positionId === positionId && n.phaseId === phaseId && n.parentId === parentId
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((n) => n.order)) + 1;
}

export function hasDuplicatePositionTemplateUnderParent(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  parentId: string | null,
  templateId: string,
  excludeNodeId?: string
): boolean {
  return nodes.some(
    (n) =>
      n.positionId === positionId &&
      n.phaseId === phaseId &&
      n.parentId === parentId &&
      n.templateId === templateId &&
      n.id !== excludeNodeId
  );
}

export type PositionSystemPlacementTarget = {
  positionId: PositionRoleId;
  phaseId: PositionSystemPhaseId;
  parentId: string | null;
};

export function validatePositionTemplatePlacement(
  nodes: PositionTaskNode[],
  template: GameModelRuleTemplate,
  target: PositionSystemPlacementTarget,
  templates: GameModelRuleTemplate[],
  excludeNodeId?: string
): { ok: true } | { ok: false; message: string } {
  const parentNode =
    target.parentId === null ? null : positionNodeById(nodes, target.parentId) ?? null;
  if (!canDropPositionTemplateOnTarget(template, parentNode, templates)) {
    return { ok: false, message: "To zadanie nie pasuje na wybrany poziom hierarchii." };
  }
  if (
    hasDuplicatePositionTemplateUnderParent(
      nodes,
      target.positionId,
      target.phaseId,
      target.parentId,
      template.id,
      excludeNodeId
    )
  ) {
    return {
      ok: false,
      message: "Ten element jest już przypisany pod tym rodzicem dla tej pozycji i fazy.",
    };
  }
  return { ok: true };
}

export function validatePositionNodeMove(
  nodes: PositionTaskNode[],
  nodeId: string,
  target: PositionSystemPlacementTarget,
  templates: GameModelRuleTemplate[]
): { ok: true } | { ok: false; message: string } {
  const node = positionNodeById(nodes, nodeId);
  if (!node) {
    return { ok: false, message: "Nie znaleziono elementu do przeniesienia." };
  }
  if (wouldCreatePositionCycle(nodes, nodeId, target.parentId)) {
    return { ok: false, message: "Nie można przenieść węzła do własnego potomka." };
  }
  const tpl = positionTemplateById(templates, node.templateId);
  if (!tpl) {
    return { ok: false, message: "Nie znaleziono szablonu zadania." };
  }
  return validatePositionTemplatePlacement(nodes, tpl, target, templates, nodeId);
}

export function movePositionNodeWithSubtree(
  nodes: PositionTaskNode[],
  nodeId: string,
  target: PositionSystemPlacementTarget,
  templates: GameModelRuleTemplate[]
): { ok: true; nodes: PositionTaskNode[] } | { ok: false; message: string } {
  const validation = validatePositionNodeMove(nodes, nodeId, target, templates);
  if (!validation.ok) return validation;

  const subtreeIds = new Set(collectPositionSubtreeNodeIds(nodes, nodeId));
  const order = nextOrderForPositionParent(
    nodes.filter((n) => !subtreeIds.has(n.id)),
    target.positionId,
    target.phaseId,
    target.parentId
  );

  const nextNodes = nodes.map((n) => {
    if (n.id === nodeId) {
      return {
        ...n,
        positionId: target.positionId,
        phaseId: target.phaseId,
        parentId: target.parentId,
        order,
      };
    }
    if (subtreeIds.has(n.id)) {
      return { ...n, positionId: target.positionId, phaseId: target.phaseId };
    }
    return n;
  });

  return { ok: true, nodes: nextNodes };
}

export function filterNodesForPositionAndPhase(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): PositionTaskNode[] {
  return nodes.filter((n) => n.positionId === positionId && n.phaseId === phaseId);
}

export function countPositionTemplateUsage(
  nodes: PositionTaskNode[],
  templateId: string
): number {
  return nodes.filter((n) => n.templateId === templateId).length;
}

export function buildPositionTemplateUsageCounts(
  nodes: PositionTaskNode[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    counts.set(node.templateId, (counts.get(node.templateId) ?? 0) + 1);
  }
  return counts;
}

export function groupPositionTemplatesByLevel(
  templates: GameModelRuleTemplate[]
): Record<GameModelRuleLevel, GameModelRuleTemplate[]> {
  const grouped: Record<GameModelRuleLevel, GameModelRuleTemplate[]> = {
    0: [],
    1: [],
    2: [],
  };
  for (const template of templates) {
    grouped[template.level].push(template);
  }
  for (const level of [0, 1, 2] as GameModelRuleLevel[]) {
    grouped[level].sort((a, b) => a.title.localeCompare(b.title, "pl"));
  }
  return grouped;
}

export type PositionTemplateLibraryUpdatePatch = {
  title: string;
  level: GameModelRuleLevel;
};

export function collectPositionSubtreeNodeIds(
  nodes: PositionTaskNode[],
  rootId: string
): string[] {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of nodes.filter((n) => n.parentId === id)) {
      stack.push(child.id);
    }
  }
  return out;
}

export function removePositionNodeIds(
  nodes: PositionTaskNode[],
  idsToRemove: Iterable<string>
): PositionTaskNode[] {
  const set = new Set(idsToRemove);
  return nodes.filter((n) => !set.has(n.id));
}

export function removeAllPositionNodesForTemplate(
  nodes: PositionTaskNode[],
  templateId: string
): PositionTaskNode[] {
  const toRemove = new Set<string>();
  for (const node of nodes.filter((n) => n.templateId === templateId)) {
    for (const id of collectPositionSubtreeNodeIds(nodes, node.id)) {
      toRemove.add(id);
    }
  }
  return removePositionNodeIds(nodes, toRemove);
}

export function nodesRemovedByPositionTemplateLevelChange(
  nodes: PositionTaskNode[],
  templates: GameModelRuleTemplate[],
  templateId: string,
  patch: PositionTemplateLibraryUpdatePatch
): string[] {
  const finalTemplates = applyPositionTemplateLibraryUpdate(templates, templateId, patch);
  const updatedTemplate = positionTemplateById(finalTemplates, templateId);
  if (!updatedTemplate) return [];

  const toRemove = new Set<string>();
  for (const node of nodes.filter((n) => n.templateId === templateId)) {
    const parentNode =
      node.parentId === null ? null : positionNodeById(nodes, node.parentId) ?? null;
    if (!canDropPositionTemplateOnTarget(updatedTemplate, parentNode, finalTemplates)) {
      for (const id of collectPositionSubtreeNodeIds(nodes, node.id)) {
        toRemove.add(id);
      }
    }
  }
  return [...toRemove];
}

export function buildPositionTemplateLevelChangeConfirmMessage(
  title: string,
  usageCount: number,
  removedNodeCount: number
): string {
  return (
    `"${title}" jest użyta w systemie pozycji (${usageCount}×). ` +
    `Po zmianie kategorii zostanie usunięta z ${removedNodeCount} miejsc ` +
    `(trzeba będzie dodać ją ponownie). Kontynuować?`
  );
}

export function validatePositionTemplateLibraryUpdate(
  _templates: GameModelRuleTemplate[],
  _templateId: string,
  patch: PositionTemplateLibraryUpdatePatch
): { ok: true } | { ok: false; message: string } {
  const title = patch.title.trim();
  if (!title) {
    return { ok: false, message: "Tytuł nie może być pusty." };
  }
  return { ok: true };
}

export function applyPositionTemplateLibraryUpdate(
  templates: GameModelRuleTemplate[],
  templateId: string,
  patch: PositionTemplateLibraryUpdatePatch
): GameModelRuleTemplate[] {
  return templates.map((t) =>
    t.id === templateId ? { ...t, title: patch.title.trim(), level: patch.level } : t
  );
}

export function applyPositionTemplateLibraryUpdateWithCascade(
  templates: GameModelRuleTemplate[],
  nodes: PositionTaskNode[],
  templateId: string,
  patch: PositionTemplateLibraryUpdatePatch
): { templates: GameModelRuleTemplate[]; nodes: PositionTaskNode[]; removedNodeCount: number } {
  const removedIds = nodesRemovedByPositionTemplateLevelChange(
    nodes,
    templates,
    templateId,
    patch
  );
  return {
    templates: applyPositionTemplateLibraryUpdate(templates, templateId, patch),
    nodes: removePositionNodeIds(nodes, removedIds),
    removedNodeCount: removedIds.length,
  };
}

export function deletePositionTemplateFromLibrary(
  templates: GameModelRuleTemplate[],
  nodes: PositionTaskNode[],
  templateId: string
): { templates: GameModelRuleTemplate[]; nodes: PositionTaskNode[]; removedNodeCount: number } {
  const nextNodes = removeAllPositionNodesForTemplate(nodes, templateId);
  return {
    templates: templates.filter((t) => t.id !== templateId),
    nodes: nextNodes,
    removedNodeCount: nodes.length - nextNodes.length,
  };
}

export function countNodesForPosition(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId
): number {
  return nodes.filter((n) => n.positionId === positionId).length;
}

export function countGameModelPhaseNodes(
  gameModelNodes: GameModelNode[],
  phaseId: PositionSystemPhaseId
): number {
  return gameModelNodes.filter((n) => n.phaseId === phaseId).length;
}

/** Usuwa wszystkie węzły pozycji w danej fazie (z poddrzewami). */
export function removePositionPhaseNodes(
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): PositionTaskNode[] {
  const idsToRemove = new Set<string>();
  for (const node of positionNodes.filter(
    (n) => n.positionId === positionId && n.phaseId === phaseId
  )) {
    for (const id of collectPositionSubtreeNodeIds(positionNodes, node.id)) {
      idsToRemove.add(id);
    }
  }
  return removePositionNodeIds(positionNodes, idsToRemove);
}

export function countPositionPhaseNodes(
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): number {
  return positionNodes.filter((n) => n.positionId === positionId && n.phaseId === phaseId).length;
}

/**
 * Kopiuje drzewo z modelu drużyny (faza obrona/atak) do wybranej pozycji.
 * Zastępuje istniejące przypisania w tej fazie pozycji.
 */
export function copyGameModelPhaseToPositionPhase(
  gameModelNodes: GameModelNode[],
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  createNodeId: () => string
): { nodes: PositionTaskNode[]; copiedCount: number } {
  const sourceNodes = gameModelNodes.filter((n) => n.phaseId === phaseId);
  if (sourceNodes.length === 0) {
    return { nodes: positionNodes, copiedCount: 0 };
  }

  const withoutPhase = removePositionPhaseNodes(positionNodes, positionId, phaseId);
  const idMap = new Map<string, string>();
  const newNodes: PositionTaskNode[] = [];

  function cloneNode(gameNode: GameModelNode): void {
    const newId = createNodeId();
    idMap.set(gameNode.id, newId);
    const parentId =
      gameNode.parentId === null ? null : (idMap.get(gameNode.parentId) ?? null);
    newNodes.push({
      id: newId,
      positionId,
      phaseId,
      templateId: gameNode.templateId,
      parentId,
      order: gameNode.order,
    });
    const children = sourceNodes
      .filter((n) => n.parentId === gameNode.id)
      .sort((a, b) => a.order - b.order);
    for (const child of children) {
      cloneNode(child);
    }
  }

  const roots = sourceNodes
    .filter((n) => n.parentId === null)
    .sort((a, b) => a.order - b.order);
  for (const root of roots) {
    cloneNode(root);
  }

  return { nodes: [...withoutPhase, ...newNodes], copiedCount: newNodes.length };
}

/** Kopiuje fazy obrona + atak z modelu drużyny do wybranej pozycji. */
export function copyGameModelPhasesToPosition(
  gameModelNodes: GameModelNode[],
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  createNodeId: () => string
): { nodes: PositionTaskNode[]; copiedCount: number } {
  let nodes = positionNodes;
  let copiedCount = 0;
  for (const phase of POSITION_SYSTEM_PHASES) {
    const result = copyGameModelPhaseToPositionPhase(
      gameModelNodes,
      nodes,
      positionId,
      phase.id,
      createNodeId
    );
    nodes = result.nodes;
    copiedCount += result.copiedCount;
  }
  return { nodes, copiedCount };
}

/**
 * Kopiuje poddrzewo węzła z modelu drużyny do wskazanego miejsca w systemie pozycji (bez usuwania ze źródła).
 */
export function copyGameModelSubtreeToPositionTarget(
  gameModelNodes: GameModelNode[],
  positionNodes: PositionTaskNode[],
  templates: GameModelRuleTemplate[],
  gameModelNodeId: string,
  target: PositionSystemPlacementTarget,
  createNodeId: () => string
): { ok: true; nodes: PositionTaskNode[]; copiedCount: number } | { ok: false; message: string } {
  const sourceRoot = gameModelNodes.find((n) => n.id === gameModelNodeId);
  if (!sourceRoot) {
    return { ok: false, message: "Nie znaleziono elementu w modelu drużyny." };
  }
  const rootNode = sourceRoot;
  if (rootNode.phaseId === "set_pieces") {
    return { ok: false, message: "Zasad SFG nie przypisujesz do pozycji." };
  }
  if (rootNode.phaseId !== target.phaseId) {
    return {
      ok: false,
      message: "Upuść w tej samej fazie (obrona → obrona, atak → atak).",
    };
  }

  const rootTemplate = positionTemplateById(templates, rootNode.templateId);
  if (!rootTemplate) {
    return { ok: false, message: "Nie znaleziono szablonu zasady." };
  }

  const validation = validatePositionTemplatePlacement(
    positionNodes,
    rootTemplate,
    target,
    templates
  );
  if (!validation.ok) return validation;

  const phaseGameNodes = gameModelNodes.filter((n) => n.phaseId === rootNode.phaseId);
  const subtreeIds = new Set(collectModelSubtreeNodeIds(phaseGameNodes, gameModelNodeId));
  const idMap = new Map<string, string>();
  const newNodes: PositionTaskNode[] = [];

  function cloneGameNode(gameNode: GameModelNode): void {
    if (!subtreeIds.has(gameNode.id)) return;

    const newId = createNodeId();
    idMap.set(gameNode.id, newId);
    const parentId =
      gameNode.id === rootNode.id
        ? target.parentId
        : gameNode.parentId === null
          ? null
          : (idMap.get(gameNode.parentId) ?? null);

    if (gameNode.id !== rootNode.id && parentId === null) return;

    const order =
      gameNode.id === rootNode.id
        ? nextOrderForPositionParent(
            positionNodes,
            target.positionId,
            target.phaseId,
            target.parentId
          )
        : gameNode.order;

    newNodes.push({
      id: newId,
      positionId: target.positionId,
      phaseId: target.phaseId,
      templateId: gameNode.templateId,
      parentId,
      order,
    });

    for (const child of phaseGameNodes
      .filter((n) => n.parentId === gameNode.id)
      .sort((a, b) => a.order - b.order)) {
      cloneGameNode(child);
    }
  }

  cloneGameNode(rootNode);

  return {
    ok: true,
    nodes: [...positionNodes, ...newNodes],
    copiedCount: newNodes.length,
  };
}
