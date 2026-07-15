import type { GameModelNode, GameModelRuleLevel, GameModelRuleTemplate } from "@/types/gameModel";
import type {
  PositionRoleId,
  PositionSystemPhaseId,
  PositionTaskNode,
} from "@/types/positionSystem";
import { POSITION_SYSTEM_PHASES } from "@/types/positionSystem";
import { collectModelSubtreeNodeIds } from "@/utils/gameModelTree";

export type PositionSystemTreeNode<T extends PositionTaskNode = PositionTaskNode> = T & {
  children: PositionSystemTreeNode<T>[];
};

function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Normalizuje parentIds (kompatybilność z legacy parentId). */
export function positionNodeParentIds(
  node: PositionTaskNode | { parentIds?: string[]; parentId?: string | null }
): string[] {
  if (Array.isArray(node.parentIds)) return node.parentIds;
  const legacy = (node as { parentId?: string | null }).parentId;
  return legacy == null || legacy === "" ? [] : [legacy];
}

export function positionNodeIsRoot(node: PositionTaskNode): boolean {
  return positionNodeParentIds(node).length === 0;
}

export function positionNodeHasParent(node: PositionTaskNode, parentId: string): boolean {
  return positionNodeParentIds(node).includes(parentId);
}

export function normalizePositionTaskNode(
  node: PositionTaskNode | (Omit<PositionTaskNode, "parentIds"> & { parentId?: string | null })
): PositionTaskNode {
  const { parentId: _legacy, ...rest } = node as PositionTaskNode & { parentId?: string | null };
  return {
    ...rest,
    parentIds: positionNodeParentIds(node),
  };
}

export function buildPositionSystemTree(
  items: PositionTaskNode[],
  parentId: string | null = null
): PositionSystemTreeNode[] {
  const matched =
    parentId === null
      ? sortByOrder(items.filter(positionNodeIsRoot))
      : sortByOrder(items.filter((item) => positionNodeHasParent(item, parentId)));
  return matched.map((item) => ({
    ...item,
    children: buildPositionSystemTree(items, item.id),
  }));
}

export function positionNodeIsShared(node: PositionTaskNode): boolean {
  return positionNodeParentIds(node).length > 1;
}

export type PositionPhaseGraphEdge = { fromId: string; toId: string };

export type PositionPhaseGraphLayer = {
  level: GameModelRuleLevel;
  nodes: PositionTaskNode[];
};

export type PositionPhaseGraphLayout = {
  layers: PositionPhaseGraphLayer[];
  edges: PositionPhaseGraphEdge[];
};

function graphLayerSortKey(node: PositionTaskNode, phaseNodes: PositionTaskNode[]): number {
  const parentIds = positionNodeParentIds(node);
  if (parentIds.length === 0) return node.order;
  const parentOrders = parentIds.map(
    (pid) => phaseNodes.find((n) => n.id === pid)?.order ?? 0
  );
  return Math.min(...parentOrders) * 1000 + node.order;
}

/**
 * Warstwowy graf fazy — każdy węzeł raz, krawędzie z wszystkich rodziców (scalanie linii w UI).
 */
export function buildPositionPhaseGraphLayout(
  phaseNodes: PositionTaskNode[],
  templates: GameModelRuleTemplate[]
): PositionPhaseGraphLayout {
  const edges: PositionPhaseGraphEdge[] = [];
  for (const node of phaseNodes) {
    for (const parentId of positionNodeParentIds(node)) {
      edges.push({ fromId: parentId, toId: node.id });
    }
  }

  const layers: PositionPhaseGraphLayer[] = ([0, 1, 2] as GameModelRuleLevel[])
    .map((level) => ({
      level,
      nodes: [...phaseNodes.filter((n) => positionNodeLevel(n, templates) === level)].sort(
        (a, b) => graphLayerSortKey(a, phaseNodes) - graphLayerSortKey(b, phaseNodes)
      ),
    }))
    .filter((layer) => layer.nodes.length > 0);

  return { layers, edges };
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
  const subtreeIds = new Set(collectPositionSubtreeNodeIds(nodes, nodeId));
  if (subtreeIds.has(candidateParentId)) return true;
  return false;
}

