/**
 * Wspólna logika kwalifikacji do trwałego usunięcia karty z players —
 * ta sama definicja „powiązań z danymi” co lista zawodników (globalDataTotal).
 */

import {
  accumulateGpsCollectionDocsIntoGlobalCounts,
  accumulateMatchDocumentIntoGlobalCounts,
  globalDataContactTotal,
  lookupGlobalPlayerDataCounts,
  type GlobalPlayerDataCounts,
} from "./globalPlayerDataCounts";

export function buildGlobalCountsRecordFromMatchDocs(
  matchDocs: Record<string, unknown>[],
  gpsDocs: Array<Record<string, unknown>>,
): Record<string, GlobalPlayerDataCounts> {
  const map = new Map<string, GlobalPlayerDataCounts>();
  for (const data of matchDocs) {
    accumulateMatchDocumentIntoGlobalCounts(data, map);
  }
  accumulateGpsCollectionDocsIntoGlobalCounts(
    gpsDocs.map((data) => ({ data: () => data })),
    map,
  );
  const record: Record<string, GlobalPlayerDataCounts> = {};
  map.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export function getGlobalDataContactTotalForPlayer(
  record: Record<string, GlobalPlayerDataCounts>,
  playerId: string,
): number {
  return globalDataContactTotal(lookupGlobalPlayerDataCounts(record, playerId));
}

/** Czy zawodnik ma jakiekolwiek powiązania z danymi (mecze, GPS w meczu / kolekcji itd.). */
export function playerHasAnyGlobalDataContact(
  record: Record<string, GlobalPlayerDataCounts>,
  playerId: string,
): boolean {
  return getGlobalDataContactTotalForPlayer(record, playerId) > 0;
}
