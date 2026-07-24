import { NextRequest, NextResponse } from 'next/server';
import { saveServerLeagueGroups } from '@/lib/scouting/competitionsServerStore';
import type { ScoutingLeagueGroup, Sex } from '@/types/scouting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Zapisuje grupy lig z cache klienta do serwerowego magazynu (bootstrap URL syncu). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe JSON body.' }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const sex: Sex = o.sex === 'female' ? 'female' : 'male';
  const seasonId = typeof o.seasonId === 'string' ? o.seasonId : '';
  const leagueGroups = Array.isArray(o.leagueGroups) ? (o.leagueGroups as ScoutingLeagueGroup[]) : [];

  if (!seasonId || leagueGroups.length === 0) {
    return NextResponse.json({ error: 'Wymagane: seasonId, leagueGroups.' }, { status: 400 });
  }

  await saveServerLeagueGroups(sex, seasonId, leagueGroups);
  return NextResponse.json({ ok: true });
}
