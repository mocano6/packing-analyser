import type { MicrocycleWeatherCondition } from "@/types/trainingMicrocycle";
import {
  applyWindOverride,
  geocodeQueryCandidates,
  pickHourlyIndex,
  wmoCodeToCondition,
} from "@/utils/matchWeather";

export interface OpenMeteoWeatherResult {
  weatherCondition: MicrocycleWeatherCondition;
  weatherTempC: number;
  latitude: number;
  longitude: number;
  resolvedName: string | null;
}

interface GeocodeHit {
  latitude: number;
  longitude: number;
  name?: string;
  admin1?: string;
  country?: string;
}

async function geocodeAddress(address: string): Promise<GeocodeHit | null> {
  const candidates = geocodeQueryCandidates(address);
  for (const name of candidates) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "pl");
    url.searchParams.set("countryCode", "PL");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const hit = data.results?.[0];
    if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
      return hit;
    }
  }
  // Bez countryCode — czasem zagraniczny wyjazd
  for (const name of candidates.slice(0, 2)) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "pl");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const hit = data.results?.[0];
    if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
      return hit;
    }
  }
  return null;
}

export async function fetchOpenMeteoWeatherForKickoff(
  venueAddress: string,
  kickoffIso: string
): Promise<OpenMeteoWeatherResult | null> {
  const address = venueAddress.trim();
  if (!address || !kickoffIso) return null;

  const geo = await geocodeAddress(address);
  if (!geo) return null;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(geo.latitude));
  url.searchParams.set("longitude", String(geo.longitude));
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,wind_speed_10m,precipitation_probability"
  );
  url.searchParams.set("timezone", "Europe/Warsaw");
  url.searchParams.set("forecast_days", "14");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: (number | null)[];
      weather_code?: (number | null)[];
      wind_speed_10m?: (number | null)[];
    };
  };

  const times = data.hourly?.time ?? [];
  const idx = pickHourlyIndex(times, kickoffIso);
  if (idx < 0) return null;

  const tempRaw = data.hourly?.temperature_2m?.[idx];
  const codeRaw = data.hourly?.weather_code?.[idx];
  const windRaw = data.hourly?.wind_speed_10m?.[idx];
  if (tempRaw == null || codeRaw == null) return null;

  const tempC = Math.round(tempRaw);
  if (tempC < -30 || tempC > 50) return null;

  let condition = wmoCodeToCondition(codeRaw);
  condition = applyWindOverride(condition, windRaw ?? null);

  const resolvedName = [geo.name, geo.admin1].filter(Boolean).join(", ") || null;

  return {
    weatherCondition: condition,
    weatherTempC: tempC,
    latitude: geo.latitude,
    longitude: geo.longitude,
    resolvedName,
  };
}
