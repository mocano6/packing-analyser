import { NextRequest, NextResponse } from 'next/server';
import { runSync } from '@/lib/scouting/sync';
import { DEFAULT_MAX_MATCHES_PER_SYNC, DEFAULT_MAX_PLAYERS_PER_SYNC } from '@/lib/scouting/syncLimits';
import type { ScoutingConfig } from '@/types/scouting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Sync uruchamia przeglądarkę i może potrwać (reCAPTCHA + wiele meczów).
// Hobby plan Vercel: maxDuration 1–300 s.
export const maxDuration = 300;

const isValidConfig = (c: unknown): c is ScoutingConfig => {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.seasonId === 'string' &&
    typeof o.leagueId === 'string' &&
    (o.sex === 'male' || o.sex === 'female')
  );
};

// Uruchamia inkrementalną synchronizację danych scoutingu dla wybranej ligi/sezonu.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe JSON body.' }, { status: 400 });
  }

  const config = (body as { config?: unknown })?.config;
  if (!isValidConfig(config)) {
    return NextResponse.json({ error: 'Brak lub nieprawidłowy config (seasonId, leagueId, sex).' }, { status: 400 });
  }

  const maxRaw = (body as { maxMatchesToFetch?: unknown })?.maxMatchesToFetch;
  const maxMatchesToFetch =
    typeof maxRaw === 'number' && maxRaw > 0 ? Math.floor(maxRaw) : DEFAULT_MAX_MATCHES_PER_SYNC;

  const maxPlayersRaw = (body as { maxPlayersToFetch?: unknown })?.maxPlayersToFetch;
  const maxPlayersToFetch =
    typeof maxPlayersRaw === 'number' && maxPlayersRaw > 0
      ? Math.floor(maxPlayersRaw)
      : DEFAULT_MAX_PLAYERS_PER_SYNC;

  try {
    const result = await runSync({
      config: {
        seasonId: config.seasonId,
        seasonName: config.seasonName || '',
        leagueId: config.leagueId,
        leagueName: config.leagueName || '',
        sex: config.sex,
        leagueGroupId: typeof config.leagueGroupId === 'string' ? config.leagueGroupId : undefined,
      },
      maxMatchesToFetch,
      maxPlayersToFetch,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd synchronizacji.';
    console.error('[scouting/sync]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
