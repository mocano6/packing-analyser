// Pobieranie kadry drużyny z API ŁNP (TYLKO SERWER — wymaga Chrome/reCAPTCHA).

import { LaczyCrawler, SCOUTING_AUTH_HELP } from "@/lib/scouting/crawler";
import { ScoutingDebugLogger } from "@/lib/scouting/debugLog";
import { buildLaczyTeamPlayersPageUrl } from "@/utils/laczyTeamUrl";
import {
  extractLnpTeamPlayers,
  type LnpImportedPlayer,
} from "@/utils/lnpTeamPlayers";

interface RawTeamEnvelope {
  id?: string;
  name?: string;
  team?: { id?: string; name?: string };
}

export interface FetchTeamPlayersResult {
  ok: boolean;
  message: string;
  teamId: string;
  teamName?: string;
  players: LnpImportedPlayer[];
  errors: string[];
  debugLog?: ReturnType<ScoutingDebugLogger["finish"]>;
}

function teamNameOf(data: RawTeamEnvelope | null | undefined): string | undefined {
  const name = data?.team?.name || data?.name;
  return name && name.trim() ? name.trim().slice(0, 160) : undefined;
}

export async function fetchTeamPlayersFromLaczy(teamId: string): Promise<FetchTeamPlayersResult> {
  const debug = new ScoutingDebugLogger("fetchTeamPlayers", { teamId });
  const errors: string[] = [];
  const teamPage = buildLaczyTeamPlayersPageUrl(teamId);
  const crawler = new LaczyCrawler({
    debugLog: debug,
    initialRozgrywkiUrlCandidates: [teamPage, "https://www.laczynaspilka.pl/rozgrywki"],
  });

  try {
    await crawler.open();

    const [teamRes, playersRes] = await crawler.fetchMany<unknown>([
      `teams/${teamId}`,
      `teams/${teamId}/players`,
    ]);

    const authFailed = (res: typeof teamRes) =>
      !res || res.status === 0 || res.status === 401 || res.status === 403;

    if (authFailed(teamRes) && authFailed(playersRes)) {
      const msg = teamRes?.error || playersRes?.error || SCOUTING_AUTH_HELP;
      return {
        ok: false,
        message: msg,
        teamId,
        players: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    if (!playersRes || playersRes.status !== 200) {
      const msg = authFailed(playersRes)
        ? playersRes?.error || SCOUTING_AUTH_HELP
        : `Nie udało się pobrać kadry (status ${playersRes?.status ?? "brak"}).`;
      return {
        ok: false,
        message: msg,
        teamId,
        teamName: teamNameOf((teamRes?.data as RawTeamEnvelope | null) ?? undefined),
        players: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    const players = extractLnpTeamPlayers(playersRes.data);
    const teamName = teamNameOf(
      teamRes?.status === 200 ? (teamRes.data as RawTeamEnvelope | null) : undefined
    );
    if (players.length === 0) {
      const msg = "Brak zawodników w kadrze tej drużyny.";
      return {
        ok: false,
        message: msg,
        teamId,
        teamName,
        players: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    players.sort((a, b) => {
      const pos = (a.position || "ZZ").localeCompare(b.position || "ZZ", "pl");
      if (pos !== 0) return pos;
      if (a.number !== b.number) return a.number - b.number;
      return a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base" });
    });

    return {
      ok: true,
      message: `Pobrano ${players.length} zawodnik(ów)${teamName ? ` — ${teamName}` : ""}.`,
      teamId,
      teamName,
      players,
      errors,
      debugLog: debug.finish(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania kadry.";
    debug.error("sync", message);
    return {
      ok: false,
      message,
      teamId,
      players: [],
      errors: [message],
      debugLog: debug.finish(),
    };
  } finally {
    await crawler.close();
  }
}
