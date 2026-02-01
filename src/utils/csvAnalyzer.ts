// src/utils/csvAnalyzer.ts
/**
 * Funkcja do analizy struktury pliku CSV
 * Zwraca informacje o kolumnach, typach danych i przykładowych wartościach
 */
export interface CSVStructure {
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  columnTypes: { [key: string]: 'string' | 'number' | 'date' | 'mixed' };
  columnSamples: { [key: string]: any[] };
}

type CSVDelimiter = ',' | ';';

function detectCSVDelimiter(headerLine: string): CSVDelimiter {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  // Catapult często eksportuje CSV jako ; (Europa). STATSports zwykle jako ,
  return semicolonCount > commaCount ? ';' : ',';
}

function normalizeRowLength(row: string[], headersLength: number): string[] {
  const normalized = [...row];
  while (normalized.length > headersLength && (normalized[normalized.length - 1] ?? "").trim() === "") {
    normalized.pop();
  }
  if (normalized.length > headersLength) {
    return normalized.slice(0, headersLength);
  }
  while (normalized.length < headersLength) {
    normalized.push("");
  }
  return normalized;
}

export function analyzeCSVStructure(csvText: string, maxRows: number = 10): CSVStructure {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('Plik CSV jest pusty');
  }

  // Parsuj nagłówki
  const delimiter = detectCSVDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const sampleRows: string[][] = [];
  const columnSamples: { [key: string]: any[] } = {};
  const columnTypes: { [key: string]: 'string' | 'number' | 'date' | 'mixed' } = {};

  // Inicjalizuj próbki dla każdej kolumny
  headers.forEach(header => {
    columnSamples[header] = [];
  });

  // Parsuj przykładowe wiersze
  const rowsToAnalyze = Math.min(maxRows, lines.length - 1);
  for (let i = 1; i <= rowsToAnalyze && i < lines.length; i++) {
    const row = normalizeRowLength(parseCSVLine(lines[i], delimiter), headers.length);
    if (row.length === headers.length) {
      sampleRows.push(row);
      
      headers.forEach((header, index) => {
        const value = row[index]?.trim() || '';
        if (value && columnSamples[header].length < 5) {
          columnSamples[header].push(value);
        }
      });
    }
  }

  // Określ typy kolumn na podstawie próbek
  headers.forEach(header => {
    const samples = columnSamples[header];
    if (samples.length === 0) {
      columnTypes[header] = 'string';
      return;
    }

    let numberCount = 0;
    let dateCount = 0;
    let stringCount = 0;

    samples.forEach(sample => {
      if (!isNaN(Number(sample)) && sample !== '') {
        numberCount++;
      } else if (isDate(sample)) {
        dateCount++;
      } else {
        stringCount++;
      }
    });

    if (numberCount > samples.length * 0.8) {
      columnTypes[header] = 'number';
    } else if (dateCount > samples.length * 0.8) {
      columnTypes[header] = 'date';
    } else if (numberCount > 0 || dateCount > 0) {
      columnTypes[header] = 'mixed';
    } else {
      columnTypes[header] = 'string';
    }
  });

  return {
    headers,
    rowCount: lines.length - 1,
    sampleRows,
    columnTypes,
    columnSamples,
  };
}

/**
 * Parsuje linię CSV, obsługując cudzysłowy i przecinki
 */
function parseCSVLine(line: string, delimiter: CSVDelimiter): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Podwójny cudzysłów - escape
        current += '"';
        i++; // Pomiń następny cudzysłów
      } else {
        // Przełącz stan cudzysłowów
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Koniec pola
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Dodaj ostatnie pole
  result.push(current);
  return result;
}

/**
 * Sprawdza czy string wygląda jak data
 */
function isDate(value: string): boolean {
  // Proste sprawdzenie formatów daty
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
    /^\d{2}\.\d{2}\.\d{4}/, // DD.MM.YYYY
    /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
  ];

  return datePatterns.some(pattern => pattern.test(value));
}

/**
 * Parsuje pełny plik CSV do tablicy obiektów
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectCSVDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = normalizeRowLength(parseCSVLine(lines[i], delimiter), headers.length);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    result.push(row);
  }

  return result;
}
