import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextItem } from "@/utils/pdfTextItems";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

type PdfJsTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

function asTextItem(raw: unknown): PdfJsTextItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.str !== "string") return null;
  return rec as PdfJsTextItem;
}

/** Wyciąga tekst ze współrzędnymi (y od góry strony) do parsera sprawozdania. */
export async function extractPdfTextItems(data: Uint8Array): Promise<PdfTextItem[]> {
  if (data.byteLength === 0) {
    throw new Error("Plik PDF jest pusty.");
  }
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new Error("Plik PDF jest za duży (max 8 MB).");
  }

  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableWorker: true,
  });
  const doc = await loadingTask.promise;
  const items: PdfTextItem[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const raw of content.items) {
        const it = asTextItem(raw);
        if (!it) continue;
        const str = String(it.str || "").replace(/\s+/g, " ").trim();
        if (!str) continue;
        const transform = Array.isArray(it.transform) ? it.transform : [];
        const x = Number(transform[4]);
        const yPdf = Number(transform[5]);
        if (!Number.isFinite(x) || !Number.isFinite(yPdf)) continue;
        const height = Number(it.height) || 8;
        const width = Number(it.width) || str.length * 4;
        items.push({
          str,
          x,
          y: viewport.height - yPdf,
          width,
          height,
          page: pageNum,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
        });
      }
    }
  } finally {
    await doc.destroy();
  }
  return items;
}

export { MAX_PDF_BYTES };
