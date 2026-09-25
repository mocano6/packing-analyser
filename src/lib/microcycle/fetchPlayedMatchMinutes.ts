// Batch minut z rozegranych meczów ŁNP (TYLKO SERWER — jedna sesja Chrome/reCAPTCHA).

import { LaczyCrawler, SCOUTING_AUTH_HELP } from "@/lib/scouting/crawler";
import { withLaczyCrawlerLock } from "@/lib/scouting/crawlerLock";
import { ScoutingDebugLogger } from "@/lib/scouting/debugLog";
import type { LnpCachedMatchMinutes } from "@/types/lnpPlayerLoad";
import {
  LNP_MINUTES_FETCH_BATCH,
  requestItemToCached,
  type PlayedMatchMinutesRequestItem,
} from "@/utils/lnpPlayerLoad";

export type { PlayedMatchMinutesRequestItem };

export interface FetchPlayedMatchMinutesResult {
  ok: boolean;
  message: string;
  teamId: string;
  matches: LnpCachedMatchMinutes[];
  fetched: number;
  withSquad: number;
  errors: string[];
}

export async function fetchPlayedMatchMinutesFromLaczy(
  teamId: string,
  items: PlayedMatchMinutesRequestItem[]
): Promise<FetchPlayedMatchMinutesResult> {
  return withLaczyCrawlerLock(() => fetchPlayedMatchMinutesFromLaczyUnlocked(teamId, items));
}

async function fetchPlayedMatchMinutesFromLaczyUnlocked(
  teamId: string,
  items: PlayedMatchMinutesRequestItem[]
): Promise<FetchPlayedMatchMinutesResult> {
  const debug = new ScoutingDebugLogger("fetchPlayedMatchMinutes", { teamId });
  const errors: string[] = [];
  const batch = items.slice(0, LNP_MINUTES_FETCH_BATCH);
  const crawler = new LaczyCrawler({
    debugLog: debug,
  });

  try {
    await crawler.open();
    const endpoints = batch.map((item) => crawler.matchEventsEndpoint(item.matchId));
    const results = await crawler.fetchMany<unknown>(endpoints);
    const fetchedAt = new Date().toISOString();
    const matches: LnpCachedMatchMinutes[] = [];

    batch.forEach((item, i) => {
      const res = results[i];
      if (!res || res.status !== 200) {
        const auth = !res || res.status === 0 || res.status === 401 || res.status === 403;
        const msg = auth
          ? res?.error || SCOUTING_AUTH_HELP
          : `Mecz ${item.matchId}: status ${res?.status ?? "brak"}`;
        errors.push(msg);
        return;
      }
      try {
        matches.push(requestItemToCached(item, teamId, res.data, fetchedAt));
      } catch (e) {
        errors.push(
          `Mecz ${item.matchId}: ${e instanceof Error ? e.message : "błąd parsowania składu"}`
        );
      }
    });

    const withSquad = matches.filter((m) => m.hasSquad).length;
    const ok = matches.length > 0;
    return {
      ok,
      message: ok
        ? `Pobrano składy z ${withSquad}/${matches.length} mecz(y).`
        : errors[0] || "Nie udało się pobrać minut z rozegranych meczów.",
      teamId,
      matches,
      fetched: matches.length,
      withSquad,
      errors,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania minut meczów.";
    debug.error("sync", message);
    return {
      ok: false,
      message,
      teamId,
      matches: [],
      fetched: 0,
      withSquad: 0,
      errors: [message],
    };
  } finally {
    await crawler.close();
  }
}
