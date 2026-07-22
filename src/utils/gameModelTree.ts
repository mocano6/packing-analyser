import type {
  GameModelNode,
  GameModelPhaseId,
  GameModelRuleLevel,
  GameModelRulePriority,
  GameModelRuleTemplate,
} from "@/types/gameModel";

export type GameModelTreeNode<T extends { id: string; parentId: string | null }> = T & {
  children: GameModelTreeNode<T>[];
};

function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function buildGameModelTree<T extends { id: string; parentId: string | null; order?: number }>(
  items: T[],
  parentId: string | null = null
): GameModelTreeNode<T>[] {
  return sortByOrder(items.filter((item) => item.parentId === parentId)).map((item) => ({
    ...item,
    children: buildGameModelTree(items, item.id),
  }));
}

export function templateById(
  templates: GameModelRuleTemplate[],
  id: string
): GameModelRuleTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function nodeById(nodes: GameModelNode[], id: string): GameModelNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** Poziom węzła modelu = poziom szablonu. */
export function nodeLevel(
  node: GameModelNode,
  templates: GameModelRuleTemplate[]
): GameModelRuleLevel | null {
  const tpl = templateById(templates, node.templateId);
  return tpl?.level ?? null;
}

export function canDropTemplateOnTarget(
  template: GameModelRuleTemplate,
  targetParentNode: GameModelNode | null,
  templates: GameModelRuleTemplate[]
): boolean {
  if (template.level === 0) return targetParentNode === null;
  if (!targetParentNode) return false;
  const parentLevel = nodeLevel(targetParentNode, templates);
  if (parentLevel === null) return false;
  return template.level === parentLevel + 1;
}

export function canMoveNodeUnderParent(
  node: GameModelNode,
  newParent: GameModelNode | null,
  templates: GameModelRuleTemplate[]
): boolean {
  const tpl = templateById(templates, node.templateId);
  if (!tpl) return false;
  return canDropTemplateOnTarget(tpl, newParent, templates);
}

/** Sprawdza, czy `candidateParentId` nie jest potomkiem `nodeId`. */
export function wouldCreateCycle(
  nodes: GameModelNode[],
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
    const parent = nodeById(nodes, current);
    current = parent?.parentId ?? null;
  }
  return false;
}

export function nextOrderForParent(
  nodes: GameModelNode[],
  phaseId: GameModelPhaseId,
  parentId: string | null
): number {
  const siblings = nodes.filter((n) => n.phaseId === phaseId && n.parentId === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((n) => n.order)) + 1;
}

/** Ten sam szablon może wystąpić tylko raz pod danym rodzicem w fazie. */
export function hasDuplicateTemplateUnderParent(
  nodes: GameModelNode[],
  phaseId: GameModelPhaseId,
  parentId: string | null,
  templateId: string,
  excludeNodeId?: string
): boolean {
  return nodes.some(
    (n) =>
      n.phaseId === phaseId &&
      n.parentId === parentId &&
      n.templateId === templateId &&
      n.id !== excludeNodeId
  );
}

export type GameModelPlacementTarget = {
  phaseId: GameModelPhaseId;
  parentId: string | null;
};

export function validateTemplatePlacement(
  nodes: GameModelNode[],
  template: GameModelRuleTemplate,
  target: GameModelPlacementTarget,
  templates: GameModelRuleTemplate[],
  excludeNodeId?: string
): { ok: true } | { ok: false; message: string } {
  const parentNode =
    target.parentId === null ? null : nodeById(nodes, target.parentId) ?? null;
  if (!canDropTemplateOnTarget(template, parentNode, templates)) {
    return { ok: false, message: "Ta zasada nie pasuje na wybrany poziom hierarchii." };
  }
  if (
    hasDuplicateTemplateUnderParent(
      nodes,
      target.phaseId,
      target.parentId,
      template.id,
      excludeNodeId
    )
  ) {
    return {
      ok: false,
      message: "Ten element jest już przypisany pod tym rodzicem w tej fazie.",
    };
  }
  return { ok: true };
}

export function validateNodeMove(
  nodes: GameModelNode[],
  nodeId: string,
  target: GameModelPlacementTarget,
  templates: GameModelRuleTemplate[]
): { ok: true } | { ok: false; message: string } {
  const node = nodeById(nodes, nodeId);
  if (!node) {
    return { ok: false, message: "Nie znaleziono elementu do przeniesienia." };
  }
  if (wouldCreateCycle(nodes, nodeId, target.parentId)) {
    return { ok: false, message: "Nie można przenieść węzła do własnego potomka." };
  }
  const tpl = templateById(templates, node.templateId);
  if (!tpl) {
    return { ok: false, message: "Nie znaleziono szablonu zasady." };
  }
  return validateTemplatePlacement(nodes, tpl, target, templates, nodeId);
}