export function nextOrderForPositionParent(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  parentId: string | null
): number {
  const siblings =
    parentId === null
      ? nodes.filter(
          (n) =>
            n.positionId === positionId && n.phaseId === phaseId && positionNodeIsRoot(n)
        )
      : nodes.filter(
          (n) =>
            n.positionId === positionId &&
            n.phaseId === phaseId &&
            positionNodeHasParent(n, parentId)
        );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((n) => n.order)) + 1;
}

export function findPositionNodeByTemplateInScope(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  templateId: string,
  templates: GameModelRuleTemplate[],
  options?: { sharedOnly?: boolean }
): PositionTaskNode | undefined {
  const template = positionTemplateById(templates, templateId);
  if (!template) return undefined;
  const sharedOnly = options?.sharedOnly ?? template.level >= 1;
  if (!sharedOnly) return undefined;
  return nodes.find(
    (n) =>
      n.positionId === positionId && n.phaseId === phaseId && n.templateId === templateId
  );
}

export function hasDuplicatePositionTemplateUnderParent(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  parentId: string | null,
  templateId: string,
  excludeNodeId?: string
): boolean {
  if (parentId === null) {
    return nodes.some(
      (n) =>
        n.positionId === positionId &&
        n.phaseId === phaseId &&
        positionNodeIsRoot(n) &&
        n.templateId === templateId &&
        n.id !== excludeNodeId
    );
  }
  return nodes.some(
    (n) =>
      n.positionId === positionId &&
      n.phaseId === phaseId &&
      positionNodeHasParent(n, parentId) &&
      n.templateId === templateId &&
      n.id !== excludeNodeId
  );
}

