import type { GameModelRuleLevel } from "@/types/gameModel";

/** Fazy systemu pozycji — bez SFG na razie. */
export const POSITION_SYSTEM_PHASES = [
  { id: "defense", label: "Obrona", shortLabel: "Obrona" },
  { id: "attack", label: "Atak", shortLabel: "Atak" },
] as const;

export type PositionSystemPhaseId = (typeof POSITION_SYSTEM_PHASES)[number]["id"];

/** Role taktyczne — spójne ze składem wyjściowym (`StartingLineupSlot.role`). */
export const POSITION_ROLES = [
  { id: "GK", label: "Bramkarz", shortLabel: "BR" },
  { id: "CB", label: "Środkowy obrońca", shortLabel: "ŚO" },
  { id: "LB", label: "Lewy obrońca", shortLabel: "LO" },
  { id: "RB", label: "Prawy obrońca", shortLabel: "PO" },
  { id: "DM", label: "Defensywny pomocnik", shortLabel: "ŚPD" },
  { id: "CM", label: "Środkowy pomocnik", shortLabel: "ŚP" },
  { id: "AM", label: "Ofensywny pomocnik", shortLabel: "ŚPO" },
  { id: "LW", label: "Lewy skrzydłowy", shortLabel: "LS" },
  { id: "RW", label: "Prawy skrzydłowy", shortLabel: "PS" },
  { id: "ST", label: "Napastnik", shortLabel: "N" },
] as const;

export type PositionRoleId = (typeof POSITION_ROLES)[number]["id"];

export const POSITION_TASK_LEVEL_LABELS: Record<GameModelRuleLevel, string> = {
  0: "Zasada",
  1: "Sub-zasada",
  2: "Sub-sub-zasada",
};

/** Węzeł przypisany do pozycji i fazy (obrona/atak). Szablony = biblioteka modelu gry. */
export interface PositionTaskNode {
  id: string;
  positionId: PositionRoleId;
  phaseId: PositionSystemPhaseId;
  templateId: string;
  /** Rodzice w drzewie — sub-zasady mogą mieć wielu rodziców (współdzielone węzły). */
  parentIds: string[];
  order: number;
}

export interface PositionSystemState {
  nodes: PositionTaskNode[];
}

export const POSITION_SYSTEM_VERSION = 3 as const;

/** Dokument w `teams/{teamId}/staff/` (legacy: `users/{uid}/tasks/`). Nie pokazuj w Eisenhowerze. */
export const POSITION_SYSTEM_TASKS_DOC_ID = "positionSystemState" as const;
