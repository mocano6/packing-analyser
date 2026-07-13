import type { StatsBombSquadPlayerRow } from "./statsbombCsvParser";

export type SetPieceTypeBreakdownMode = "goals" | "xg" | "volume";

export type SetPieceTypeDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  column: string;
};

export type SetPieceTypeBreakdownConfig = {
  mode: SetPieceTypeBreakdownMode;
  types: SetPieceTypeDefinition[];
};

export type SetPieceTypeBreakdownEntry = {
  id: string;
  label: string;
  shortLabel: string;
  per90: number;
  estimatedTotal: number;
  /** Udział w aktywności SF zawodnika (suma typów = 100%). */
  sharePct: number;
  isDominant: boolean;
};

const SET_PIECE_TYPE_CANDIDATES: {
  mode: SetPieceTypeBreakdownMode;
  types: Omit<SetPieceTypeDefinition, "column"> & { columns: string[] }[];
}[] = [
  {
    mode: "goals",
    types: [
      { id: "corner", label: "Rzut rożny", shortLabel: "Róg", columns: ["Goals from Corners"] },
      {
        id: "free_kick",
        label: "Rzut wolny",
        shortLabel: "Wolny",
        columns: ["Goals from Free Kicks"],
      },
      {
        id: "throw_in",
        label: "Rzut z autu",
        shortLabel: "Aut",
        columns: ["Goals from Throw-ins", "Goals from Throw Ins"],
      },
    ],
  },
  {
    mode: "xg",
    types: [
      { id: "corner", label: "Rzut rożny", shortLabel: "Róg", columns: ["Corner xG"] },
      {
        id: "free_kick",
        label: "Rzut wolny",
        shortLabel: "Wolny",
        columns: ["Free Kick xG", "Free Kicks xG"],
      },
      {
        id: "throw_in",
        label: "Rzut z autu",
        shortLabel: "Aut",
        columns: ["Throw-in xG", "Throw In xG"],
      },
    ],
  },
  {
    mode: "volume",
    types: [
      { id: "corner", label: "Rzut rożny", shortLabel: "Róg", columns: ["Corners"] },
      { id: "free_kick", label: "Rzut wolny", shortLabel: "Wolny", columns: ["Free Kicks"] },
      {
        id: "throw_in",
        label: "Rzut z autu",
        shortLabel: "Aut",
        columns: ["Throw-ins", "Throw Ins"],
      },
    ],
  },
];

export const SET_PIECE_BREAKDOWN_MODE_LABELS: Record<SetPieceTypeBreakdownMode, string> = {
  goals: "gole ze SF",
  xg: "xG ze SF",
  volume: "wykonania SF",
};

export const SET_PIECE_BREAKDOWN_MODE_NOTES: Record<SetPieceTypeBreakdownMode, string> = {
  goals: "Rodzaj SF wg goli sezonowych (per 90) — widać, w jakim typie zawodnik strzela ze stałych fragmentów.",
  xg: "Rodzaj SF wg xG tworzonego z danego typu stałego fragmentu (per 90).",
  volume:
    "Rodzaj SF wg wykonań rogów, wolnych i autów (per 90) — przybliżenie, gdy Squad nie ma goli ani xG per typ.",
};

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function collectSquadColumns(players: StatsBombSquadPlayerRow[]): string[] {
  const keys = new Set<string>();
  for (const player of players) {
    for (const key of Object.keys(player.numeric)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function resolveColumn(columns: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const match = columns.find((column) => normalizeLabel(column) === normalizeLabel(alias));
    if (match) return match;
  }
  return null;
}

function squadHasPositiveTypeValues(
  players: StatsBombSquadPlayerRow[],
  types: SetPieceTypeDefinition[],
): boolean {
  return players.some((player) =>
    types.some((type) => {
      const value = player.numeric[type.column];
      return Number.isFinite(value) && value > 1e-12;
    }),
  );
}

/** Wybiera kolumny Squad STATS do rozbicia SF na typy (gole → xG → wykonania). */
export function resolveSetPieceTypeBreakdownConfig(
  players: StatsBombSquadPlayerRow[],
): SetPieceTypeBreakdownConfig | null {
  if (players.length === 0) return null;
  const availableColumns = collectSquadColumns(players);

  for (const candidate of SET_PIECE_TYPE_CANDIDATES) {
    const types: SetPieceTypeDefinition[] = [];
    for (const type of candidate.types) {
      const column = resolveColumn(availableColumns, type.columns);
      if (column) {
        types.push({
          id: type.id,
          label: type.label,
          shortLabel: type.shortLabel,
          column,
        });
      }
    }
    if (types.length === 0) continue;
    if (!squadHasPositiveTypeValues(players, types)) continue;
    return { mode: candidate.mode, types };
  }

  return null;
}

export function buildPlayerSetPieceTypeBreakdown(
  player: StatsBombSquadPlayerRow,
  config: SetPieceTypeBreakdownConfig,
): SetPieceTypeBreakdownEntry[] {
  const drafts = config.types
    .map((type) => {
      const per90 = player.numeric[type.column];
      if (!Number.isFinite(per90) || per90 <= 1e-12) return null;
      const estimatedTotal = per90 * (player.minutes / 90);
      if (!Number.isFinite(estimatedTotal) || estimatedTotal <= 1e-12) return null;
      return { ...type, per90, estimatedTotal };
    })
    .filter((entry): entry is SetPieceTypeDefinition & { per90: number; estimatedTotal: number } =>
      Boolean(entry),
    );

  const total = drafts.reduce((sum, entry) => sum + entry.estimatedTotal, 0);
  if (total <= 1e-12) return [];

  let dominantId = drafts[0]!.id;
  let maxShare = 0;

  const entries: SetPieceTypeBreakdownEntry[] = drafts.map((entry) => {
    const sharePct = (entry.estimatedTotal / total) * 100;
    if (sharePct > maxShare) {
      maxShare = sharePct;
      dominantId = entry.id;
    }
    return {
      id: entry.id,
      label: entry.label,
      shortLabel: entry.shortLabel,
      per90: entry.per90,
      estimatedTotal: entry.estimatedTotal,
      sharePct,
      isDominant: false,
    };
  });

  return entries
    .map((entry) => ({ ...entry, isDominant: entry.id === dominantId }))
    .sort((a, b) => b.sharePct - a.sharePct);
}
