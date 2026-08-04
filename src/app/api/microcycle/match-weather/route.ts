import { NextRequest, NextResponse } from "next/server";
import { fetchOpenMeteoWeatherForKickoff } from "@/lib/microcycle/openMeteoWeather";
import { isWithinForecastHorizon } from "@/utils/matchWeather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface MatchWeatherQuery {
  id: string;
  venueAddress: string;
  kickoffIso: string;
}

export interface MatchWeatherResultItem {
  id: string;
  ok: boolean;
  weatherCondition?: string;
  weatherTempC?: number;
  resolvedName?: string | null;
  error?: string;
}

/** Prognoza Open-Meteo dla listy meczów (adres + ISO kickoff). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const rawQueries = (body as { queries?: unknown })?.queries;
  if (!Array.isArray(rawQueries) || rawQueries.length === 0) {
    return NextResponse.json({ error: "Podaj queries: [{ id, venueAddress, kickoffIso }]." }, {
      status: 400,
    });
  }

  const queries: MatchWeatherQuery[] = [];
  for (const item of rawQueries.slice(0, 24)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? "");
    const venueAddress = String(rec.venueAddress ?? "").trim();
    const kickoffIso = String(rec.kickoffIso ?? "").trim();
    if (!id || !venueAddress || !kickoffIso) continue;
    queries.push({ id, venueAddress, kickoffIso });
  }

  if (queries.length === 0) {
    return NextResponse.json({ error: "Brak poprawnych zapytań pogodowych." }, { status: 400 });
  }

  const results: MatchWeatherResultItem[] = [];

  // Sekwencyjnie — geocode + forecast, unikamy burstu na free API
  for (const q of queries) {
    if (!isWithinForecastHorizon(q.kickoffIso)) {
      results.push({
        id: q.id,
        ok: false,
        error: "Poza horyzontem prognozy (ok. 10 dni).",
      });
      continue;
    }
    try {
      const weather = await fetchOpenMeteoWeatherForKickoff(q.venueAddress, q.kickoffIso);
      if (!weather) {
        results.push({ id: q.id, ok: false, error: "Nie znaleziono lokalizacji lub prognozy." });
        continue;
      }
      results.push({
        id: q.id,
        ok: true,
        weatherCondition: weather.weatherCondition,
        weatherTempC: weather.weatherTempC,
        resolvedName: weather.resolvedName,
      });
    } catch (e) {
      console.error("[microcycle/match-weather]", q.id, e);
      results.push({
        id: q.id,
        ok: false,
        error: e instanceof Error ? e.message : "Błąd Open-Meteo.",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: okCount > 0,
    results,
    message:
      okCount > 0
        ? `Pobrano pogodę dla ${okCount}/${results.length} lokalizacji.`
        : "Nie udało się pobrać prognozy dla żadnego meczu.",
  });
}