export function isPositionNodeLinkedToParent(
  node: PositionTaskNode,
  parentId: string | null
): boolean {
  if (parentId === null) return positionNodeIsRoot(node);
  return positionNodeHasParent(node, parentId);
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

  const existingShared = findPositionNodeByTemplateInScope(
    nodes,
    target.positionId,
    target.phaseId,
    template.id,
    templates
  );
  if (existingShared && existingShared.id !== excludeNodeId) {
    if (
      target.parentId != null &&
      positionNodeHasParent(existingShared, target.parentId)
    ) {
      return {
        ok: false,
        message: "Ten element jest już przypisany pod tym rodzicem dla tej pozycji i fazy.",
      };
    }
    if (template.level >= 1) {
      return { ok: true };
    }
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
  if (positionNodeParentIds(node).length > 1) {
    return {
      ok: false,
      message: "Współdzielonego elementu nie można przenieść — usuń go z bieżącego rodzica.",
    };
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

export function linkPositionNodeToParent(
  nodes: PositionTaskNode[],
  nodeId: string,
  parentId: string
): PositionTaskNode[] {
  return nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const parentIds = positionNodeParentIds(n);
    if (parentIds.includes(parentId)) return n;
    return { ...n, parentIds: [...parentIds, parentId] };
  });
}

export function placePositionTemplate(
  nodes: PositionTaskNode[],
  template: GameModelRuleTemplate,
  target: PositionSystemPlacementTarget,
  templates: GameModelRuleTemplate[],
  createNodeId: () => string
):
  | { ok: true; nodes: PositionTaskNode[]; nodeId: string; linked: boolean }
  | { ok: false; message: string } {
  const validation = validatePositionTemplatePlacement(nodes, template, target, templates);
  if (!validation.ok) return validation;

  const existing = findPositionNodeByTemplateInScope(
    nodes,
    target.positionId,
    target.phaseId,
    template.id,
    templates
  );

  if (existing && template.level >= 1 && target.parentId) {
    return {
      ok: true,
      linked: true,
      nodeId: existing.id,
      nodes: linkPositionNodeToParent(nodes, existing.id, target.parentId),
    };
  }

  const id = createNodeId();
  const order = nextOrderForPositionParent(
    nodes,
    target.positionId,
    target.phaseId,
    target.parentId
  );
  return {
    ok: true,
    linked: false,
    nodeId: id,
    nodes: [
      ...nodes,
      {
        id,
        templateId: template.id,
        positionId: target.positionId,
        phaseId: target.phaseId,
        parentIds: target.parentId ? [target.parentId] : [],
        order,
      },
    ],
  };
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
        parentIds: target.parentId ? [target.parentId] : [],
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

export function removePositionNode(
  nodes: PositionTaskNode[],
  nodeId: string,
  underParentId: string | null
): PositionTaskNode[] {
  const node = positionNodeById(nodes, nodeId);
  if (!node) return nodes;

  const parentIds = positionNodeParentIds(node);

  if (
    underParentId != null &&
    parentIds.includes(underParentId) &&
    parentIds.length > 1
  ) {
    return nodes.map((n) =>
      n.id === nodeId
        ? { ...n, parentIds: parentIds.filter((id) => id !== underParentId) }
        : n
    );
  }

  let next = nodes.filter((n) => n.id !== nodeId);

  for (const candidate of nodes) {
    if (candidate.id === nodeId) continue;
    const candidateParentIds = positionNodeParentIds(candidate);
    if (!candidateParentIds.includes(nodeId)) continue;

    const newParentIds = candidateParentIds.filter((id) => id !== nodeId);
    if (newParentIds.length === 0 && !positionNodeIsRoot({ ...candidate, parentIds: [] })) {
      next = removePositionNode(next, candidate.id, null);
    } else {
      next = next.map((n) =>
        n.id === candidate.id ? { ...n, parentIds: newParentIds } : n
      );
    }
  }

  return next;
}

export function filterNodesForPositionAndPhase(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): PositionTaskNode[] {
  return nodes.filter((n) => n.positionId === positionId && n.phaseId === phaseId);
}

export function countUniquePositionTemplates(
  nodes: PositionTaskNode[],
  positionId?: PositionRoleId,
  phaseId?: PositionSystemPhaseId
): number {
  const scoped = nodes.filter(
    (n) =>
      (positionId == null || n.positionId === positionId) &&
      (phaseId == null || n.phaseId === phaseId)
  );
  return new Set(scoped.map((n) => n.templateId)).size;
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

export function buildPositionScopedUniqueUsageCounts(
  nodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): Map<string, number> {
  const scoped = filterNodesForPositionAndPhase(nodes, positionId, phaseId);
  const counts = new Map<string, number>();
  for (const node of scoped) {
    counts.set(node.templateId, 1);
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
    for (const child of nodes.filter((n) => positionNodeHasParent(n, id))) {
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
    const primaryParentId = positionNodeParentIds(node)[0] ?? null;
    const parentNode =
      primaryParentId === null ? null : positionNodeById(nodes, primaryParentId) ?? null;
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
  return countUniquePositionTemplates(nodes, positionId);
}

export function countGameModelPhaseNodes(
  gameModelNodes: GameModelNode[],
  phaseId: PositionSystemPhaseId
): number {
  return gameModelNodes.filter((n) => n.phaseId === phaseId).length;
}

/** Usuwa wszystkie węzły pozycji w danej fazie. */
export function removePositionPhaseNodes(
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): PositionTaskNode[] {
  const idsInPhase = new Set(
    positionNodes
      .filter((n) => n.positionId === positionId && n.phaseId === phaseId)
      .map((n) => n.id)
  );
  return positionNodes.filter((n) => !idsInPhase.has(n.id));
}

export function countPositionPhaseNodes(
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId
): number {
  return countUniquePositionTemplates(positionNodes, positionId, phaseId);
}

/**
 * Scala duplikaty sub-zasad w tej samej pozycji × fazie (legacy / import).
 * Korzenie (poziom 0) pozostają osobno; dzieci z tym samym templateId → jeden węzeł z wieloma rodzicami.
 */
export function dedupePositionNodesByTemplate(
  nodes: PositionTaskNode[]
): PositionTaskNode[] {
  const normalized = nodes.map(normalizePositionTaskNode);
  const roots = normalized.filter(positionNodeIsRoot);
  const nonRoots = normalized.filter((n) => !positionNodeIsRoot(n));

  const groups = new Map<string, PositionTaskNode[]>();
  for (const node of nonRoots) {
    const key = `${node.positionId}|${node.phaseId}|${node.templateId}`;
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  }

  const idRemap = new Map<string, string>();
  const merged: PositionTaskNode[] = [...roots];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const keeper = group[0];
    const allParentIds = new Set<string>();
    for (const node of group) {
      for (const pid of positionNodeParentIds(node)) allParentIds.add(pid);
      if (node.id !== keeper.id) idRemap.set(node.id, keeper.id);
    }
    merged.push({
      ...keeper,
      parentIds: [...allParentIds],
      order: Math.min(...group.map((n) => n.order)),
    });
  }

  return merged.map((node) => {
    const parentIds = positionNodeParentIds(node)
      .map((id) => idRemap.get(id) ?? id)
      .filter((id, index, arr) => arr.indexOf(id) === index);
    return { ...node, parentIds };
  });
}

function cloneGameModelNodeToPosition(
  gameNode: GameModelNode,
  gameNodes: GameModelNode[],
  subtreeIds: Set<string>,
  positionNodes: PositionTaskNode[],
  templates: GameModelRuleTemplate[],
  positionId: PositionRoleId,
  phaseId: PositionSystemPhaseId,
  parentPositionId: string | null,
  idMap: Map<string, string>,
  createNodeId: () => string,
  newNodes: PositionTaskNode[]
): PositionTaskNode[] {
  if (!subtreeIds.has(gameNode.id)) return positionNodes;

  const template = positionTemplateById(templates, gameNode.templateId);
  if (!template) return positionNodes;

  let currentNodes = positionNodes;
  let positionNodeId: string;

  if (template.level >= 1) {
    const existing = findPositionNodeByTemplateInScope(
      currentNodes,
      positionId,
      phaseId,
      gameNode.templateId,
      templates
    );
    if (existing) {
      positionNodeId = existing.id;
      if (parentPositionId) {
        currentNodes = linkPositionNodeToParent(currentNodes, existing.id, parentPositionId);
      }
      idMap.set(gameNode.id, positionNodeId);
    } else {
      positionNodeId = createNodeId();
      idMap.set(gameNode.id, positionNodeId);
      const order =
        parentPositionId === null
          ? nextOrderForPositionParent(currentNodes, positionId, phaseId, null)
          : gameNode.order;
      newNodes.push({
        id: positionNodeId,
        positionId,
        phaseId,
        templateId: gameNode.templateId,
        parentIds: parentPositionId ? [parentPositionId] : [],
        order,
      });
    }
  } else {
    positionNodeId = createNodeId();
    idMap.set(gameNode.id, positionNodeId);
    const order = nextOrderForPositionParent(
      [...currentNodes, ...newNodes],
      positionId,
      phaseId,
      parentPositionId
    );
    newNodes.push({
      id: positionNodeId,
      positionId,
      phaseId,
      templateId: gameNode.templateId,
      parentIds: parentPositionId ? [parentPositionId] : [],
      order,
    });
  }

  const children = gameNodes
    .filter((n) => n.parentId === gameNode.id)
    .sort((a, b) => a.order - b.order);

  for (const child of children) {
    currentNodes = cloneGameModelNodeToPosition(
      child,
      gameNodes,
      subtreeIds,
      currentNodes,
      templates,
      positionId,
      phaseId,
      idMap.get(gameNode.id) ?? positionNodeId,
      idMap,
      createNodeId,
      newNodes
    );
  }

  return currentNodes;
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
  createNodeId: () => string,
  templates: GameModelRuleTemplate[]
): { nodes: PositionTaskNode[]; copiedCount: number } {
  const sourceNodes = gameModelNodes.filter((n) => n.phaseId === phaseId);
  if (sourceNodes.length === 0) {
    return { nodes: positionNodes, copiedCount: 0 };
  }

  const withoutPhase = removePositionPhaseNodes(positionNodes, positionId, phaseId);
  const idMap = new Map<string, string>();
  const newNodes: PositionTaskNode[] = [];
  let workingNodes = withoutPhase;

  const roots = sourceNodes
    .filter((n) => n.parentId === null)
    .sort((a, b) => a.order - b.order);

  for (const root of roots) {
    const subtreeIds = new Set(collectModelSubtreeNodeIds(sourceNodes, root.id));
    workingNodes = cloneGameModelNodeToPosition(
      root,
      sourceNodes,
      subtreeIds,
      workingNodes,
      templates,
      positionId,
      phaseId,
      null,
      idMap,
      createNodeId,
      newNodes
    );
  }

  return {
    nodes: dedupePositionNodesByTemplate([...workingNodes, ...newNodes]),
    copiedCount: countUniquePositionTemplates(
      dedupePositionNodesByTemplate([...workingNodes, ...newNodes]),
      positionId,
      phaseId
    ),
  };
}

/** Kopiuje fazy obrona + atak z modelu drużyny do wybranej pozycji. */
export function copyGameModelPhasesToPosition(
  gameModelNodes: GameModelNode[],
  positionNodes: PositionTaskNode[],
  positionId: PositionRoleId,
  createNodeId: () => string,
  templates: GameModelRuleTemplate[]
): { nodes: PositionTaskNode[]; copiedCount: number } {
  let nodes = positionNodes;
  let copiedCount = 0;
  for (const phase of POSITION_SYSTEM_PHASES) {
    const result = copyGameModelPhaseToPositionPhase(
      gameModelNodes,
      nodes,
      positionId,
      phase.id,
      createNodeId,
      templates
    );
    nodes = result.nodes;
    copiedCount += result.copiedCount;
  }
  return { nodes, copiedCount };
}

/**
 * Kopiuje poddrzewo węzła z modelu drużyny do wskazanego miejsca w systemie pozycji (bez usuwania ze źródła).
 * Sub-zasady (poziom 1+) są współdzielone w ramach pozycji × fazy.
 */
export function copyGameModelSubtreeToPositionTarget(
  gameModelNodes: GameModelNode[],
  positionNodes: PositionTaskNode[],
  templates: GameModelRuleTemplate[],
  gameModelNodeId: string,
  target: PositionSystemPlacementTarget,
  createNodeId: () => string
): { ok: true; nodes: PositionTaskNode[]; linkedCount: number; createdCount: number } | { ok: false; message: string } {
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

  const placed = placePositionTemplate(
    positionNodes,
    rootTemplate,
    target,
    templates,
    createNodeId
  );
  if (!placed.ok) return placed;

  let workingNodes = placed.nodes;
  idMap.set(rootNode.id, placed.nodeId);

  for (const child of phaseGameNodes
    .filter((n) => n.parentId === rootNode.id)
    .sort((a, b) => a.order - b.order)) {
    workingNodes = cloneGameModelNodeToPosition(
      child,
      phaseGameNodes,
      subtreeIds,
      workingNodes,
      templates,
      target.positionId,
      target.phaseId,
      placed.nodeId,
      idMap,
      createNodeId,
      newNodes
    );
  }

  const finalNodes = dedupePositionNodesByTemplate([...workingNodes, ...newNodes]);
  const uniqueAfter = countUniquePositionTemplates(
    finalNodes,
    target.positionId,
    target.phaseId
  );
  const uniqueBefore = countUniquePositionTemplates(
    positionNodes,
    target.positionId,
    target.phaseId
  );

  return {
    ok: true,
    nodes: finalNodes,
    createdCount: Math.max(0, uniqueAfter - uniqueBefore),
    linkedCount: placed.linked ? 1 : 0,
  };
}
