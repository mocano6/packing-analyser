/**
 * Firebase traktuje e-maile bez rozróżniania wielkości liter; ujednolicamy wpis użytkownika.
 */
export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
