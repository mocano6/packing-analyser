import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { fetchWyscoutTeamOverview } from "@/lib/wyscout/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;

  const wyId = Number(request.nextUrl.searchParams.get("wyId"));
  if (!Number.isFinite(wyId) || wyId <= 0) {
    return NextResponse.json({ error: "Podaj poprawne wyId drużyny Wyscout." }, { status: 400 });
  }

  const matchDate = request.nextUrl.searchParams.get("matchDate")?.trim() || undefined;
  const teamName = request.nextUrl.searchParams.get("teamName")?.trim() || undefined;
  const matchWyIdRaw = request.nextUrl.searchParams.get("matchWyId");
  const matchWyId = matchWyIdRaw ? Number(matchWyIdRaw) : undefined;
  const seasonIdRaw = request.nextUrl.searchParams.get("seasonId");
  const seasonId = seasonIdRaw ? Number(seasonIdRaw) : undefined;

  try {
    const overview = await fetchWyscoutTeamOverview({
      wyId,
      teamName,
      matchDate,
      matchWyId: Number.isFinite(matchWyId) && matchWyId! > 0 ? matchWyId : undefined,
      seasonId: Number.isFinite(seasonId) && seasonId! > 0 ? seasonId : undefined,
    });
    return NextResponse.json(overview);
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
