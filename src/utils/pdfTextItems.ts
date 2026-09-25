/** Fragment tekstu z PDF (y rośnie w dół strony). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  pageWidth: number;
  pageHeight: number;
}

export function itemText(item: PdfTextItem): string {
  return String(item.str ?? "").replace(/\s+/g, " ").trim();
}

/**
 * pdf.js tnie słowa na osobne spany. Sklejamy sąsiadów w tej samej linii,
 * zostawiając osobno lewą i prawą kolumnę (duża przerwa w X).
 */
export function mergeAdjacentPdfItems(items: PdfTextItem[], maxGap = 10): PdfTextItem[] {
  if (items.length === 0) return [];
  const sorted = sortItemsTopLeft(items);
  const out: PdfTextItem[] = [];
  for (const item of sorted) {
    const prev = out[out.length - 1];
    if (!prev || prev.page !== item.page) {
      out.push({ ...item });
      continue;
    }
    const yClose = Math.abs(item.y - prev.y) <= 3;
    const gap = item.x - (prev.x + prev.width);
    if (yClose && gap >= -2 && gap <= maxGap) {
      const a = itemText(prev);
      const b = itemText(item);
      const joiner = gap > 1 || (a && b && !/[-–—(]$/.test(a) && !/^[,.)]/.test(b)) ? " " : "";
      const merged = `${a}${joiner}${b}`.replace(/\s+/g, " ").trim();
      const right = Math.max(prev.x + prev.width, item.x + item.width);
      prev.str = merged;
      prev.width = right - prev.x;
      prev.height = Math.max(prev.height, item.height);
      prev.y = Math.min(prev.y, item.y);
      continue;
    }
    out.push({ ...item });
  }
  return out;
}

export function itemsOnPage(items: PdfTextItem[], page: number): PdfTextItem[] {
  return items.filter((i) => i.page === page);
}

export function sortItemsTopLeft(items: PdfTextItem[]): PdfTextItem[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function findItemContaining(
  items: PdfTextItem[],
  re: RegExp
): PdfTextItem | undefined {
  return items.find((i) => re.test(itemText(i)));
}
