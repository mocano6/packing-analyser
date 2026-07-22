/** Fazy modelu gry — stabilne id (zapis w Firestore). */
export const GAME_MODEL_PHASES = [
  { id: "defense", label: "Obrona", shortLabel: "Obrona" },
  { id: "attack", label: "Atak", shortLabel: "Atak" },
  { id: "set_pieces", label: "Stałe fragmenty gry", shortLabel: "SFG" },
] as const;

export type GameModelPhaseId = (typeof GAME_MODEL_PHASES)[number]["id"];

/** 0 = zasada, 1 = sub-zasada, 2 = sub-sub-zasada */
export type GameModelRuleLevel = 0 | 1 | 2;

export const GAME_MODEL_LEVEL_LABELS: Record<GameModelRuleLevel, string> = {
  0: "Zasada",
  1: "Sub-zasada",
  2: "Sub-sub-zasada",
};

/** Priorytet zasady/zachowania — pomaga sztabowi odróżnić rzeczy kluczowe od wspierających. */
export type GameModelRulePriority = "key" | "support";

export const GAME_MODEL_PRIORITY_LABELS: Record<GameModelRulePriority, string> = {
  key: "Kluczowa",
  support: "Wspierająca",
};

/** Szablon zasady w bibliotece (panel boczny) — bez stałego rodzica; przypisanie w modelu. */
export interface GameModelRuleTemplate {
  id: string;
  title: string;
  level: GameModelRuleLevel;
  /** Definicja „co to znaczy u nas” — 1–3 zdania. */
  description?: string;
  /** Trigger / kiedy zachowanie ma wystąpić (np. „strata w środkowej strefie”). */
  trigger?: string;
  /** Priorytet w modelu gry (domyślnie brak = wspierająca). */
  priority?: GameModelRulePriority;
}

/** Węzeł przypisany do fazy w modelu gry. */
export interface GameModelNode {
  id: string;
  templateId: string;
  phaseId: GameModelPhaseId;
  /** Rodzic w drzewie modelu w tej samej fazie (null = korzeń fazy). */
  parentId: string | null;
  order: number;
}

export interface GameModelState {
  templates: GameModelRuleTemplate[];
  nodes: GameModelNode[];
}

export const GAME_MODEL_VERSION = 2 as const;

/** Dokument w `teams/{teamId}/staff/` (legacy: `users/{uid}/tasks/`). Nie pokazuj w Eisenhowerze. */
export const GAME_MODEL_TASKS_DOC_ID = "gameModelState" as const;
