import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { fetchPolishCompetitions } from "@/lib/wyscout/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;

  const seedRaw = request.nextUrl.searchParams.get("compId");
  const seedCompId = seedRaw ? Number(seedRaw) : undefined;

  try {
    const catalog = await fetchPolishCompetitions(
      Number.isFinite(seedCompId) && seedCompId! > 0 ? seedCompId : undefined,
    );
    return NextResponse.json(catalog);
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
