import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { wyscoutErrorResponse } from "@/lib/wyscout/apiHandler";
import { searchWyscoutObjects } from "@/lib/wyscout/service";
import type { WyscoutSearchObjType } from "@/types/wyscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OBJ_TYPES: WyscoutSearchObjType[] = ["competition", "team", "player", "referee"];

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ error: "Podaj co najmniej 2 znaki wyszukiwania." }, { status: 400 });
  }

  const rawType = request.nextUrl.searchParams.get("objType") ?? "team";
  const objType = OBJ_TYPES.includes(rawType as WyscoutSearchObjType)
    ? (rawType as WyscoutSearchObjType)
    : "team";
  const gender = request.nextUrl.searchParams.get("gender")?.trim() || undefined;

  try {
    const results = await searchWyscoutObjects(query, objType, gender);
    return NextResponse.json({ results });
  } catch (error) {
    return wyscoutErrorResponse(error);
  }
}
