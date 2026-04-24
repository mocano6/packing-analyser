import { playerTeamIdEntriesFromFirestoreDoc } from "../utils/playerUtils";

export type PlayerTeamRemovalPlan =
  | {
      ok: true;
      nextTeamsStored: string[];
      deleteTeamField: boolean;
      deleteTeamIdField: boolean;
    }
  | { ok: false; code: "not_member" };

/** Plan aktualizacji players (teams + opcjonalne kasowanie legacy team / teamId). */
export function planPlayerTeamRemoval(
  data: Record<string, unknown>,
  teamIdTrimmed: string,
): PlayerTeamRemovalPlan {
  const teamEntries = playerTeamIdEntriesFromFirestoreDoc(data);
  const nextTeamsStored = teamEntries
    .filter((e) => e.canonical !== teamIdTrimmed)
    .map((e) => e.storage);
  if (nextTeamsStored.length === teamEntries.length) {
    return { ok: false, code: "not_member" };
  }
  const prevTeams = teamEntries.map((e) => e.canonical);
  const nextTeamsCanonical = prevTeams.filter((t) => t !== teamIdTrimmed);
  const legTeam = typeof data.team === "string" ? data.team.trim() : "";
  const legTeamId = typeof data.teamId === "string" ? data.teamId.trim() : "";

  let deleteTeamField = false;
  if (legTeam) {
    if (
      legTeam === teamIdTrimmed ||
      nextTeamsCanonical.length === 0 ||
      !nextTeamsCanonical.includes(legTeam)
    ) {
      deleteTeamField = true;
    }
  }

  let deleteTeamIdField = false;
  if (legTeamId) {
    if (
      legTeamId === teamIdTrimmed ||
      nextTeamsCanonical.length === 0 ||
      !nextTeamsCanonical.includes(legTeamId)
    ) {
      deleteTeamIdField = true;
    }
  }

  return {
    ok: true,
    nextTeamsStored,
    deleteTeamField,
    deleteTeamIdField,
  };
}
