// Lista pozycji używana w aplikacji (zawodnik, minuty w meczu, GPS)
export const POSITIONS = [
  { value: "GK", label: "Bramkarz (GK)" },
  { value: "CB", label: "Środkowy obrońca (CB)" },
  { value: "RB", label: "Prawy obrońca (RB)" },
  { value: "LB", label: "Lewy obrońca (LB)" },
  { value: "DM", label: "Defensywny pomocnik (DM)" },
  { value: "CM", label: "Środkowy pomocnik (CM)" },
  { value: "AM", label: "Ofensywny pomocnik (AM)" },
  { value: "LW", label: "Lewy skrzydłowy (LW)" },
  { value: "RW", label: "Prawy skrzydłowy (RW)" },
  { value: "ST", label: "Napastnik (ST)" },
] as const;

export type PositionValue = (typeof POSITIONS)[number]["value"];

export const POSITION_VALUES: PositionValue[] = POSITIONS.map((p) => p.value);

/** Mapowanie starych pozycji na nowe (kompatybilność wsteczna) */
export function mapOldPositionToNew(position: string): string {
  const mapping: Record<string, string> = {
    LS: "LW",
    RS: "RW",
    CF: "ST",
    CAM: "AM",
    CDM: "DM",
  };
  return mapping[position] || position;
}

/** Domyślna pozycja na podstawie pozycji zawodnika */
export function getDefaultPosition(playerPosition: string | undefined): string {
  if (!playerPosition) return "CB";
  const normalized = mapOldPositionToNew(playerPosition);
  if (POSITIONS.some((p) => p.value === normalized)) return normalized;
  return "CB";
}
