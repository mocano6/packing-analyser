import type { PlayerMinutes, StartingLineup, StartingLineupSlot } from "@/types";

export interface FootballFormation {
  id: string;
  name: string;
  slots: Omit<StartingLineupSlot, "playerId">[];
}

export const FOOTBALL_FORMATIONS: FootballFormation[] = [
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      { slotId: "gk", label: "BR", role: "GK", x: 50, y: 90 },
      { slotId: "lb", label: "LO", role: "LB", x: 18, y: 72 },
      { slotId: "lcb", label: "LŚO", role: "CB", x: 38, y: 74 },
      { slotId: "rcb", label: "PŚO", role: "CB", x: 62, y: 74 },
      { slotId: "rb", label: "PO", role: "RB", x: 82, y: 72 },
      { slotId: "dm", label: "ŚPD", role: "DM", x: 50, y: 58 },
      { slotId: "lcm", label: "LŚP", role: "CM", x: 34, y: 46 },
      { slotId: "rcm", label: "PŚP", role: "CM", x: 66, y: 46 },
      { slotId: "lw", label: "LS", role: "LW", x: 18, y: 26 },
      { slotId: "st", label: "N", role: "ST", x: 50, y: 16 },
      { slotId: "rw", label: "PS", role: "RW", x: 82, y: 26 },
    ],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      { slotId: "gk", label: "BR", role: "GK", x: 50, y: 90 },
      { slotId: "lb", label: "LO", role: "LB", x: 18, y: 72 },
      { slotId: "lcb", label: "LŚO", role: "CB", x: 38, y: 74 },
      { slotId: "rcb", label: "PŚO", role: "CB", x: 62, y: 74 },
      { slotId: "rb", label: "PO", role: "RB", x: 82, y: 72 },
      { slotId: "ldm", label: "LŚPD", role: "DM", x: 38, y: 56 },
      { slotId: "rdm", label: "PŚPD", role: "DM", x: 62, y: 56 },
      { slotId: "lam", label: "LPO", role: "LW", x: 22, y: 36 },
      { slotId: "am", label: "ŚPO", role: "AM", x: 50, y: 34 },
      { slotId: "ram", label: "PPO", role: "RW", x: 78, y: 36 },
      { slotId: "st", label: "N", role: "ST", x: 50, y: 16 },
    ],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: [
      { slotId: "gk", label: "BR", role: "GK", x: 50, y: 90 },
      { slotId: "lcb", label: "LŚO", role: "CB", x: 30, y: 74 },
      { slotId: "cb", label: "ŚO", role: "CB", x: 50, y: 76 },
      { slotId: "rcb", label: "PŚO", role: "CB", x: 70, y: 74 },
      { slotId: "lwb", label: "LWB", role: "LW", x: 14, y: 52 },
      { slotId: "dm", label: "ŚPD", role: "DM", x: 50, y: 58 },
      { slotId: "lcm", label: "LŚP", role: "CM", x: 36, y: 42 },
      { slotId: "rcm", label: "PŚP", role: "CM", x: 64, y: 42 },
      { slotId: "rwb", label: "RWB", role: "RW", x: 86, y: 52 },
      { slotId: "lst", label: "LN", role: "ST", x: 40, y: 16 },
      { slotId: "rst", label: "PN", role: "ST", x: 60, y: 16 },
    ],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      { slotId: "gk", label: "BR", role: "GK", x: 50, y: 90 },
      { slotId: "lb", label: "LO", role: "LB", x: 18, y: 72 },
      { slotId: "lcb", label: "LŚO", role: "CB", x: 38, y: 74 },
      { slotId: "rcb", label: "PŚO", role: "CB", x: 62, y: 74 },
      { slotId: "rb", label: "PO", role: "RB", x: 82, y: 72 },
      { slotId: "lm", label: "LP", role: "LW", x: 18, y: 45 },
      { slotId: "lcm", label: "LŚP", role: "CM", x: 40, y: 48 },
      { slotId: "rcm", label: "PŚP", role: "CM", x: 60, y: 48 },
      { slotId: "rm", label: "PP", role: "RW", x: 82, y: 45 },
      { slotId: "lst", label: "LN", role: "ST", x: 40, y: 18 },
      { slotId: "rst", label: "PN", role: "ST", x: 60, y: 18 },
    ],
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    slots: [
      { slotId: "gk", label: "BR", role: "GK", x: 50, y: 90 },
      { slotId: "lcb", label: "LŚO", role: "CB", x: 30, y: 74 },
      { slotId: "cb", label: "ŚO", role: "CB", x: 50, y: 76 },
      { slotId: "rcb", label: "PŚO", role: "CB", x: 70, y: 74 },
      { slotId: "lm", label: "LP", role: "LW", x: 18, y: 50 },
      { slotId: "lcm", label: "LŚP", role: "CM", x: 40, y: 52 },
      { slotId: "rcm", label: "PŚP", role: "CM", x: 60, y: 52 },
      { slotId: "rm", label: "PP", role: "RW", x: 82, y: 50 },
      { slotId: "lw", label: "LS", role: "LW", x: 20, y: 24 },
      { slotId: "st", label: "N", role: "ST", x: 50, y: 16 },
      { slotId: "rw", label: "PS", role: "RW", x: 80, y: 24 },
    ],
  },
];

