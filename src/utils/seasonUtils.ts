// src/utils/seasonUtils.ts

export interface Season {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

// Funkcja do generowania sezonu na podstawie roku
export function generateSeason(startYear: number): Season {
  const endYear = startYear + 1;
  return {
    id: `${startYear}/${endYear.toString().slice(-2)}`,
    name: `${startYear}/${endYear.toString().slice(-2)}`,
    startDate: new Date(startYear, 6, 1), // 1 lipca
    endDate: new Date(endYear, 5, 30), // 30 czerwca
  };
}

// Funkcja do generowania listy sezonów (ostatnie 5 lat + następne 2)
export function generateSeasons(): Season[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  // Jeśli jesteśmy po 1 lipca, to aktualny sezon zaczął się w tym roku
  // Jeśli przed 1 lipca, to aktualny sezon zaczął się w poprzednim roku
  const currentSeasonStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  
  const seasons: Season[] = [];
  
  // Generuj sezony od 5 lat wstecz do 2 lat w przód
  for (let i = -5; i <= 2; i++) {
    const seasonStartYear = currentSeasonStartYear + i;
    seasons.push(generateSeason(seasonStartYear));
  }
  
  return seasons.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()); // Sortuj od najnowszego
}

// Funkcja do określenia sezonu na podstawie daty meczu
export function getSeasonForDate(date: string | Date): string {
  const matchDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(matchDate.getTime())) {
    return 'unknown';
  }
  
  const year = matchDate.getFullYear();
  const month = matchDate.getMonth();
  
  // Jeśli mecz jest po 1 lipca, należy do sezonu rozpoczynającego się w tym roku
  // Jeśli przed 1 lipca, należy do sezonu rozpoczynającego się w poprzednim roku
  const seasonStartYear = month >= 6 ? year : year - 1;
  
  return generateSeason(seasonStartYear).id;
}

// Funkcja do filtrowania meczów według sezonu
export function filterMatchesBySeason(matches: any[], seasonId: string): any[] {
  if (seasonId === 'all') {
    return matches;
  }
  
  return matches.filter(match => {
    if (!match.date) return false;
    return getSeasonForDate(match.date) === seasonId;
  });
}

// Funkcja do pobrania aktualnego sezonu
export function getCurrentSeason(): Season {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const currentSeasonStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;
  return generateSeason(currentSeasonStartYear);
}

// Funkcja do wyciągnięcia dostępnych sezonów z istniejących meczów
export function getAvailableSeasonsFromMatches(matches: any[]): { id: string; name: string }[] {
  const seasonsSet = new Set<string>();
  
  matches.forEach(match => {
    if (match.date) {
      const seasonId = getSeasonForDate(match.date);
      if (seasonId !== 'unknown') {
        seasonsSet.add(seasonId);
      }
    }
  });
  
  // Konwertuj na tablicę obiektów i posortuj od najnowszego
  const availableSeasons = Array.from(seasonsSet).map(seasonId => ({
    id: seasonId,
    name: seasonId
  }));
  
  // Sortuj sezony od najnowszego do najstarszego
  return availableSeasons.sort((a, b) => {
    // Konwertuj format "2024/25" na liczby do porównania
    const [aStartYear] = a.id.split('/').map(Number);
    const [bStartYear] = b.id.split('/').map(Number);
    return bStartYear - aStartYear;
  });
} 