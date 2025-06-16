// Wartości XT dla boiska podzielonego na strefy a1-f12 (6 wierszy x 12 kolumn)

// Definiujemy typ dla danych o strefie
export interface ZoneData {
  name: [string, number]; // [litera, numer]
  value: number;
}

export const XT_VALUES: Record<string, ZoneData> = {
  // Pierwszy wiersz (a)
  a1: { name: ["A", 1], value: 0.00638303 },
  a2: { name: ["A", 2], value: 0.00779616 },
  a3: { name: ["A", 3], value: 0.00844854 },
  a4: { name: ["A", 4], value: 0.00977659 },
  a5: { name: ["A", 5], value: 0.01126267 },
  a6: { name: ["A", 6], value: 0.01248344 },
  a7: { name: ["A", 7], value: 0.01473596 },
  a8: { name: ["A", 8], value: 0.0174506 },
  a9: { name: ["A", 9], value: 0.02122129 },
  a10: { name: ["A", 10], value: 0.02756312 },
  a11: { name: ["A", 11], value: 0.03485072 },
  a12: { name: ["A", 12], value: 0.0379259 },
  
  // Drugi wiersz (b)
  b1: { name: ["B", 1], value: 0.00750072 },
  b2: { name: ["B", 2], value: 0.00878589 },
  b3: { name: ["B", 3], value: 0.00942382 },
  b4: { name: ["B", 4], value: 0.0105949 },
  b5: { name: ["B", 5], value: 0.01214719 },
  b6: { name: ["B", 6], value: 0.0138454 },
  b7: { name: ["B", 7], value: 0.01611813 },
  b8: { name: ["B", 8], value: 0.01870347 },
  b9: { name: ["B", 9], value: 0.02401521 },
  b10: { name: ["B", 10], value: 0.02953272 },
  b11: { name: ["B", 11], value: 0.04066992 },
  b12: { name: ["B", 12], value: 0.04647721 },
  
  // Trzeci wiersz (c)
  c1: { name: ["C", 1], value: 0.0088799 },
  c2: { name: ["C", 2], value: 0.00977745 },
  c3: { name: ["C", 3], value: 0.01001304 },
  c4: { name: ["C", 4], value: 0.01110462 },
  c5: { name: ["C", 5], value: 0.01269174 },
  c6: { name: ["C", 6], value: 0.01429128 },
  c7: { name: ["C", 7], value: 0.01685596 },
  c8: { name: ["C", 8], value: 0.01935132 },
  c9: { name: ["C", 9], value: 0.0241224 },
  c10: { name: ["C", 10], value: 0.02855202 },
  c11: { name: ["C", 11], value: 0.05491138 },
  c12: { name: ["C", 12], value: 0.06442595 },
  
  // Czwarty wiersz (d)
  d1: { name: ["D", 1], value: 0.00941056 },
  d2: { name: ["D", 2], value: 0.01082722 },
  d3: { name: ["D", 3], value: 0.01016549 },
  d4: { name: ["D", 4], value: 0.01132376 },
  d5: { name: ["D", 5], value: 0.01262646 },
  d6: { name: ["D", 6], value: 0.01484598 },
  d7: { name: ["D", 7], value: 0.01689528 },
  d8: { name: ["D", 8], value: 0.0199707 },
  d9: { name: ["D", 9], value: 0.02385149 },
  d10: { name: ["D", 10], value: 0.03511326 },
  d11: { name: ["D", 11], value: 0.10805102 },
  d12: { name: ["D", 12], value: 0.25745362 },
  
  // Piąty wiersz (e) - dokładna kopia d dla kompatybilności z oryginalną tablicą
  e1: { name: ["E", 1], value: 0.00941056 },
  e2: { name: ["E", 2], value: 0.01082722 },
  e3: { name: ["E", 3], value: 0.01016549 },
  e4: { name: ["E", 4], value: 0.01132376 },
  e5: { name: ["E", 5], value: 0.01262646 },
  e6: { name: ["E", 6], value: 0.01484598 },
  e7: { name: ["E", 7], value: 0.01689528 },
  e8: { name: ["E", 8], value: 0.0199707 },
  e9: { name: ["E", 9], value: 0.02385149 },
  e10: { name: ["E", 10], value: 0.03511326 },
  e11: { name: ["E", 11], value: 0.10805102 },
  e12: { name: ["E", 12], value: 0.25745362 },
  
  // Szósty wiersz (f)
  f1: { name: ["F", 1], value: 0.0088799 },
  f2: { name: ["F", 2], value: 0.00977745 },
  f3: { name: ["F", 3], value: 0.01001304 },
  f4: { name: ["F", 4], value: 0.01110462 },
  f5: { name: ["F", 5], value: 0.01269174 },
  f6: { name: ["F", 6], value: 0.01429128 },
  f7: { name: ["F", 7], value: 0.01685596 },
  f8: { name: ["F", 8], value: 0.01935132 },
  f9: { name: ["F", 9], value: 0.0241224 },
  f10: { name: ["F", 10], value: 0.02855202 },
  f11: { name: ["F", 11], value: 0.05491138 },
  f12: { name: ["F", 12], value: 0.06442595 },
  
  // Siódmy wiersz (g) - dokładna kopia b
  g1: { name: ["G", 1], value: 0.00750072 },
  g2: { name: ["G", 2], value: 0.00878589 },
  g3: { name: ["G", 3], value: 0.00942382 },
  g4: { name: ["G", 4], value: 0.0105949 },
  g5: { name: ["G", 5], value: 0.01214719 },
  g6: { name: ["G", 6], value: 0.0138454 },
  g7: { name: ["G", 7], value: 0.01611813 },
  g8: { name: ["G", 8], value: 0.01870347 },
  g9: { name: ["G", 9], value: 0.02401521 },
  g10: { name: ["G", 10], value: 0.02953272 },
  g11: { name: ["G", 11], value: 0.04066992 },
  g12: { name: ["G", 12], value: 0.04647721 },
  
  // Ósmy wiersz (h) - dokładna kopia a
  h1: { name: ["H", 1], value: 0.00638303 },
  h2: { name: ["H", 2], value: 0.00779616 },
  h3: { name: ["H", 3], value: 0.00844854 },
  h4: { name: ["H", 4], value: 0.00977659 },
  h5: { name: ["H", 5], value: 0.01126267 },
  h6: { name: ["H", 6], value: 0.01248344 },
  h7: { name: ["H", 7], value: 0.01473596 },
  h8: { name: ["H", 8], value: 0.0174506 },
  h9: { name: ["H", 9], value: 0.02122129 },
  h10: { name: ["H", 10], value: 0.02756312 },
  h11: { name: ["H", 11], value: 0.03485072 },
  h12: { name: ["H", 12], value: 0.0379259 },
};

