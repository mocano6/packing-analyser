import { NextRequest, NextResponse } from "next/server";
import { requireSignedInApi } from "@/lib/apiRequireSignedIn";
import { getWyscoutConfig } from "@/lib/wyscout/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSignedInApi(request);
  if (!auth.ok) return auth.response;
  const config = getWyscoutConfig();
  return NextResponse.json({ configured: config.configured });
}
