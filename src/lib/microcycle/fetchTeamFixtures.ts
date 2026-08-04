// Pobieranie terminarza drużyny z API ŁNP (TYLKO SERWER — wymaga Chrome/reCAPTCHA).

import { LaczyCrawler, SCOUTING_AUTH_HELP } from "@/lib/scouting/crawler";
import { ScoutingDebugLogger } from "@/lib/scouting/debugLog";
import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";
import { buildLaczyTeamPageUrl } from "@/utils/laczyTeamUrl";

interface RawTeamSide {
  id?: string;
  name?: string;
}

interface RawTeamMatch {
  matchId?: string;
  id?: string;
  dateTime?: string;
  state?: string;
  stadium?: string;
  host?: RawTeamSide;
  guest?: RawTeamSide;
  scores?: { final?: string; fullTime?: string };
}

interface RawPlayDictEntry {
  id?: string;
  playId?: string;
  name?: string;
  title?: string;
  seasonName?: string;
  isCurrent?: boolean;
}

export interface FetchTeamFixturesResult {
  ok: boolean;
  message: string;
  teamId: string;
  teamName?: string;
  fixtures: LaczyTeamFixture[];
  plays: Array<{ id: string; name: string }>;
  errors: string[];
  debugLog?: ReturnType<ScoutingDebugLogger["finish"]>;
}

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function playIdOf(entry: RawPlayDictEntry): string | null {
  const id = entry.playId || entry.id;
  return id && typeof id === "string" ? id : null;
}

function playNameOf(entry: RawPlayDictEntry): string {
  return String(entry.name || entry.title || entry.seasonName || "Rozgrywki").slice(0, 160);
}

function mapRawMatch(
  raw: RawTeamMatch,
  playId: string,
  playName: string
): LaczyTeamFixture | null {
  const matchId = raw.matchId || raw.id;
  if (!matchId || !raw.dateTime) return null;
  const hostId = raw.host?.id || "";
  const guestId = raw.guest?.id || "";
  if (!hostId && !guestId) return null;
  return {
    matchId,
    dateTime: raw.dateTime,
    state: raw.state || "",
    playId,
    playName,
    hostId,
    hostName: raw.host?.name || "Gospodarz",
    guestId,
    guestName: raw.guest?.name || "Gość",
    stadium: raw.stadium,
    scoreFinal: raw.scores?.final ?? raw.scores?.fullTime ?? null,
  };
}

export async function fetchTeamFixturesFromLaczy(teamId: string): Promise<FetchTeamFixturesResult> {
  const debug = new ScoutingDebugLogger("fetchTeamFixtures", { teamId });
  const errors: string[] = [];
  const teamPage = buildLaczyTeamPageUrl(teamId);
  const crawler = new LaczyCrawler({
    debugLog: debug,
    initialRozgrywkiUrlCandidates: [teamPage, "https://www.laczynaspilka.pl/rozgrywki"],
  });

  try {
    await crawler.open();

    const teamRes = await crawler.fetchOne<{ id?: string; name?: string }>(`teams/${teamId}`);
    if (!teamRes || teamRes.status === 0 || teamRes.status === 401 || teamRes.status === 403) {
      const msg = teamRes?.error || SCOUTING_AUTH_HELP;
      return {
        ok: false,
        message: msg,
        teamId,
        fixtures: [],
        plays: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }
    if (teamRes.status !== 200 || !teamRes.data) {
      const msg = `Nie udało się pobrać drużyny (status ${teamRes.status}).`;
      return {
        ok: false,
        message: msg,
        teamId,
        fixtures: [],
        plays: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }
    const teamName = teamRes.data.name || undefined;

    const dictRes = await crawler.fetchOne<RawPlayDictEntry[]>(
      `teams/${teamId}/play-dictionaries`
    );
    if (!dictRes || dictRes.status !== 200 || !Array.isArray(dictRes.data)) {
      const auth =
        !dictRes ||
        dictRes.status === 0 ||
        dictRes.status === 401 ||
        dictRes.status === 403 ||
        crawler.isAuthDead();
      const msg = auth
        ? dictRes?.error || SCOUTING_AUTH_HELP
        : `Brak słownika rozgrywek drużyny (status ${dictRes?.status ?? "brak"}).`;
      return {
        ok: false,
        message: msg,
        teamId,
        teamName,
        fixtures: [],
        plays: [],
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    const playsRaw = asArray<RawPlayDictEntry>(dictRes.data);
    const plays = playsRaw
      .map((p) => {
        const id = playIdOf(p);
        return id ? { id, name: playNameOf(p), isCurrent: !!p.isCurrent } : null;
      })
      .filter((p): p is { id: string; name: string; isCurrent: boolean } => p != null);

    // Preferuj bieżące rozgrywki; jeśli brak flagi — wszystkie (max 6, żeby nie palić tokenu).
    const preferred = plays.filter((p) => p.isCurrent);
    const playsToFetch = (preferred.length > 0 ? preferred : plays).slice(0, 6);

    const fixtures: LaczyTeamFixture[] = [];
    const seen = new Set<string>();

    for (const play of playsToFetch) {
      if (crawler.isAuthDead()) {
        errors.push("Sesja reCAPTCHA wygasła w trakcie pobierania terminarza.");
        break;
      }
      const [playedRes, upcomingRes] = await Promise.all([
        crawler.fetchOne<RawTeamMatch[]>(
          `teams/${teamId}/plays/${play.id}/played-matches`
        ),
        crawler.fetchOne<RawTeamMatch[]>(
          `teams/${teamId}/plays/${play.id}/not-played-matches`
        ),
      ]);

      for (const res of [playedRes, upcomingRes]) {
        if (!res || res.status !== 200) {
          errors.push(
            `Rozgrywki „${play.name}”: mecze status ${res?.status ?? "brak"}`
          );
          continue;
        }
        for (const raw of asArray<RawTeamMatch>(res.data)) {
          const mapped = mapRawMatch(raw, play.id, play.name);
          if (!mapped || seen.has(mapped.matchId)) continue;
          seen.add(mapped.matchId);
          fixtures.push(mapped);
        }
      }
    }

    fixtures.sort((a, b) => a.dateTime.localeCompare(b.dateTime));

    const ok = fixtures.length > 0;
    return {
      ok,
      message: ok
        ? `Pobrano ${fixtures.length} mecz(y) z ${playsToFetch.length} rozgrywek.`
        : errors[0] || "Brak meczów w terminarzu tej drużyny.",
      teamId,
      teamName,
      fixtures,
      plays: plays.map(({ id, name }) => ({ id, name })),
      errors,
      debugLog: debug.finish(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania terminarza.";
    debug.error("sync", message);
    return {
      ok: false,
      message,
      teamId,
      fixtures: [],
      plays: [],
      errors: [message],
      debugLog: debug.finish(),
    };
  } finally {
    await crawler.close();
  }
}