/** Przenosi węzeł modelu wraz z całym poddrzewem (ta sama faza lub zmiana fazy dla wszystkich). */
export function moveModelNodeWithSubtree(
  nodes: GameModelNode[],
  nodeId: string,
  target: GameModelPlacementTarget,
  templates: GameModelRuleTemplate[]
): { ok: true; nodes: GameModelNode[] } | { ok: false; message: string } {
  const validation = validateNodeMove(nodes, nodeId, target, templates);
  if (!validation.ok) return validation;

  const subtreeIds = new Set(collectModelSubtreeNodeIds(nodes, nodeId));
  const order = nextOrderForParent(
    nodes.filter((n) => !subtreeIds.has(n.id)),
    target.phaseId,
    target.parentId
  );

  const nextNodes = nodes.map((n) => {
    if (n.id === nodeId) {
      return { ...n, phaseId: target.phaseId, parentId: target.parentId, order };
    }
    if (subtreeIds.has(n.id)) {
      return { ...n, phaseId: target.phaseId };
    }
    return n;
  });

  return { ok: true, nodes: nextNodes };
}

export function filterNodesForPhase(nodes: GameModelNode[], phaseId: GameModelPhaseId): GameModelNode[] {
  return nodes.filter((n) => n.phaseId === phaseId);
}

/** Fazy modelu, w których szablon jest przypisany (unikalne, stała kolejność). */
export function templatePhaseIds(
  nodes: GameModelNode[],
  templateId: string
): GameModelPhaseId[] {
  const order: GameModelPhaseId[] = ["defense", "attack", "set_pieces"];
  const found = new Set<GameModelPhaseId>();
  for (const n of nodes) {
    if (n.templateId === templateId) found.add(n.phaseId);
  }
  return order.filter((p) => found.has(p));
}

export type GameModelLibraryPhaseFilter = GameModelPhaseId | "all" | "unassigned";

/** Filtr biblioteki mikrocyklu: faza z drzewa, nieprzypisane albo wszystko. */
export function filterTemplatesByPhase(
  templates: GameModelRuleTemplate[],
  nodes: GameModelNode[],
  phaseFilter: GameModelLibraryPhaseFilter
): GameModelRuleTemplate[] {
  if (phaseFilter === "all") return templates;
  if (phaseFilter === "unassigned") {
    const assigned = new Set(nodes.map((n) => n.templateId));
    return templates.filter((t) => !assigned.has(t.id));
  }
  const inPhase = new Set(
    nodes.filter((n) => n.phaseId === phaseFilter).map((n) => n.templateId)
  );
  return templates.filter((t) => inPhase.has(t.id));
}

export function countTemplateUsage(nodes: GameModelNode[], templateId: string): number {
  return nodes.filter((n) => n.templateId === templateId).length;
}

export function buildTemplateUsageCounts(nodes: GameModelNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    counts.set(node.templateId, (counts.get(node.templateId) ?? 0) + 1);
  }
  return counts;
}

export function groupTemplatesByLevel(
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

export type TemplateLibraryUpdatePatch = {
  title: string;
  level: GameModelRuleLevel;
  /** Pola merytoryczne — pomijane w patchu (np. przy przeciąganiu poziomu) są zachowywane. */
  description?: string;
  trigger?: string;
  priority?: GameModelRulePriority;
};

/** Wszystkie węzły modelu w poddrzewie (łącznie z korzeniem). */
export function collectModelSubtreeNodeIds(nodes: GameModelNode[], rootId: string): string[] {
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

/**
 * Szablony potomne przypisane pod danym elementem w modelu gry (wszystkie fazy).
 * Zasada → sub-zasady i sub-sub-zasady; sub-zasada → sub-sub-zasady.
 */
export function collectDescendantTemplatesForDrop(
  templates: GameModelRuleTemplate[],
  nodes: GameModelNode[],
  templateId: string
): GameModelRuleTemplate[] {
  const rootTemplate = templateById(templates, templateId);
  if (!rootTemplate) return [];

  const descendantIds = new Set<string>();
  for (const rootNode of nodes.filter((n) => n.templateId === templateId)) {
    const phaseNodes = nodes.filter((n) => n.phaseId === rootNode.phaseId);
    for (const nodeId of collectModelSubtreeNodeIds(phaseNodes, rootNode.id)) {
      if (nodeId === rootNode.id) continue;
      const node = nodeById(phaseNodes, nodeId);
      if (!node) continue;
      const tpl = templateById(templates, node.templateId);
      if (tpl && tpl.level > rootTemplate.level) {
        descendantIds.add(tpl.id);
      }
    }
  }

  return [...descendantIds]
    .map((id) => templateById(templates, id))
    .filter((t): t is GameModelRuleTemplate => !!t)
    .sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "pl"));
}

