// Orkiestracja inkrementalnej synchronizacji scoutingu (TYLKO SERWER).

import { LaczyCrawler, SCOUTING_AUTH_HELP } from './crawler';
import { getScoutingStore } from './store';
import {
  DEFAULT_MAX_MATCHES_PER_SYNC,
  DEFAULT_MAX_PLAYERS_PER_SYNC,
  PLAYER_FETCH_CHUNK,
  sliceWithLimit,
} from './syncLimits';
import { computeMatchPlayerStats, type RawMatchEvents } from './minutes';
import { seedPlayerFromMatchStat } from './playerNames';
import {
  fixIncompletePlayerProfiles,
  mergePlayerSeasonProfile,
  migrateLegacyPlayerSeasons,
  needsPlayerProfileFetch,
  parsePlayerAge,
  sortPlayerIdsForProfileFetch,
} from './playerProfile';
import { computeBirthYear } from './birthYear';
import { findLeagueGroupId } from './rozgrywkiUrl';
import { resolveTokenBootstrapUrlCandidates, TOKEN_ANCHOR_LEAGUE_ID, CURRENT_SEASON_FALLBACK } from './rozgrywkiBootstrap';
import { saveServerLeagueGroups } from './competitionsServerStore';
import { ScoutingDebugLogger, ScoutingOperationError } from './debugLog';
import {
  isWalkoverMatchState,
  matchNeedsEventFetch,
  shouldSkipMatchSync,
} from './matchStates';
import {
  leagueKey,
  type ScoutingConfig,
  type ScoutingSeason,
  type ScoutingLeagueGroup,
  type ScoutingState,
  type ScoutingSyncResult,
  type ScoutedMatch,
  type ScoutingTeamRef,
  type ScoutingPlayerInfo,
  type ScoutingDebugLog,
} from '@/types/scouting';

interface RawMatchListItem {
  matchId: string;
  dateTime: string;
  stadium?: string;
  state?: string;
  queue?: number;
  round?: string;
  host?: { id: string; name: string; abbreviation?: string; logo?: string };
  guest?: { id: string; name: string; abbreviation?: string; logo?: string };
  scores?: { final?: string; half?: string; fullTime?: string };
}

interface RawPlayerInfo {
  id: string;
  firstname?: string;
  lastname?: string;
  age?: number;
  citizenship?: string;
  club?: { id?: string; name?: string; abbreviation?: string };
}

const toTeamRef = (t?: RawMatchListItem['host']): ScoutingTeamRef => ({
  id: t?.id || '',
  name: t?.name || '',
  abbreviation: t?.abbreviation,
  logo: t?.logo,
});

const mapMatchMeta = (m: RawMatchListItem, fetchedAt: string): ScoutedMatch => ({
  matchId: m.matchId,
  dateTime: m.dateTime,
  queue: m.queue ?? null,
  round: m.round,
  state: m.state || '',
  stadium: m.stadium,
  host: toTeamRef(m.host),
  guest: toTeamRef(m.guest),
  scoreFinal: m.scores?.final ?? m.scores?.fullTime ?? null,
  scoreHalf: m.scores?.half ?? null,
  fetchedAt,
});

const mapPlayerInfo = (
  raw: RawPlayerInfo,
  fetchedAt: string,
  seasonId: string,
  seasonName: string
): ScoutingPlayerInfo => {
  const age = parsePlayerAge(raw.age);
  const birthYear = age != null ? computeBirthYear(age, seasonName) : null;
  return {
    id: raw.id,
    firstname: raw.firstname || '',
    lastname: raw.lastname || '',
    age,
    birthYear,
    citizenship: raw.citizenship || undefined,
    clubName: raw.club?.name || undefined,
    fetchedAt,
    bySeason: {
      [seasonId]: { age, birthYear, fetchedAt },
    },
    apiProfile: age != null,
  };
};

