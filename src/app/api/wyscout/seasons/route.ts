import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { fetchCompetitionSeasons } from "@/lib/wyscout/service";

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

  try {
    const seasons = await fetchCompetitionSeasons(compId);
    return NextResponse.json({ seasons });
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
