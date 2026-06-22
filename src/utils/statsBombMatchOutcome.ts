import type { StatsBombMatchRow } from "./statsbombCsvParser";

export type StatsBombMatchOutcome = "win" | "draw" | "loss";

export type StatsBombMatchOutcomeFilter = "all" | StatsBombMatchOutcome;

export function getStatsBombMatchOutcome(row: StatsBombMatchRow): StatsBombMatchOutcome {
  if (row.outcomes.win === 1) return "win";
  if (row.outcomes.draw === 1) return "draw";
  return "loss";
}

export function statsBombMatchOutcomeLabel(outcome: StatsBombMatchOutcome): string {
  switch (outcome) {
    case "win":
      return "Wygrana";
    case "draw":
      return "Remis";
    default:
      return "Porażka";
  }
}

export function statsBombMatchOutcomeShort(outcome: StatsBombMatchOutcome): string {
  switch (outcome) {
    case "win":
      return "W";
    case "draw":
      return "R";
    default:
      return "P";
  }
}

export function filterStatsBombMatchesByOutcome(
  rows: StatsBombMatchRow[],
  filter: StatsBombMatchOutcomeFilter,
): StatsBombMatchRow[] {
  if (filter === "all") return rows;
  return rows.filter((row) => getStatsBombMatchOutcome(row) === filter);
}

export function countStatsBombMatchOutcomes(rows: StatsBombMatchRow[]): {
  win: number;
  draw: number;
  loss: number;
  total: number;
} {
  let win = 0;
  let draw = 0;
  let loss = 0;
  for (const row of rows) {
    const outcome = getStatsBombMatchOutcome(row);
    if (outcome === "win") win += 1;
    else if (outcome === "draw") draw += 1;
    else loss += 1;
  }
  return { win, draw, loss, total: rows.length };
}
