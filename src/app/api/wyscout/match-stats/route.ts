import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { fetchWyscoutMatchStats } from "@/lib/wyscout/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;

  const matchWyId = Number(request.nextUrl.searchParams.get("matchWyId"));
  if (!Number.isFinite(matchWyId) || matchWyId <= 0) {
    return NextResponse.json({ error: "Podaj poprawne matchWyId." }, { status: 400 });
  }

  try {
    const matchStats = await fetchWyscoutMatchStats(matchWyId);
    return NextResponse.json({ matchStats });
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
