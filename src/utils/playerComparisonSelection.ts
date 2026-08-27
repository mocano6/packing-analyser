export const PLAYER_COMPARISON_SELECT_MAX = 6;
export const PLAYER_COMPARISON_SELECT_DEFAULT = 4;

export const PLAYER_COMPARISON_SERIES_COLORS = [
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#db2777",
] as const;

export const COMPARISON_POSITION_GROUP_ORDER = [
  "GK",
  "CB",
  "RB",
  "LB",
  "DM",
  "CM",
  "Skrzydłowi",
  "AM",
  "ST",
] as const;

export function comparisonPositionGroup(position: string): string {
  if (position === "LW" || position === "RW") return "Skrzydłowi";
  return position?.trim() || "Brak pozycji";
}

export function comparisonPositionGroupLabel(group: string): string {
  if (group === "Skrzydłowi") return "Skrzydłowi";
  return group;
}

export function comparisonRosterChipName(player: {
  lastName: string;
  playerName: string;
}): string {
  const last = player.lastName.trim();
  if (last) return last;
  const full = player.playerName.trim();
  return full || "—";
}

type NamedPlayer = {
  firstName: string;
  lastName: string;
  position: string;
};

export function groupComparisonPlayersByPosition<T extends NamedPlayer>(
  rows: T[],
): Array<{ group: string; rows: T[] }> {
  const byGroup = new Map<string, T[]>();
  for (const row of rows) {
    const group = comparisonPositionGroup(row.position);
    const list = byGroup.get(group) ?? [];
    list.push(row);
    byGroup.set(group, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => {
      if (comparisonPositionGroup(a.position) === "Skrzydłowi" && a.position !== b.position) {
        if (a.position === "LW") return -1;
        if (b.position === "LW") return 1;
      }
      const byLast = a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true });
      if (byLast !== 0) return byLast;
      return a.firstName.localeCompare(b.firstName, "pl", { sensitivity: "base", numeric: true });
    });
  }
  const known = new Set<string>(COMPARISON_POSITION_GROUP_ORDER);
  const extra = [...byGroup.keys()]
    .filter((group) => !known.has(group))
    .sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
  const order = [...COMPARISON_POSITION_GROUP_ORDER, ...extra];
  return order
    .filter((group) => (byGroup.get(group)?.length ?? 0) > 0)
    .map((group) => ({ group, rows: byGroup.get(group) ?? [] }));
}

export function toggleComparisonPlayerId(
  selected: string[],
  playerId: string,
  max = PLAYER_COMPARISON_SELECT_MAX,
): string[] {
  if (selected.includes(playerId)) {
    return selected.filter((id) => id !== playerId);
  }
  if (selected.length >= max) return selected;
  return [...selected, playerId];
}

export function sanitizeComparisonPlayerIds(
  selected: string[],
  availableIds: string[],
  max = PLAYER_COMPARISON_SELECT_MAX,
  fillWhenEmpty = PLAYER_COMPARISON_SELECT_DEFAULT,
): string[] {
  const available = new Set(availableIds);
  const kept: string[] = [];
  for (const id of selected) {
    if (!available.has(id) || kept.includes(id)) continue;
    kept.push(id);
    if (kept.length >= max) break;
  }
  if (kept.length > 0) return kept;
  return availableIds.slice(0, Math.min(max, fillWhenEmpty, availableIds.length));
}

export function uniquePlayerComparisonLabels(
  players: Array<{ playerId: string; playerName: string; number: number }>,
  maskName: (name: string) => string,
): Map<string, string> {
  const bases = players.map((player) => ({
    playerId: player.playerId,
    number: player.number,
    base: maskName(player.playerName).trim() || player.playerId,
  }));
  const counts = new Map<string, number>();
  for (const item of bases) {
    counts.set(item.base, (counts.get(item.base) ?? 0) + 1);
  }
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const item of bases) {
    let label =
      (counts.get(item.base) ?? 0) > 1 && item.number > 0 ? `${item.base} · ${item.number}` : item.base;
    if (used.has(label)) {
      label = `${label} · ${item.playerId.slice(0, 4)}`;
    }
    used.add(label);
    out.set(item.playerId, label);
  }
  return out;
}
