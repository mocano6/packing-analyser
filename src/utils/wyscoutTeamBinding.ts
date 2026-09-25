import type { WyscoutTeamBinding } from "@/types/wyscout";

export const WYSCOUT_TEAM_BINDING_PREFIX = "teamStats_wyscoutTeam_";

export function wyscoutTeamBindingStorageKey(lookballTeamId: string): string {
  return `${WYSCOUT_TEAM_BINDING_PREFIX}${lookballTeamId}`;
}

export function parseWyscoutTeamBinding(raw: unknown): WyscoutTeamBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const wyId = typeof rec.wyId === "number" ? rec.wyId : Number(rec.wyId);
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!Number.isFinite(wyId) || wyId <= 0 || !name) return null;
  const officialName =
    typeof rec.officialName === "string" && rec.officialName.trim()
      ? rec.officialName.trim()
      : undefined;
  const competitionId =
    typeof rec.competitionId === "number"
      ? rec.competitionId
      : Number(rec.competitionId);
  const seasonId =
    typeof rec.seasonId === "number" ? rec.seasonId : Number(rec.seasonId);
  const competitionName =
    typeof rec.competitionName === "string" && rec.competitionName.trim()
      ? rec.competitionName.trim()
      : undefined;
  const binding: WyscoutTeamBinding = { wyId, name };
  if (officialName) binding.officialName = officialName;
  if (competitionName) binding.competitionName = competitionName;
  if (Number.isFinite(competitionId) && competitionId > 0) binding.competitionId = competitionId;
  if (Number.isFinite(seasonId) && seasonId > 0) binding.seasonId = seasonId;
  return binding;
}

export function readWyscoutTeamBinding(lookballTeamId: string): WyscoutTeamBinding | null {
  if (typeof window === "undefined" || !lookballTeamId) return null;
  try {
    const raw = localStorage.getItem(wyscoutTeamBindingStorageKey(lookballTeamId));
    if (!raw) return null;
    return parseWyscoutTeamBinding(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeWyscoutTeamBinding(
  lookballTeamId: string,
  binding: WyscoutTeamBinding,
): void {
  if (typeof window === "undefined" || !lookballTeamId) return;
  localStorage.setItem(wyscoutTeamBindingStorageKey(lookballTeamId), JSON.stringify(binding));
}

export function clearWyscoutTeamBinding(lookballTeamId: string): void {
  if (typeof window === "undefined" || !lookballTeamId) return;
  localStorage.removeItem(wyscoutTeamBindingStorageKey(lookballTeamId));
}