/** Główny szablon + potomkowie z modelu — kolejność do dropu w mikrocyklu. */
export function templatesToAssignOnMicrocycleDrop(
  templates: GameModelRuleTemplate[],
  nodes: GameModelNode[],
  templateId: string
): GameModelRuleTemplate[] {
  const root = templateById(templates, templateId);
  if (!root) return [];
  const descendants = collectDescendantTemplatesForDrop(templates, nodes, templateId);
  return [root, ...descendants.filter((d) => d.id !== root.id)];
}

export function removeNodeIds(nodes: GameModelNode[], idsToRemove: Iterable<string>): GameModelNode[] {
  const set = new Set(idsToRemove);
  return nodes.filter((n) => !set.has(n.id));
}

/** Usuwa z modelu wszystkie wystąpienia szablonu wraz z poddrzewami. */
export function removeAllNodesForTemplate(nodes: GameModelNode[], templateId: string): GameModelNode[] {
  const toRemove = new Set<string>();
  for (const node of nodes.filter((n) => n.templateId === templateId)) {
    for (const id of collectModelSubtreeNodeIds(nodes, node.id)) {
      toRemove.add(id);
    }
  }
  return removeNodeIds(nodes, toRemove);
}

/** Węzły usunięte po zmianie poziomu szablonu (niepasujące przypisania). */
export function nodesRemovedByTemplateLevelChange(
  nodes: GameModelNode[],
  templates: GameModelRuleTemplate[],
  templateId: string,
  patch: TemplateLibraryUpdatePatch
): string[] {
  const finalTemplates = applyTemplateLibraryUpdate(templates, templateId, patch);
  const updatedTemplate = templateById(finalTemplates, templateId);
  if (!updatedTemplate) return [];

  const toRemove = new Set<string>();
  for (const node of nodes.filter((n) => n.templateId === templateId)) {
    const parentNode =
      node.parentId === null ? null : nodeById(nodes, node.parentId) ?? null;
    if (!canDropTemplateOnTarget(updatedTemplate, parentNode, finalTemplates)) {
      for (const id of collectModelSubtreeNodeIds(nodes, node.id)) {
        toRemove.add(id);
      }
    }
  }
  return [...toRemove];
}

export function buildTemplateLevelChangeConfirmMessage(
  title: string,
  usageCount: number,
  removedNodeCount: number
): string {
  return (
    `"${title}" jest użyta w modelu gry (${usageCount}×). ` +
    `Po zmianie kategorii zostanie usunięta z ${removedNodeCount} miejsc w fazach ` +
    `(trzeba będzie dodać ją ponownie). Kontynuować?`
  );
}

export function validateTemplateLibraryUpdate(
  templates: GameModelRuleTemplate[],
  _nodes: GameModelNode[],
  _templateId: string,
  patch: TemplateLibraryUpdatePatch
): { ok: true } | { ok: false; message: string } {
  const title = patch.title.trim();
  if (!title) {
    return { ok: false, message: "Tytuł nie może być pusty." };
  }
  return { ok: true };
}

export function applyTemplateLibraryUpdate(
  templates: GameModelRuleTemplate[],
  templateId: string,
  patch: TemplateLibraryUpdatePatch
): GameModelRuleTemplate[] {
  return templates.map((t) => {
    if (t.id !== templateId) return t;
    const next: GameModelRuleTemplate = { ...t, title: patch.title.trim(), level: patch.level };
    if (patch.description !== undefined) {
      const d = patch.description.trim();
      if (d) next.description = d;
      else delete next.description;
    }
    if (patch.trigger !== undefined) {
      const tr = patch.trigger.trim();
      if (tr) next.trigger = tr;
      else delete next.trigger;
    }
    if (patch.priority !== undefined) {
      if (patch.priority) next.priority = patch.priority;
      else delete next.priority;
    }
    return next;
  });
}

export function applyTemplateLibraryUpdateWithCascade(
  templates: GameModelRuleTemplate[],
  nodes: GameModelNode[],
  templateId: string,
  patch: TemplateLibraryUpdatePatch
): { templates: GameModelRuleTemplate[]; nodes: GameModelNode[]; removedNodeCount: number } {
  const removedIds = nodesRemovedByTemplateLevelChange(nodes, templates, templateId, patch);
  return {
    templates: applyTemplateLibraryUpdate(templates, templateId, patch),
    nodes: removeNodeIds(nodes, removedIds),
    removedNodeCount: removedIds.length,
  };
}

export function deleteTemplateFromLibrary(
  templates: GameModelRuleTemplate[],
  nodes: GameModelNode[],
  templateId: string
): { templates: GameModelRuleTemplate[]; nodes: GameModelNode[]; removedNodeCount: number } {
  const nextNodes = removeAllNodesForTemplate(nodes, templateId);
  return {
    templates: templates.filter((t) => t.id !== templateId),
    nodes: nextNodes,
    removedNodeCount: nodes.length - nextNodes.length,
  };
}
