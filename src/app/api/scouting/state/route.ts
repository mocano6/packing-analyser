import { NextResponse } from 'next/server';
import { getScoutingStore, enrichPlayerNamesFromLeagues } from '@/lib/scouting/store';
import { fixIncompletePlayerProfiles, migrateLegacyPlayerSeasons } from '@/lib/scouting/playerProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Zwraca aktualny stan bazy scoutingu (lokalny plik JSON).
export async function GET() {
  try {
    const store = getScoutingStore();
    const state = await store.load();
    let dirty = enrichPlayerNamesFromLeagues(state);
    if (fixIncompletePlayerProfiles(state)) dirty = true;
    if (migrateLegacyPlayerSeasons(state)) dirty = true;
    if (dirty) {
      await store.save(state);
    }
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd odczytu stanu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
