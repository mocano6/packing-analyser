import { NextRequest, NextResponse } from "next/server";
import { fetchMatchMinutesFromLaczy } from "@/lib/microcycle/fetchMatchMinutes";
import { parseLaczyMatchIdFromUrl } from "@/utils/laczyTeamUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Pobiera skład i minuty meczu z ŁNP na podstawie URL lub UUID. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe JSON body." }, { status: 400 });
  }

  const urlOrId =
    typeof (body as { url?: unknown })?.url === "string"
      ? (body as { url: string }).url
      : typeof (body as { matchId?: unknown })?.matchId === "string"
        ? (body as { matchId: string }).matchId
        : "";

  const matchId = parseLaczyMatchIdFromUrl(urlOrId);
  if (!matchId) {
    return NextResponse.json(
      {
        error:
          "Podaj poprawny link do meczu ŁNP (…/rozgrywki/mecz/{uuid}) albo samo UUID.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await fetchMatchMinutesFromLaczy(matchId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania minut meczu.";
    console.error("[microcycle/match-minutes]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
