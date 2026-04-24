/**
 * Lista zawodników — odczyt meczów tak, by był zgodny z typowymi regułami Firestore
 * (dostęp po team / teamId w allowedTeams). Samo getDocs(collection('matches')) bywa
 * odrzucane lub niepełne, gdy reguła opiera się na polach dokumentu.
 *
 * Używamy getDocsFromServer jako pierwszej próby — unika sytuacji „wszędzie 0”, gdy
 * persystencja IndexedDB zwraca pusty wynik mimo danych na serwerze.
 * Dodatkowo: unia z `matches_archive` (archiwalne mecze z pełnymi tablicami akcji).
 */

import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import { collection, getDocs, getDocsFromServer, query, where } from "./firestoreWithMetrics";

const TEAM_IN_CHUNK = 30;

const MATCH_COLLECTIONS = ["matches", "matches_archive"] as const;

async function mergeQueryIntoMap(
  db: Firestore,
  q: ReturnType<typeof query>,
  byId: Map<string, QueryDocumentSnapshot<DocumentData>>,
  label: string,
): Promise<void> {
  try {
    const serverSnap = await getDocsFromServer(q);
    serverSnap.docs.forEach((d) => byId.set(d.id, d));
  } catch (err) {
    console.warn(`[lista-zawodnikow] getDocsFromServer(${label}) — fallback do cache:`, err);
    try {
      const snap = await getDocs(q);
      snap.docs.forEach((d) => byId.set(d.id, d));
    } catch (e2) {
      console.warn(`[lista-zawodnikow] getDocs(${label})`, e2);
    }
  }
}

async function mergeCollectionIntoMap(
  db: Firestore,
  collectionId: string,
  byId: Map<string, QueryDocumentSnapshot<DocumentData>>,
): Promise<void> {
  await mergeQueryIntoMap(db, query(collection(db, collectionId)), byId, collectionId);
}

/**
 * Zwraca unikalne snapshoty dokumentów matches/ oraz matches_archive/ — unia szerokiego odczytu
 * (gdy dozwolony) oraz zapytań where('team'|'teamId', 'in', chunk) po ID dokumentów z kolekcji teams.
 */
export async function loadMatchSnapshotsForLista(
  db: Firestore,
  teamDocIds: string[],
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();

  for (const col of MATCH_COLLECTIONS) {
    await mergeCollectionIntoMap(db, col, byId);
  }

  const ids = [...new Set(teamDocIds.map((t) => t.trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += TEAM_IN_CHUNK) {
    const chunk = ids.slice(i, i + TEAM_IN_CHUNK);
    if (chunk.length === 0) continue;
    for (const col of MATCH_COLLECTIONS) {
      try {
        const qTeam = query(collection(db, col), where("team", "in", chunk));
        const qTeamId = query(collection(db, col), where("teamId", "in", chunk));
        await Promise.all([
          mergeQueryIntoMap(db, qTeam, byId, `${col}.team`),
          mergeQueryIntoMap(db, qTeamId, byId, `${col}.teamId`),
        ]);
      } catch (e) {
        console.warn("[lista-zawodnikow] zapytanie po zespołach", col, "offset", i, e);
      }
    }
  }

  return Array.from(byId.values());
}
