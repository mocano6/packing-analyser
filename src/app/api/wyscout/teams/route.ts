import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { fetchCompetitionOrSeasonTeams } from "@/lib/wyscout/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;

  const compId = Number(request.nextUrl.searchParams.get("compId"));
  if (!Number.isFinite(compId) || compId <= 0) {
    return NextResponse.json({ error: "Podaj poprawne compId rozgrywek." }, { status: 400 });
  }
  const seasonIdRaw = request.nextUrl.searchParams.get("seasonId");
  const seasonId = seasonIdRaw ? Number(seasonIdRaw) : undefined;

  try {
    const teams = await fetchCompetitionOrSeasonTeams({
      compId,
      seasonId: Number.isFinite(seasonId) && seasonId! > 0 ? seasonId : undefined,
    });
    return NextResponse.json({ teams });
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