/** Pobiera dostępne sezony i grupy ligowe (do wyboru zakresu w UI). */
export async function fetchCompetitions(
  sex: 'male' | 'female',
  seasonId?: string
): Promise<{
  seasons: ScoutingSeason[];
  leagueGroups: ScoutingLeagueGroup[];
  selectedSeasonId: string | null;
  debugLog: ScoutingDebugLog;
}> {
  const debug = new ScoutingDebugLogger('fetchCompetitions', { sex, seasonId: seasonId || '' });
  const bootstrapCandidates = await resolveTokenBootstrapUrlCandidates({
    seasonId: seasonId || CURRENT_SEASON_FALLBACK,
    seasonName: '',
    leagueId: TOKEN_ANCHOR_LEAGUE_ID,
    leagueName: 'Ekstraklasa',
    sex,
  });
  const crawler = new LaczyCrawler({
    debugLog: debug,
    initialRozgrywkiUrlCandidates: bootstrapCandidates,
  });
  try {
    debug.info('sync', 'Otwieranie przeglądarki (prosty /rozgrywki)…', {
      detail: bootstrapCandidates[0],
    });
    await crawler.open();
    debug.info('sync', 'Pobieranie sezonów…');
    const seasonsRes = await crawler.fetchOne<ScoutingSeason[]>(crawler.seasonsEndpoint());
    if (seasonsRes.status === 0 || seasonsRes.error?.includes('tokenu')) {
      throw new ScoutingOperationError(
        'Nie udało się uzyskać tokenu dostępu (reCAPTCHA). Strona mogła przekierować na /rozgrywki/404 — zamknij okna Chrome scoutingu i spróbuj ponownie. W razie potrzeby uruchom sync z SCOUTING_RESET_PROFILE=1.',
        debug.finish()
      );
    }
    if (seasonsRes.status === 404) {
      throw new ScoutingOperationError('API rozgrywek zwróciło 404 — endpoint mógł się zmienić.', debug.finish());
    }
    if (seasonsRes.status !== 200) {
      throw new ScoutingOperationError(`API sezonów zwróciło status ${seasonsRes.status}.`, debug.finish());
    }
    const seasons = Array.isArray(seasonsRes.data) ? seasonsRes.data : [];
    if (seasons.length === 0) {
      throw new ScoutingOperationError(
        'Pobrano pustą listę sezonów. Sprawdź, czy okno Chrome pokazuje stronę Rozgrywki (laczynaspilka.pl/rozgrywki/) — jeśli widzisz 404, zamknij inne okna Chrome i spróbuj ponownie.',
        debug.finish()
      );
    }
    const selectedSeasonId =
      (seasonId && seasons.some((s) => s.id === seasonId) ? seasonId : null) ??
      (seasons.find((s) => s.isCurrent) || seasons[0])?.id ??
      null;

    let leagueGroups: ScoutingLeagueGroup[] = [];
    if (selectedSeasonId) {
      debug.info('sync', `Pobieranie grup ligowych (sezon ${selectedSeasonId})…`);
      const lgRes = await crawler.fetchOne<ScoutingLeagueGroup[]>(
        crawler.leagueGroupsEndpoint(selectedSeasonId, sex)
      );
      leagueGroups = Array.isArray(lgRes.data) ? lgRes.data : [];
      if (leagueGroups.length > 0 && selectedSeasonId) {
        await saveServerLeagueGroups(sex, selectedSeasonId, leagueGroups);
      }
      debug.ok('sync', `Pobrano ${leagueGroups.length} grup ligowych`);
    }
    const debugLog = debug.finish();
    return { seasons, leagueGroups, selectedSeasonId, debugLog };
  } catch (e) {
    if (e instanceof ScoutingOperationError) throw e;
    debug.error('sync', e instanceof Error ? e.message : String(e));
    throw new ScoutingOperationError(e instanceof Error ? e.message : 'Błąd pobierania rozgrywek.', debug.finish());
  } finally {
    await crawler.close();
  }
}

export interface SyncOptions {
  config: ScoutingConfig;
  /** Maks. liczba meczów ze zdarzeniami w jednym syncu (domyślnie 80). */
  maxMatchesToFetch?: number;
  /** Maks. liczba profili zawodników w jednym syncu (domyślnie 80). */
  maxPlayersToFetch?: number;
}

