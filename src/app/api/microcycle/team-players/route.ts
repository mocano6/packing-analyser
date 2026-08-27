import { NextRequest, NextResponse } from "next/server";
import { fetchTeamPlayersFromLaczy } from "@/lib/microcycle/fetchTeamPlayers";
import { parseLaczyTeamIdFromUrl } from "@/utils/laczyTeamUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Pobiera kadrę drużyny z ŁNP na podstawie URL lub UUID. */
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
      : typeof (body as { teamId?: unknown })?.teamId === "string"
        ? (body as { teamId: string }).teamId
        : "";

  const teamId = parseLaczyTeamIdFromUrl(urlOrId);
  if (!teamId) {
    return NextResponse.json(
      {
        error:
          "Podaj poprawny link do drużyny ŁNP (…/rozgrywki/druzyna/{uuid}) albo samo UUID.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await fetchTeamPlayersFromLaczy(teamId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania kadry.";
    console.error("[microcycle/team-players]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
