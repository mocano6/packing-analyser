import { NextResponse } from "next/server";
import { WyscoutClientError } from "@/lib/wyscout/client";

export function wyscoutErrorResponse(error: unknown): NextResponse {
  if (error instanceof WyscoutClientError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Błąd Wyscout.";
  console.error("[wyscout]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
