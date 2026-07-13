/**
 * Zawodnicy kwalifikujący się do trwałego usunięcia z kolekcji players (lista zawodników).
 */

export type PermanentDeleteEligiblePlayer = {
  id: string;
  isDeleted?: boolean;
  /** Suma wszystkich powiązań z danymi (jak na liście zawodników). */
  globalDataTotal: number;
};

/** Status „usunięty” i brak jakichkolwiek powiązań z danymi w bazie. */
export function filterPermanentDeleteEligiblePlayers(
  players: PermanentDeleteEligiblePlayer[],
): PermanentDeleteEligiblePlayer[] {
  return players.filter((p) => p.isDeleted === true && p.globalDataTotal === 0);
}

export function permanentDeleteEligiblePlayerIds(players: PermanentDeleteEligiblePlayer[]): string[] {
  return filterPermanentDeleteEligiblePlayers(players).map((p) => p.id);
}