// Funkcja do konwersji z formatu dwuwymiarowej tablicy do obiektu
export const getXTValueFromMatrix = (row: number, col: number): number => {
  // Sprawdzamy czy indeksy są w zakresie
  if (row >= 0 && row < 8 && col >= 0 && col < 12) {
    // Mapujemy indeksy wierszy na litery
    const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rowLetter = rowLetters[row];
    
    // Konwertujemy indeks kolumny na numer (1-12)
    const colNumber = col + 1;
    
    // Tworzymy klucz w formacie a1, b2, c3 itd.
    const key = `${rowLetter}${colNumber}` as keyof typeof XT_VALUES;
    
    // Zwracamy wartość XT dla danej pozycji
    return XT_VALUES[key]?.value || 0;
  }
  
  return 0;
};

/**
 * Funkcja pomocnicza do konwersji indeksu strefy na obiekt z danymi strefy
 * @param zone Indeks strefy (0-95)
 * @returns Obiekt z danymi strefy (nazwa w formie [litera, numer] i wartość XT)
 */
export const getZoneData = (zone: number): ZoneData | null => {
  if (zone < 0 || zone >= 96) return null;
  
  // Obliczanie wiersza i kolumny na podstawie zone
  const row = Math.floor(zone / 12);
  const col = zone % 12;
  
  // Mapujemy indeksy wierszy na litery
  const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rowLetter = rowLetters[row];
  
  // Konwertujemy indeks kolumny na numer (1-12)
  const colNumber = col + 1;
  
  // Tworzymy klucz w formacie a1, b2, c3 itd.
  const key = `${rowLetter}${colNumber}` as keyof typeof XT_VALUES;
  
  return XT_VALUES[key] || null;
};

// Funkcja do mapowania zony na wartość XT
export const getXTValueForZone = (zone: number): number => {
  // Zakładając, że zone jest numerem od 0 do 95, mapującym na pozycje w siatce 8x12
  
  // Obliczanie wiersza i kolumny na podstawie zone
  const row = Math.floor(zone / 12);
  const col = zone % 12;
  
  // Używamy funkcji do pobierania wartości z macierzy
  return getXTValueFromMatrix(row, col);
};

/**
 * Funkcja do pobierania nazwy strefy w formie tablicy [litera, numer]
 * @param zone Indeks strefy (0-95)
 * @returns Nazwa strefy w formie tablicy [litera, numer] lub null jeśli indeks jest poza zakresem
 */
export const getZoneName = (zone: number): [string, number] | null => {
  const zoneData = getZoneData(zone);
  return zoneData ? zoneData.name : null;
};

// Funkcja zamieniająca nazwę strefy w formie tablicy [litera, numer] na łańcuch znaków
export const zoneNameToString = (zoneName: [string, number] | null): string => {
  if (!zoneName) return '';
  return `${zoneName[0]}${zoneName[1]}`;
};

/**
 * Funkcja konwertująca nazwę strefy na indeks
 * @param zoneName Nazwa strefy w formacie "A1", "B5", etc.
 * @returns Indeks strefy (0-95) lub null jeśli nazwa nieprawidłowa
 */
export const zoneNameToIndex = (zoneName: string): number | null => {
  if (!zoneName || zoneName.length < 2) return null;
  
  const letter = zoneName[0].toLowerCase();
  const numberStr = zoneName.slice(1);
  const number = parseInt(numberStr, 10);
  
  if (isNaN(number) || number < 1 || number > 12) return null;
  
  const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rowIndex = rowLetters.indexOf(letter);
  
  if (rowIndex === -1) return null;
  
  return rowIndex * 12 + (number - 1);
};

export default XT_VALUES; 