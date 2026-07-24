// Bootstrap URL rozgrywek przed pierwszym tokenem (TYLKO SERWER).
//
// Prosta kotwica: zawsze goły /rozgrywki — tak jak w pierwotnym, działającym syncu.
// Deep-linki do lig powodowały częstsze SPA /404 i nie są potrzebne do mintowania tokenu
// (API competition działa dla dowolnej ligi po uzyskaniu Bearer).

import type { ScoutingConfig, ScoutingSeason, Sex } from '@/types/scouting';
import {
  buildRozgrywkiUrl,
  findLeagueGroupId,
  ROZGRYWKI_HOME_URL,
} from './rozgrywkiUrl';
import { getServerLeagueGroups } from './competitionsServerStore';

/** Ekstraklasa — używana tylko jako opcjonalna kotwica UI / metadane, nie do tokenu. */
export const TOKEN_ANCHOR_LEAGUE_ID = '337bb869-0b42-484f-8eca-0c8842a13ec9';

/** Fallback bieżącego sezonu (2026/2027) gdy brak listy sezonów z API. */
export const CURRENT_SEASON_FALLBACK = '3c77d143-8010-4073-9842-d6b63365ffce';

/** Fallback grupy Ekstraklasy. */
export const EKSTRAKLASA_GROUP_FALLBACK = '653070f7-c2f0-4f5a-a761-fb8264f26d88';

/** Szuka leagueGroupId w config lub serwerowym cache rozgrywek. */
export async function resolveLeagueGroupId(config: ScoutingConfig): Promise<string | null> {
  if (config.leagueGroupId) return config.leagueGroupId;
  const groups = await getServerLeagueGroups(config.sex, config.seasonId);
  if (!groups) return null;
  return findLeagueGroupId(groups, config.leagueId);
}

/** URL syncowanej ligi (metadane UI — nie używać do tokenu). */
export async function resolveBootstrapRozgrywkiUrl(config: ScoutingConfig): Promise<string | null> {
  const groupId = await resolveLeagueGroupId(config);
  if (!groupId) return null;
  return buildRozgrywkiUrl(config.seasonId, groupId, config.leagueId, config.sex);
}

/**
 * URL do mintowania tokenu reCAPTCHA.
 * Zawsze tylko goły /rozgrywki — bez deep-linków i bez stron meczów.
 * async zachowane dla kompatybilności z sync.ts.
 */
export async function resolveTokenBootstrapUrlCandidates(
  _config: ScoutingConfig,
  _seasons?: ScoutingSeason[]
): Promise<string[]> {
  return [ROZGRYWKI_HOME_URL];
}

/** Pierwszy (i jedyny) URL kotwicy. */
export async function resolveTokenBootstrapUrl(
  config: ScoutingConfig,
  seasons?: ScoutingSeason[]
): Promise<string> {
  const candidates = await resolveTokenBootstrapUrlCandidates(config, seasons);
  return candidates[0];
}

/** Helper testowy / UI: deep-link Ekstraklasy (nie do sync tokenu). */
export function buildEkstraklasaAnchorUrl(seasonId: string, sex: Sex = 'male'): string {
  return buildRozgrywkiUrl(seasonId, EKSTRAKLASA_GROUP_FALLBACK, TOKEN_ANCHOR_LEAGUE_ID, sex);
}
