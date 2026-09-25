// Pobieranie terminarza drużyny z ŁNP (TYLKO SERWER).
//
// 1) Harvest: otwieramy stronę drużyny i zbieramy JSON, który SPA sama pobiera
//    po swojej reCAPTCHA — bez mintowania własnego tokenu.
// 2) Fallback: klasyczna ścieżka Bearer (gdy SPA nie doładowała zakładki meczów).

import {
  LaczyCrawler,
  SCOUTING_AUTH_HELP,
  SCOUTING_HARVEST_AUTH_HELP,
} from "@/lib/scouting/crawler";
import { withLaczyCrawlerLock } from "@/lib/scouting/crawlerLock";
import { ScoutingDebugLogger } from "@/lib/scouting/debugLog";
import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";
import { buildLaczyTeamPageUrl } from "@/utils/laczyTeamUrl";
import {
  asLaczyList,
  harvestHasCompleteMatchLists,
  mapRawLaczyMatch,
  parseHarvestedLaczyFixtures,
  type RawLaczyTeamMatch,
} from "@/utils/laczyFixturesHarvest";

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

const asArray = asLaczyList;

function playIdOf(entry: RawPlayDictEntry): string | null {
  const id = entry.playId || entry.id;
  return id && typeof id === "string" ? id : null;
}

function playNameOf(entry: RawPlayDictEntry): string {
  return String(entry.name || entry.title || entry.seasonName || "Rozgrywki").slice(0, 160);
}

export async function fetchTeamFixturesFromLaczy(teamId: string): Promise<FetchTeamFixturesResult> {
  return withLaczyCrawlerLock(() => fetchTeamFixturesFromLaczyUnlocked(teamId));
}

type PartialResult = Omit<FetchTeamFixturesResult, "debugLog"> & { complete?: boolean };

function unionFixtures(base: LaczyTeamFixture[], overlay: LaczyTeamFixture[]): LaczyTeamFixture[] {
  const byId = new Map<string, LaczyTeamFixture>();
  for (const f of base) if (f.matchId) byId.set(f.matchId, f);
  for (const f of overlay) if (f.matchId) byId.set(f.matchId, f);
  return [...byId.values()].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}

async function fetchTeamFixturesFromLaczyUnlocked(teamId: string): Promise<FetchTeamFixturesResult> {
  const debug = new ScoutingDebugLogger("fetchTeamFixtures", { teamId });
  const errors: string[] = [];

  const harvested = await harvestFixtures(teamId, debug, errors);
  // Zawsze dociągamy API: harvest bywa „kompletny” po pierwszej parze list
  // (np. stara liga) i gubi świeżo rozegrany mecz w innych rozgrywkach.
  const viaApi = await fetchFixturesViaApi(teamId, debug, errors);
  if (harvested?.ok && viaApi.ok) {
    const fixtures = unionFixtures(harvested.fixtures, viaApi.fixtures);
    return {
      ok: true,
      message: `Pobrano ${fixtures.length} mecz(y) ze strony i API.`,
      teamId,
      teamName: viaApi.teamName || harvested.teamName,
      fixtures,
      plays: viaApi.plays.length > 0 ? viaApi.plays : harvested.plays,
      errors: [...harvested.errors, ...viaApi.errors],
      debugLog: debug.finish(),
    };
  }
  if (viaApi.ok) return { ...viaApi, debugLog: debug.finish() };
  if (harvested) return { ...harvested, debugLog: debug.finish() };
  return { ...viaApi, debugLog: debug.finish() };
}

/** Zwraca wynik tylko gdy strona drużyny faktycznie oddała listy meczów. */
async function harvestFixtures(
  teamId: string,
  debug: ScoutingDebugLogger,
  errors: string[]
): Promise<PartialResult | null> {
  const crawler = new LaczyCrawler({
    debugLog: debug,
    landingUrl: "about:blank",
    neverReuseCdp: true,
    disableAutoReset: true,
  });

  try {
    const hits = await crawler.openHarvest(buildLaczyTeamPageUrl(teamId), teamId);
    const parsed = parseHarvestedLaczyFixtures(teamId, hits);
    const complete = harvestHasCompleteMatchLists(hits, teamId);

    if (parsed.fixtures.length > 0) {
      if (!complete) {
        debug.warn("navigate", "Harvest bez listy rozegranych — dociągnięcie API");
      }
      return {
        ok: true,
        complete,
        message: `Pobrano ${parsed.fixtures.length} mecz(y) ze strony drużyny.`,
        teamId,
        teamName: parsed.teamName,
        fixtures: parsed.fixtures,
        plays: parsed.plays,
        errors,
      };
    }

    if (parsed.matchListStatusOk) {
      return {
        ok: complete,
        complete,
        message: "Brak meczów w terminarzu tej drużyny.",
        teamId,
        teamName: parsed.teamName,
        fixtures: [],
        plays: parsed.plays,
        errors,
      };
    }

    debug.warn("navigate", "Harvest bez list meczów — próbuję ścieżki API");
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd harvestu terminarza.";
    debug.warn("navigate", `Harvest nieudany: ${message}`);
    return null;
  } finally {
    await crawler.close();
  }
}

async function fetchFixturesViaApi(
  teamId: string,
  debug: ScoutingDebugLogger,
  errors: string[]
): Promise<PartialResult> {
  const crawler = new LaczyCrawler({ debugLog: debug });

  try {
    await crawler.open();

    const teamRes = await crawler.fetchOne<{ id?: string; name?: string }>(`teams/${teamId}`);
    const teamAuthFailed =
      !teamRes || teamRes.status === 0 || teamRes.status === 401 || teamRes.status === 403;
    if (teamAuthFailed) {
      const msg = teamRes?.error || SCOUTING_HARVEST_AUTH_HELP;
      errors.push(msg);
      return { ok: false, message: msg, teamId, fixtures: [], plays: [], errors };
    }
    const teamName = teamRes.data?.name || undefined;

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
      errors.push(msg);
      return { ok: false, message: msg, teamId, teamName, fixtures: [], plays: [], errors };
    }

    const plays = asArray<RawPlayDictEntry>(dictRes.data)
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
        crawler.fetchOne<RawLaczyTeamMatch[]>(`teams/${teamId}/plays/${play.id}/played-matches`),
        crawler.fetchOne<RawLaczyTeamMatch[]>(
          `teams/${teamId}/plays/${play.id}/not-played-matches`
        ),
      ]);

      for (const res of [playedRes, upcomingRes]) {
        if (!res || res.status !== 200) {
          errors.push(`Rozgrywki „${play.name}”: mecze status ${res?.status ?? "brak"}`);
          continue;
        }
        for (const raw of asArray<RawLaczyTeamMatch>(res.data)) {
          const mapped = mapRawLaczyMatch(raw, play.id, play.name);
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
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania terminarza.";
    debug.error("sync", message);
    return { ok: false, message, teamId, fixtures: [], plays: [], errors: [...errors, message] };
  } finally {
    await crawler.close();
  }
}
