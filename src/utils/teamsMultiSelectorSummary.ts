export type TeamsMultiSelectorListEntry = { id: string; name: string };

export function getTeamInitialsForMultiSelector(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";
  if (/^u\d+/i.test(trimmed)) return trimmed.toUpperCase();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Tekst na przycisku otwierającym modal wielokrotnego wyboru zespołów.
 */
export function teamsMultiSelectorSummaryLabel(
  selectedIds: string[],
  teamsSorted: TeamsMultiSelectorListEntry[],
  isPresentationMode: boolean,
): string {
  const total = teamsSorted.length;
  if (total === 0) return "Brak zespołów";
  if (selectedIds.length === 0) return "Wybierz zespoły";
  if (selectedIds.length === total) {
    return isPresentationMode ? `Wszystkie (${total})` : `Wszystkie zespoły (${total})`;
  }
  const byId = new Map(teamsSorted.map((t) => [t.id, t]));
  const names = selectedIds.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  if (isPresentationMode) {
    return `${selectedIds.length} zespołów`;
  }
  if (names.length === 0) {
    return `${selectedIds.length} wybrano`;
  }
  if (names.length <= 2) {
    return names.join(", ");
  }
  return `${names.slice(0, 2).join(", ")} +${selectedIds.length - 2}`;
}