/**
 * Inkrementalny sync jednej ligi: pobiera listę meczów, zdarzenia (składy, bramki, minuty)
 * tylko dla meczów rozegranych bez zapisanych statystyk, oraz dane (wiek) nowych zawodników.
 * Wynik merguje do wspólnego stanu (wiele lig + cache zawodników).
 */
export async function runSync(opts: SyncOptions): Promise<ScoutingSyncResult> {
  const { config } = opts;
  const debug = new ScoutingDebugLogger('runSync', {
    seasonId: config.seasonId,
    leagueId: config.leagueId,
    sex: config.sex,
  });
  const store = getScoutingStore();
  const state = await store.load();
  fixIncompletePlayerProfiles(state);
  migrateLegacyPlayerSeasons(state);
  const key = leagueKey(config.seasonId, config.leagueId);
  const now = new Date();
  const nowIso = now.toISOString();
  const errors: string[] = [];

  const prevLeague = state.leagues[key];
  const baseMatches = prevLeague?.matches ?? [];
  const lastUpdated = prevLeague?.lastUpdatedAt ? new Date(prevLeague.lastUpdatedAt) : null;
  const existingById = new Map(baseMatches.map((m) => [m.matchId, m]));

  const maxMatchesLimit = opts.maxMatchesToFetch ?? DEFAULT_MAX_MATCHES_PER_SYNC;
  const maxPlayersLimit = opts.maxPlayersToFetch ?? DEFAULT_MAX_PLAYERS_PER_SYNC;

  let progressCheckedMatches = 0;
  let progressNewMatches = 0;
  let progressUpdatedMatches = 0;
  let progressFetchedPlayers = 0;

  // Lokalny komplet (np. tylko walkowery bez stats) — bez odpalania Chrome.
  if (prevLeague) {
    const neededIds = new Set<string>();
    for (const m of baseMatches) {
      for (const p of m.playerStats || []) {
        if (needsPlayerProfileFetch(state.players[p.playerId], config.seasonId)) neededIds.add(p.playerId);
      }
    }
    if (
      shouldSkipMatchSync({
        isCurrentSeason: prevLeague.isCurrentSeason,
        matches: baseMatches,
        playersNeedingProfile: neededIds.size,
      })
    ) {
      debug.ok('sync', 'Liga kompletna lokalnie — pomijam sync (walkowery bez events)');
      return {
        ok: true,
        message:
          'Wszystkie mecze rozegrane mają już statystyki. Walkowery są pomijane (bez składu) — synchronizacja zbędna.',
        leagueKey: key,
        checkedMatches: 0,
        newMatches: 0,
        updatedMatches: 0,
        fetchedPlayers: 0,
        matchesRemaining: 0,
        playersRemaining: 0,
        errors: [],
        state,
        debugLog: debug.finish(),
      };
    }
  }

  const failResult = async (message: string, extraErrors: string[] = []): Promise<ScoutingSyncResult> => {
    debug.error('sync', message, { detail: extraErrors.join('; ') || undefined });
    try {
      await store.save(state);
    } catch {
      /* checkpoint best-effort */
    }
    const persisted = await store.load();
    const partial =
      progressCheckedMatches > 0 || progressFetchedPlayers > 0 || progressUpdatedMatches > 0;
    const suffix = partial
      ? ` Częściowy postęp zapisany: ${progressUpdatedMatches} mecz(ów) ze stat., ${progressFetchedPlayers} zawodnik(ów).`
      : '';
    return {
      ok: false,
      message: message + suffix,
      leagueKey: key,
      checkedMatches: progressCheckedMatches,
      newMatches: progressNewMatches,
      updatedMatches: progressUpdatedMatches,
      fetchedPlayers: progressFetchedPlayers,
      errors: [...errors, ...extraErrors],
      state: persisted,
      debugLog: debug.finish(),
    };
  };

  const persistLeagueCheckpoint = async (
    merged: ScoutedMatch[],
    cappedCount: number,
    syncNewMatches: number,
    syncUpdatedMatches: number,
    isCurrentSeason: boolean
  ): Promise<void> => {
    state.leagues[key] = {
      config,
      lastUpdatedAt: nowIso,
      isCurrentSeason,
      matches: merged.sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1)),
      lastSync: {
        at: nowIso,
        checkedMatches: cappedCount,
        newMatches: syncNewMatches,
        updatedMatches: syncUpdatedMatches,
        errors: [...errors],
      },
    };
    await store.save(state);
  };

  const persistLeagueGroupId = async (crawler: LaczyCrawler): Promise<void> => {
    const lgRes = await crawler.fetchOne<ScoutingLeagueGroup[]>(
      crawler.leagueGroupsEndpoint(config.seasonId, config.sex)
    );
    if (lgRes.status !== 200 || !Array.isArray(lgRes.data)) return;
    await saveServerLeagueGroups(config.sex, config.seasonId, lgRes.data);
    const groupId = findLeagueGroupId(lgRes.data, config.leagueId);
    if (!groupId) {
      debug.warn('sync', 'Nie znaleziono grupy ligowej syncowanej ligi w API');
      return;
    }
    config.leagueGroupId = groupId;
    debug.info('sync', `Zapisano leagueGroupId syncowanej ligi: ${groupId}`);
  };

  const bootstrapCandidates = await resolveTokenBootstrapUrlCandidates(config);
  debug.info('sync', 'Bootstrap URL tokenu', { detail: bootstrapCandidates[0] });

  const crawler = new LaczyCrawler({
    debugLog: debug,
    initialRozgrywkiUrlCandidates: bootstrapCandidates,
  });
  try {
    debug.info('sync', 'Otwieranie przeglądarki (prosty /rozgrywki)…');
    await crawler.open();

    // 0) Ustal, czy sezon jest bieżący (ligi z zakończonych sezonów nie trzeba odświeżać).
    const seasonsRes = await crawler.fetchOne<ScoutingSeason[]>(crawler.seasonsEndpoint());
    // Fail-fast: bez tokenu nie ma sensu iść dalej (wcześniej młóciliśmy sezony+mecze ~2.5 min).
    if (!seasonsRes || seasonsRes.status === 0 || seasonsRes.status === 401 || seasonsRes.status === 403) {
      return failResult(seasonsRes?.error || SCOUTING_AUTH_HELP, [
        seasonsRes?.error || `status ${seasonsRes?.status ?? 'brak'}`,
      ]);
    }
    if (crawler.isAuthDead()) {
      return failResult(SCOUTING_AUTH_HELP, [seasonsRes.error || 'auth dead']);
    }
    if (seasonsRes.status === 200 && Array.isArray(seasonsRes.data)) {
      await persistLeagueGroupId(crawler);
    }
    const isCurrentSeason = Array.isArray(seasonsRes.data)
      ? !!seasonsRes.data.find((s) => s.id === config.seasonId)?.isCurrent
      : (prevLeague?.isCurrentSeason ?? true);

    // 1) Lista meczów (metadane + wyniki) - jedno wywołanie.
    const listRes = await crawler.fetchOne<RawMatchListItem[]>(
      crawler.matchesEndpoint(config.leagueId, config.seasonId)
    );
    if (!listRes || listRes.status !== 200 || !Array.isArray(listRes.data)) {
      const authMsg =
        !listRes ||
        listRes.status === 0 ||
        listRes.status === 401 ||
        listRes.status === 403 ||
        crawler.isAuthDead();
      return failResult(
        authMsg
          ? listRes?.error || SCOUTING_AUTH_HELP
          : `Nie udało się pobrać listy meczów (status ${listRes?.status}).`,
        [listRes?.error || `status ${listRes?.status ?? 'brak'}`]
      );
    }
    const rawList = listRes.data;

    // 2) Mecze wymagające events: tylko „Rozegrany” (walkowery pomijamy — brak składu).
    const toFetch = rawList.filter((m) =>
      matchNeedsEventFetch(m, {
        now,
        existing: existingById.get(m.matchId),
        lastUpdated,
      })
    );
    const walkoverCount = rawList.filter((m) => isWalkoverMatchState(m.state)).length;
    const { slice: capped, remaining: matchesRemaining } = sliceWithLimit(toFetch, maxMatchesLimit);

    debug.info(
      'sync',
      `Mecze do pobrania zdarzeń: ${capped.length} / ${rawList.length} na liście` +
        (walkoverCount > 0 ? ` (${walkoverCount} walkower — pominięte)` : '')
    );
    if (matchesRemaining > 0) {
      debug.info('sync', `Pozostało ${matchesRemaining} mecz(ów) — uruchom sync ponownie po zakończeniu tej sesji.`);
    }

    // 3) Zdarzenia dla wybranych meczów (paczkami równoległymi).
    const eventResults = await crawler.fetchMany<RawMatchEvents>(
      capped.map((m) => crawler.matchEventsEndpoint(m.matchId))
    );
    const statsByMatchId = new Map<string, ScoutedMatch['playerStats']>();
    capped.forEach((m, i) => {
      const res = eventResults[i];
      if (res && res.status === 200 && res.data) {
        statsByMatchId.set(m.matchId, computeMatchPlayerStats(res.data, toTeamRef(m.host), toTeamRef(m.guest)));
      } else {
        errors.push(`Mecz ${m.matchId}: zdarzenia status ${res?.status ?? 'brak'}`);
      }
    });

    // 4) Zmerguj mecze ligi (pełna lista metadanych + statystyki dla pobranych).
    let newMatches = 0;
    const updatedMatches = statsByMatchId.size;
    const merged: ScoutedMatch[] = rawList.map((m) => {
      const meta = mapMatchMeta(m, nowIso);
      const existing = existingById.get(m.matchId);
      if (!existing) newMatches++;
      const freshStats = statsByMatchId.get(m.matchId);
      if (freshStats) return { ...meta, playerStats: freshStats };
      if (existing?.playerStats) return { ...meta, playerStats: existing.playerStats };
      return meta;
    });

    await persistLeagueCheckpoint(merged, capped.length, newMatches, updatedMatches, isCurrentSeason);
    progressCheckedMatches = capped.length;
    progressNewMatches = newMatches;
    progressUpdatedMatches = updatedMatches;
    const withSquad = [...statsByMatchId.values()].filter((s) => Array.isArray(s) && s.length > 0).length;
    const emptyEvents = statsByMatchId.size - withSquad;
    debug.ok(
      'sync',
      `Checkpoint: zapisano ${merged.length} meczów ligi (${statsByMatchId.size} events: ${withSquad} ze składem, ${emptyEvents} pustych)`
    );

    // Nazwiska ze składów meczowych — od razu w cache (wiek pobieramy osobno z API).
    for (const m of merged) {
      for (const p of m.playerStats || []) {
        seedPlayerFromMatchStat(state.players, p, nowIso);
      }
    }
    await store.save(state);

    // 5) Pełne profile zawodników (wiek, obywatelstwo) — każdy bez wieku w cache.
    const neededIds = new Set<string>();
    for (const m of merged) {
      for (const p of m.playerStats || []) {
        if (needsPlayerProfileFetch(state.players[p.playerId], config.seasonId)) neededIds.add(p.playerId);
      }
    }
    const orderedIds = sortPlayerIdsForProfileFetch(Array.from(neededIds), state.players, config.seasonId);
    const { slice: playersToFetch, remaining: playersRemaining } = sliceWithLimit(
      orderedIds,
      maxPlayersLimit
    );
    let fetchedPlayers = 0;
    if (playersToFetch.length > 0) {
      debug.info('sync', `Pobieranie danych ${playersToFetch.length} zawodników…`);
      if (playersRemaining > 0) {
        debug.info('sync', `Pozostało ${playersRemaining} zawodnik(ów) — uruchom sync ponownie.`);
      }
      for (let i = 0; i < playersToFetch.length; i += PLAYER_FETCH_CHUNK) {
        const chunk = playersToFetch.slice(i, i + PLAYER_FETCH_CHUNK);
        const playerResults = await crawler.fetchMany<RawPlayerInfo>(
          chunk.map((id) => crawler.playerEndpoint(id))
        );
        chunk.forEach((id, j) => {
          const r = playerResults[j];
          if (r && r.status === 200 && r.data) {
            const seeded = state.players[id];
            const apiAge = parsePlayerAge(r.data.age);
            const mapped = mapPlayerInfo(r.data, nowIso, config.seasonId, config.seasonName);
            const effectiveAge =
              apiAge ?? seeded?.age ?? seeded?.bySeason?.[config.seasonId]?.age ?? null;
            const base: ScoutingPlayerInfo = {
              ...mapped,
              age: effectiveAge,
              birthYear:
                effectiveAge != null
                  ? computeBirthYear(effectiveAge, config.seasonName)
                  : (seeded?.birthYear ?? mapped.birthYear),
              firstname: mapped.firstname || seeded?.firstname || '',
              lastname: mapped.lastname || seeded?.lastname || '',
              bySeason:
                apiAge != null ? { ...seeded?.bySeason, ...mapped.bySeason } : seeded?.bySeason,
            };
            state.players[id] = mergePlayerSeasonProfile(
              base,
              config.seasonId,
              config.seasonName,
              effectiveAge,
              nowIso
            );
            fetchedPlayers++;
          } else {
            errors.push(`Zawodnik ${id}: dane status ${r?.status ?? 'brak'}`);
          }
        });
        progressFetchedPlayers = fetchedPlayers;
        await store.save(state);
      }
    }

    // 6) Finalny zapis metadanych ligi.
    state.leagues[key] = {
      config,
      lastUpdatedAt: nowIso,
      isCurrentSeason,
      matches: merged.sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1)),
      lastSync: { at: nowIso, checkedMatches: capped.length, newMatches, updatedMatches, errors },
    };
    await store.save(state);

    debug.ok('sync', `Zakończono: ${statsByMatchId.size} meczów ze stat., ${fetchedPlayers} zawodników`);
    if (errors.length) debug.warn('sync', `${errors.length} błędów cząstkowych`, { detail: errors.slice(0, 5).join('; ') });

    const authNoise = errors.some((e) => /401|403|reCAPTCHA|tokenu/i.test(e));
    const missedEvents = capped.length - statsByMatchId.size;

    let message = `Sprawdzono ${capped.length} mecz(y), statystyki dla ${statsByMatchId.size}, nowych zawodników: ${fetchedPlayers}.`;
    if (missedEvents > 0) {
      message += ` Nie udało się pobrać zdarzeń dla ${missedEvents} — uruchom sync ponownie.`;
    }
    if (matchesRemaining > 0 || playersRemaining > 0) {
      const parts: string[] = [];
      if (matchesRemaining > 0) parts.push(`${matchesRemaining} mecz(ów)`);
      if (playersRemaining > 0) parts.push(`${playersRemaining} zawodnik(ów)`);
      message += ` Pozostało w kolejce: ${parts.join(', ')}.`;
    }
    if (authNoise && (missedEvents > 0 || fetchedPlayers < playersToFetch.length)) {
      message +=
        ' Token reCAPTCHA wygasł pod koniec sesji — to normalne. Kolejny Sync kontynuuje (przy 403 profil resetuje się sam).';
    }

    const ok = statsByMatchId.size > 0 || fetchedPlayers > 0 || (capped.length === 0 && !authNoise);

    return {
      ok,
      message,
      leagueKey: key,
      checkedMatches: capped.length,
      newMatches,
      updatedMatches,
      fetchedPlayers,
      matchesRemaining: matchesRemaining + Math.max(0, missedEvents),
      playersRemaining,
      errors,
      state,
      debugLog: debug.finish(),
    };
  } catch (e) {
    debug.error('sync', e instanceof Error ? e.message : String(e));
    return failResult(e instanceof Error ? e.message : 'Błąd synchronizacji.');
  } finally {
    await crawler.close();
  }
}

/** Usuwa śledzoną ligę z magazynu (bez usuwania cache zawodników). */
export async function removeLeague(key: string): Promise<ScoutingState> {
  const store = getScoutingStore();
  const state = await store.load();
  if (state.leagues[key]) {
    delete state.leagues[key];
    await store.save(state);
  }
  return state;
}
