import { FOOTBALL_FORMATIONS, getFormationById } from "./startingLineup";

export type TeamFormationBoardSlots = Record<string, string[]>;

export interface TeamFormationBoardStorage {
  selectedFormationId: string;
  formations: Record<string, TeamFormationBoardSlots>;
}

export function createEmptyFormationBoard(formationId: string): TeamFormationBoardSlots {
  const formation = getFormationById(formationId);
  return Object.fromEntries(formation.slots.map((slot) => [slot.slotId, []]));
}

export function normalizeTeamFormationBoardStorage(
  raw: Partial<TeamFormationBoardStorage> | null | undefined
): TeamFormationBoardStorage {
  const selectedFormationId = raw?.selectedFormationId || FOOTBALL_FORMATIONS[0].id;
  const formations = { ...(raw?.formations ?? {}) };

  for (const formation of FOOTBALL_FORMATIONS) {
    const existing = formations[formation.id] ?? {};
    formations[formation.id] = {
      ...createEmptyFormationBoard(formation.id),
      ...existing,
    };
  }

  return { selectedFormationId, formations };
}

export function assignPlayerToFormationSlot(
  board: TeamFormationBoardSlots,
  slotId: string,
  playerId: string
): TeamFormationBoardSlots {
  const next = Object.fromEntries(
    Object.entries(board).map(([id, playerIds]) => [id, playerIds.filter((id) => id !== playerId)])
  ) as TeamFormationBoardSlots;

  next[slotId] = [...(next[slotId] ?? []), playerId];
  return next;
}

export function removePlayerFromFormationBoard(
  board: TeamFormationBoardSlots,
  playerId: string
): TeamFormationBoardSlots {
  return Object.fromEntries(
    Object.entries(board).map(([slotId, playerIds]) => [slotId, playerIds.filter((id) => id !== playerId)])
  ) as TeamFormationBoardSlots;
}

export function pruneFormationBoardPlayers(
  board: TeamFormationBoardSlots,
  availablePlayerIds: Set<string>
): TeamFormationBoardSlots {
  return Object.fromEntries(
    Object.entries(board).map(([slotId, playerIds]) => [
      slotId,
      playerIds.filter((playerId) => availablePlayerIds.has(playerId)),
    ])
  ) as TeamFormationBoardSlots;
}