export function getFormationById(formationId: string): FootballFormation {
  return FOOTBALL_FORMATIONS.find((formation) => formation.id === formationId) ?? FOOTBALL_FORMATIONS[0];
}

export function createStartingLineup(formationId: string, existing?: StartingLineup): StartingLineup {
  const formation = getFormationById(formationId);
  const existingPlayersBySlot = new Map((existing?.slots ?? []).map((slot) => [slot.slotId, slot.playerId]));

  return {
    formationId: formation.id,
    slots: formation.slots.map((slot) => ({
      ...slot,
      playerId: existingPlayersBySlot.get(slot.slotId),
    })),
  };
}

export function assignPlayerToLineupSlot(
  lineup: StartingLineup,
  slotId: string,
  playerId: string
): StartingLineup {
  return {
    ...lineup,
    slots: lineup.slots.map((slot) => ({
      ...slot,
      playerId: slot.slotId === slotId ? playerId : slot.playerId === playerId ? undefined : slot.playerId,
    })),
  };
}

export function removePlayerFromLineup(lineup: StartingLineup, playerId: string): StartingLineup {
  return {
    ...lineup,
    slots: lineup.slots.map((slot) => ({
      ...slot,
      playerId: slot.playerId === playerId ? undefined : slot.playerId,
    })),
  };
}

export function mergeStartingLineupIntoPlayerMinutes(
  currentPlayerMinutes: PlayerMinutes[],
  lineup: StartingLineup,
  defaultEndMinute = 90
): PlayerMinutes[] {
  const slotsByPlayerId = new Map(
    lineup.slots
      .filter((slot): slot is StartingLineupSlot & { playerId: string } => Boolean(slot.playerId))
      .map((slot) => [slot.playerId, slot])
  );
  const playerIds = new Set([...currentPlayerMinutes.map((pm) => pm.playerId), ...slotsByPlayerId.keys()]);

  return Array.from(playerIds).map((playerId) => {
    const current = currentPlayerMinutes.find((pm) => pm.playerId === playerId);
    const slot = slotsByPlayerId.get(playerId);

    if (!slot) {
      return current ?? { playerId, startMinute: 0, endMinute: 0, status: "dostepny" };
    }

    return {
      ...current,
      playerId,
      startMinute: 1,
      endMinute: current && current.endMinute > 0 ? current.endMinute : defaultEndMinute,
      position: slot.role,
      status: "dostepny" as const,
    };
  });
}
