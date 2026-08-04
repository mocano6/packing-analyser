import { NextRequest, NextResponse } from "next/server";
import { fetchTeamFixturesFromLaczy } from "@/lib/microcycle/fetchTeamFixtures";
import { parseLaczyTeamIdFromUrl } from "@/utils/laczyTeamUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Pobiera terminarz drużyny z ŁNP na podstawie URL lub UUID. */
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
    const result = await fetchTeamFixturesFromLaczy(teamId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd pobierania terminarza.";
    console.error("[microcycle/team-fixtures]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
