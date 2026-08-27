// Pobieranie składu i minut meczu z API ŁNP (TYLKO SERWER — wymaga Chrome/reCAPTCHA).

import { LaczyCrawler, SCOUTING_AUTH_HELP } from "@/lib/scouting/crawler";
import { ScoutingDebugLogger } from "@/lib/scouting/debugLog";
import { extractLnpMatchMinutes, type LnpMatchMinutesPayload } from "@/utils/lnpMatchMinutes";
import { buildLaczyMatchPageUrl } from "@/utils/laczyTeamUrl";

export interface FetchMatchMinutesResult {
  ok: boolean;
  message: string;
  matchId: string;
  payload: LnpMatchMinutesPayload | null;
  errors: string[];
  debugLog?: ReturnType<ScoutingDebugLogger["finish"]>;
}

export async function fetchMatchMinutesFromLaczy(matchId: string): Promise<FetchMatchMinutesResult> {
  const debug = new ScoutingDebugLogger("fetchMatchMinutes", { matchId });
  const errors: string[] = [];
  const matchPage = buildLaczyMatchPageUrl(matchId);
  const crawler = new LaczyCrawler({
    debugLog: debug,
    initialRozgrywkiUrlCandidates: [matchPage, "https://www.laczynaspilka.pl/rozgrywki"],
  });

  try {
    await crawler.open();

    const [metaRes, eventsRes] = await crawler.fetchMany<unknown>([
      `matches/${matchId}`,
      crawler.matchEventsEndpoint(matchId),
    ]);

    const authFailed = (res: typeof eventsRes) =>
      !res || res.status === 0 || res.status === 401 || res.status === 403;

    if (authFailed(metaRes) && authFailed(eventsRes)) {
      const msg = eventsRes?.error || metaRes?.error || SCOUTING_AUTH_HELP;
      return {
        ok: false,
        message: msg,
        matchId,
        payload: null,
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    if (!eventsRes || eventsRes.status !== 200) {
      const msg = authFailed(eventsRes)
        ? eventsRes?.error || SCOUTING_AUTH_HELP
        : `Nie udało się pobrać składu meczu (status ${eventsRes?.status ?? "brak"}).`;
      return {
        ok: false,
        message: msg,
        matchId,
        payload: null,
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    const payload = extractLnpMatchMinutes(
      eventsRes.data,
      metaRes?.status === 200 ? metaRes.data : null,
      matchId
    );
    const squadCount = payload.hostPlayers.length + payload.guestPlayers.length;
    if (squadCount === 0) {
      const msg =
        "Brak składu w tym meczu ŁNP (mecz nierozegany, walkower albo API nie zwróciło zawodników).";
      return {
        ok: false,
        message: msg,
        matchId,
        payload,
        errors: [msg],
        debugLog: debug.finish(),
      };
    }

    return {
      ok: true,
      message: `Pobrano skład ${payload.hostName} vs ${payload.guestName} (${squadCount} zawodników).`,
      matchId,
      payload,
      errors,
      debugLog: debug.finish(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania minut meczu.";
    debug.error("sync", message);
    return {
      ok: false,
      message,
      matchId,
      payload: null,
      errors: [message],
      debugLog: debug.finish(),
    };
  } finally {
    await crawler.close();
  }
}
