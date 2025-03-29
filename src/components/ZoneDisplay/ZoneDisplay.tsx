"use client";

import React from 'react';

interface ZoneDisplayProps {
  zoneData: string | null | undefined;
}

/**
 * Komponent do wyświetlania danych strefy
 * Konwertuje dane JSON przechowywane w bazie danych ([litera, numer]) na czytelny format
 */
const ZoneDisplay: React.FC<ZoneDisplayProps> = ({ zoneData }) => {
  if (!zoneData) return <span>-</span>;
  
  try {
    // Próbuj sparsować dane JSON
    const zoneParts = JSON.parse(zoneData) as [string, number];
    // Wyświetl w formacie "A1", "B2", itp.
    return <span>{zoneParts[0]}{zoneParts[1]}</span>;
  } catch (error) {
    // Jeśli dane nie są w formacie JSON (dane historyczne), wyświetl je bezpośrednio
    return <span>{zoneData}</span>;
  }
};

export default ZoneDisplay; 