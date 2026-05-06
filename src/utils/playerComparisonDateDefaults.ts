/** Wartość dla input type="date" w lokalnej strefie czasowej. */
export function toDateInputValueLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Domyślny zakres dla porównywarki: od = 3 miesiące wstecz, do = dziś (wg podanej lub bieżącej daty).
 */
export function getDefaultPlayerComparisonDateRange(now: Date = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(to);
  from.setMonth(from.getMonth() - 3);
  return { from: toDateInputValueLocal(from), to: toDateInputValueLocal(to) };
}
