/** Parsuje rok rozpoczęcia sezonu z nazwy typu „2025/2026”. */
export function parseSeasonStartYear(seasonName: string): number | null {
  const slash = seasonName.match(/(\d{4})\s*\/\s*\d{2,4}/);
  if (slash) return parseInt(slash[1], 10);
  const single = seasonName.match(/(\d{4})/);
  return single ? parseInt(single[1], 10) : null;
}

/**
 * Szacuje rok urodzenia z wieku w danym sezonie rozgrywek.
 * Przyjęcie: wiek z API PZPN odnosi się do sezonu rozpoczynającego się w lipcu roku startYear.
 */
export function computeBirthYear(age: number, seasonName: string): number | null {
  const startYear = parseSeasonStartYear(seasonName);
  if (startYear == null || age < 0 || age > 99) return null;
  return startYear - age;
}
