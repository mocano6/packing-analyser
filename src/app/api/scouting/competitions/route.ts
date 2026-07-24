import { NextRequest, NextResponse } from 'next/server';
import { fetchCompetitions } from '@/lib/scouting/sync';
import { ScoutingOperationError } from '@/lib/scouting/debugLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Zwraca listę sezonów i grup ligowych (do wyboru zakresu scoutingu w UI).
export async function GET(request: NextRequest) {
  const sexParam = request.nextUrl.searchParams.get('sex');
  const sex = sexParam === 'female' ? 'female' : 'male';
  const seasonId = request.nextUrl.searchParams.get('seasonId') || undefined;
  try {
    const data = await fetchCompetitions(sex, seasonId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ScoutingOperationError) {
      return NextResponse.json({ error: e.message, debugLog: e.debugLog }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : 'Błąd pobierania rozgrywek.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
