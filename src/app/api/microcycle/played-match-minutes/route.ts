import { NextRequest, NextResponse } from "next/server";
import {
  fetchPlayedMatchMinutesFromLaczy,
  type PlayedMatchMinutesRequestItem,
} from "@/lib/microcycle/fetchPlayedMatchMinutes";
import { parseLaczyTeamIdFromUrl } from "@/utils/laczyTeamUrl";
import { LNP_MINUTES_FETCH_BATCH } from "@/utils/lnpPlayerLoad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function readItems(raw: unknown): PlayedMatchMinutesRequestItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PlayedMatchMinutesRequestItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const matchId = typeof rec.matchId === "string" ? rec.matchId.trim() : "";
    const dateTime = typeof rec.dateTime === "string" ? rec.dateTime : "";
    if (!matchId || !dateTime || seen.has(matchId)) continue;
    seen.add(matchId);
    out.push({
      matchId,
      dateTime,
      opponent: typeof rec.opponent === "string" ? rec.opponent : undefined,
      isHome: typeof rec.isHome === "boolean" ? rec.isHome : undefined,
      playName: typeof rec.playName === "string" ? rec.playName : undefined,
      scoreFinal: rec.scoreFinal == null ? null : String(rec.scoreFinal),
      hostId: typeof rec.hostId === "string" ? rec.hostId : undefined,
      guestId: typeof rec.guestId === "string" ? rec.guestId : undefined,
      hostName: typeof rec.hostName === "string" ? rec.hostName : undefined,
      guestName: typeof rec.guestName === "string" ? rec.guestName : undefined,
    });
  }
  return out.slice(0, LNP_MINUTES_FETCH_BATCH);
}

/** Pobiera składy i minuty dla listy rozegranych meczów ŁNP (jedna sesja crawlera). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const urlOrId =
    typeof rec.url === "string" ? rec.url : typeof rec.teamId === "string" ? rec.teamId : "";
  const teamId = parseLaczyTeamIdFromUrl(urlOrId);
  if (!teamId) {
    return NextResponse.json(
      {
        error: "Podaj poprawny link do drużyny ŁNP (…/rozgrywki/druzyna/{uuid}) albo samo UUID.",
      },
      { status: 400 }
    );
  }

  const items = readItems(rec.matches);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Podaj listę rozegranych meczów (matchId + dateTime)." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPlayedMatchMinutesFromLaczy(teamId, items);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania minut meczów.";
    console.error("[microcycle/played-match-minutes]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
