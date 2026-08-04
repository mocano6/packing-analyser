import type { MicrocycleWeatherCondition } from "@/types/trainingMicrocycle";
import { addDays, parseIsoDateLocal } from "@/utils/matchDayLabels";

/** Horyzont prognozy — typowo tydzień przed meczem (obowiązek adresu). */
export const MATCH_WEATHER_FORECAST_DAYS = 10;

/**
 * Mapowanie kodów WMO (Open-Meteo weather_code) → nasze warunki.
 * @see https://open-meteo.com/en/docs
 */
export function wmoCodeToCondition(code: number): MicrocycleWeatherCondition {
  if (!Number.isFinite(code)) return "unknown";
  const c = Math.trunc(code);
  if (c === 0) return "sunny";
  if (c >= 1 && c <= 3) return c === 1 ? "sunny" : "cloudy";
  if (c === 45 || c === 48) return "cloudy";
  if (c >= 51 && c <= 67) return "rain";
  if (c >= 71 && c <= 77) return "snow";
  if (c >= 80 && c <= 82) return "rain";
  if (c >= 85 && c <= 86) return "snow";
  if (c >= 95 && c <= 99) return "storm";
  return "unknown";
}

/** Silny wiatr przy pogodzie bez opadów → „Wiatr”. */
export function applyWindOverride(
  condition: MicrocycleWeatherCondition,
  windSpeedKmh: number | null | undefined,
  thresholdKmh = 40
): MicrocycleWeatherCondition {
  if (windSpeedKmh == null || !Number.isFinite(windSpeedKmh)) return condition;
  if (windSpeedKmh < thresholdKmh) return condition;
  if (condition === "sunny" || condition === "cloudy" || condition === "unknown") {
    return "wind";
  }
  return condition;
}

export function kickoffIsoFromMicrocycleDay(
  weekStartIso: string,
  dayIndex: number,
  kickoffTime: string
): string | null {
  if (!weekStartIso || dayIndex < 0 || dayIndex > 6) return null;
  const time = /^\d{1,2}:\d{2}$/.test(kickoffTime.trim()) ? kickoffTime.trim() : "18:00";
  const [hh, mm] = time.split(":").map(Number);
  try {
    const day = addDays(parseIsoDateLocal(weekStartIso), dayIndex);
    day.setHours(hh, mm, 0, 0);
    if (Number.isNaN(day.getTime())) return null;
    return day.toISOString();
  } catch {
    return null;
  }
}

export function isWithinForecastHorizon(
  kickoffIso: string,
  now = new Date(),
  maxDays = MATCH_WEATHER_FORECAST_DAYS
): boolean {
  const t = new Date(kickoffIso).getTime();
  if (!Number.isFinite(t)) return false;
  const deltaMs = t - now.getTime();
  if (deltaMs < -3 * 3_600_000) return false; // >3h po kickoffie — nie odświeżaj
  return deltaMs <= maxDays * 86_400_000;
}

/** Upraszcza adres pod geokodowanie (miasto z kodu pocztowego / ostatni segment). */
export function geocodeQueryCandidates(address: string): string[] {
  const raw = address.trim().replace(/\s+/g, " ");
  if (!raw) return [];
  const out: string[] = [raw];
  const postalCity = raw.match(/\d{2}-\d{3}\s+([^,]+)/);
  if (postalCity?.[1]) {
    const city = postalCity[1].trim();
    if (city && !out.includes(city)) out.push(city);
    const withPl = `${city}, Polska`;
    if (!out.includes(withPl)) out.push(withPl);
  }
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last && !out.includes(last)) out.push(last);
  }
  return out;
}

export function pickHourlyIndex(
  times: string[],
  kickoffIso: string
): number {
  if (times.length === 0) return -1;
  const target = new Date(kickoffIso).getTime();
  if (!Number.isFinite(target)) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    if (!Number.isFinite(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
