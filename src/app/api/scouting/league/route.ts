import { NextRequest, NextResponse } from 'next/server';
import { removeLeague } from '@/lib/scouting/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Usuwa śledzoną ligę z magazynu scoutingu (parametr key = `${seasonId}:${leagueId}`).
export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Brak parametru key.' }, { status: 400 });
  }
  try {
    const state = await removeLeague(key);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd usuwania ligi.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
