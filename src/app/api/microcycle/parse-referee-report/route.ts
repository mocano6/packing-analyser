import { NextRequest, NextResponse } from "next/server";
import { extractPdfTextItems, MAX_PDF_BYTES } from "@/lib/extractPdfTextItems";
import { parseRefereeReport } from "@/utils/refereeReportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = MAX_PDF_BYTES;

/** Parsuje sprawozdanie sędziego (PDF ZPN) do składów i minut. */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Wyślij plik PDF jako multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dodaj plik PDF sprawozdania sędziego." }, { status: 400 });
  }

  const name = file.name || "sprawozdanie.pdf";
  const type = file.type || "";
  if (!/\.pdf$/i.test(name) && type !== "application/pdf") {
    return NextResponse.json({ error: "Akceptujemy tylko pliki PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik PDF jest za duży (max 8 MB)." }, { status: 400 });
  }

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const items = await extractPdfTextItems(buf);
    const report = parseRefereeReport(items);
    const hostPlayed = report.host.players.filter((p) => p.minutesPlayed > 0).length;
    const guestPlayed = report.guest.players.filter((p) => p.minutesPlayed > 0).length;
    if (hostPlayed < 8 && guestPlayed < 8) {
      return NextResponse.json(
        { error: "Nie udało się odczytać składów ze sprawozdania. Sprawdź, czy to PDF z ZPN." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Błąd odczytu PDF.";
    console.error("[microcycle/parse-referee-report]", e);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
