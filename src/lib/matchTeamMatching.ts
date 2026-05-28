/**
 * Spójne dopasowanie meczu do zespołu po polach legacy: `team`, `teamId`, `teams` (lista|string).
 * Część dokumentów (import / stare dane) ma ustawione tylko `teamId`, a UI filtrowało wyłącznie po `team`,
 * przez co mecze „znikały”. Reguły Firestore (firestore.rules) sprawdzają oba pola — kod musi tak samo.
 *
 * Kanoniczna kolejność rozwiązywania zespołu jest zgodna z prepareMatchDocumentForFirestore (zapis).
 */

import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import { collection, getDocs, orderBy, query, where } from "./firestoreWithMetrics";

type MatchTeamFields = {
  team?: unknown;
  teamId?: unknown;
  teams?: unknown;
};

function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Kanoniczny identyfikator zespołu meczu: team → teamId → teams[0]. Zwraca "" gdy brak. */
export function resolveMatchTeamId(match: MatchTeamFields): string {
  const team = trimmedString(match.team);
  if (team) return team;
  const teamId = trimmedString(match.teamId);
  if (teamId) return teamId;
  if (Array.isArray(match.teams)) {
    const first = match.teams.find((t) => trimmedString(t).length > 0);
    if (first) return trimmedString(first);
  } else if (typeof match.teams === "string") {
    return trimmedString(match.teams);
  }
  return "";
}

/** Czy mecz należy do danego zespołu — sprawdza team, teamId oraz teams (lista|string). */
export function matchBelongsToTeam(match: MatchTeamFields, teamId: string): boolean {
  const target = trimmedString(teamId);
  if (!target) return false;
  if (trimmedString(match.team) === target) return true;
  if (trimmedString(match.teamId) === target) return true;
  if (Array.isArray(match.teams)) {
    return match.teams.some((t) => trimmedString(t) === target);
  }
  if (typeof match.teams === "string") {
    return trimmedString(match.teams) === target;
  }
  return false;
}

/** Czy mecz należy do któregokolwiek z zespołów. Pusta lista = brak filtra (true). */
export function matchBelongsToAnyTeam(match: MatchTeamFields, teamIds: Iterable<string>): boolean {
  const targets = [...teamIds].map(trimmedString).filter(Boolean);
  if (targets.length === 0) return true;
  return targets.some((id) => matchBelongsToTeam(match, id));
}

/**
 * Pobiera mecze zespołu po OBU polach (team + teamId), scala po ID dokumentu i sortuje malejąco po dacie.
 * Każde z zapytań ma własny try/catch — jeśli np. indeks teamId+date nie jest jeszcze wdrożony,
 * degradujemy się do wyników z drugiego pola zamiast wywalać cały odczyt.
 */
export async function fetchMatchesForTeamDualField(
  db: Firestore,
  collectionId: string,
  teamId: string,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const target = trimmedString(teamId);
  const col = collection(db, collectionId);
  const queries = [
    query(col, where("team", "==", target), orderBy("date", "desc")),
    query(col, where("teamId", "==", target), orderBy("date", "desc")),
  ];

  const perQuery = await Promise.all(
    queries.map(async (q, i) => {
      try {
        return (await getDocs(q)).docs as QueryDocumentSnapshot<DocumentData>[];
      } catch (e) {
        console.warn(`[matchTeamMatching] zapytanie ${i === 0 ? "team" : "teamId"} dla ${collectionId} nie powiodło się:`, e);
        return [] as QueryDocumentSnapshot<DocumentData>[];
      }
    }),
  );

  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  for (const docs of perQuery) {
    for (const d of docs) byId.set(d.id, d);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const da = trimmedString((a.data() as DocumentData).date);
    const dbb = trimmedString((b.data() as DocumentData).date);
    return dbb.localeCompare(da); // malejąco po dacie (string YYYY-MM-DD)
  });
}
