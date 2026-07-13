import type { TeamInfo } from "@/types";

/** Heurystyka: długi token alfanumeryczny (np. ID dokumentu Firebase), nie czytelna nazwa. */
export function looksLikeOpaqueTeamToken(s: string): boolean {
  const t = s.trim();
  if (t.length < 18) return false;
  return /^[A-Za-z0-9_-]+$/.test(t);
}

type TeamListEntry = { id: string; name: string };

/**
 * Nazwa „naszego” zespołu (perspektywa danych) do etykiet packing — bez surowego ID w UI.
 * Kolejność: lista zespołów (np. z Firebase) → opcjonalne teamName z dokumentu → krótki string team.
 * Zestaw domyślny TEAMS rozwiązuje komponent (żeby ten moduł nie importował Firebase w testach).
 */
export function getOurSquadLabelForPackingModal(
  matchInfo: TeamInfo | null | undefined,
  allTeams: readonly TeamListEntry[],
): string | null {
  if (!matchInfo?.team) return null;
  const tid = String(matchInfo.team).trim();
  if (!tid) return null;

  const fromList = allTeams.find((t) => t.id === tid)?.name;
  if (fromList?.trim()) return fromList.trim();

  const ext = matchInfo as TeamInfo & { teamName?: string };
  if (ext.teamName?.trim()) return ext.teamName.trim();

  if (!looksLikeOpaqueTeamToken(tid)) return tid;

  return null;
}

/**
 * Nazwa przeciwnika do modali (Regain, PK itd.) — preferuj opponentName, unikaj surowego ID;
 * opcjonalnie rozwiąż `opponent` jako id z `allTeams`.
 */
export function getOpponentLabelForPackingModal(
  matchInfo: TeamInfo | null | undefined,
  allTeams?: readonly TeamListEntry[],
): string | null {
  if (!matchInfo) return null;
  const ext = matchInfo as TeamInfo & { opponentName?: string };
  const fromName = ext.opponentName?.trim();
  if (fromName) return fromName;
  const o = ext.opponent?.trim();
  if (!o) return null;
  if (!looksLikeOpaqueTeamToken(o)) return o;
  if (allTeams) {
    const fromList = allTeams.find((t) => t.id === o)?.name?.trim();
    if (fromList) return fromList;
  }
  return null;
}

/** Skrócona etykieta zespołu (ostatnie słowo nazwy) do filtrów i kart. */
export function shortTeamDisplayLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? name) : name;
}

/**
 * Nazwa drużyny przeciwnej z perspektywy wybranego zespołu (Statystyki zespołu, karty KPI).
 * Unika surowego ID i słowa „Przeciwnik”.
 */
export function resolveMatchOpponentDisplayName(
  matchInfo: TeamInfo,
  selectedTeam: string,
  availableTeams: readonly TeamListEntry[],
): string {
  const opponentId = matchInfo.team === selectedTeam ? matchInfo.opponent : matchInfo.team;
  const fromList = availableTeams.find((t) => t.id === opponentId)?.name?.trim();
  if (fromList) return fromList;

  const ext = matchInfo as TeamInfo & { opponentName?: string; teamName?: string };
  if (matchInfo.team === selectedTeam) {
    const fromDoc = ext.opponentName?.trim();
    if (fromDoc) return fromDoc;
  } else {
    const homeName = ext.teamName?.trim();
    if (homeName) return homeName;
  }

  const trimmedId = opponentId?.trim();
  if (trimmedId && !looksLikeOpaqueTeamToken(trimmedId)) return trimmedId;
  return trimmedId || "—";
}
