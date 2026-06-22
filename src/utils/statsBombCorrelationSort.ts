export type CorrelationSectionKind = "positive" | "negative";

/** Kierunek sortowania wartości r w kolumnie (zawsze zgodny ze strzałką w UI). */
export type CorrelationListSort = "ascending" | "descending";

/** Domyślny widok: najsilniejsze |r| na górze (dla ujemnych = rosnąco po r). */
export function defaultCorrelationListSort(section: CorrelationSectionKind): CorrelationListSort {
  return section === "positive" ? "descending" : "ascending";
}

export function sortCorrelationListRows<T extends { r: number }>(
  rows: T[],
  sort: CorrelationListSort,
): T[] {
  return [...rows].sort((a, b) => (sort === "ascending" ? a.r - b.r : b.r - a.r));
}

export function correlationListSortLabel(sort: CorrelationListSort): string {
  return sort === "descending"
    ? "Od największych r do najmniejszych"
    : "Od najmniejszych r do największych";
}

export function toggleCorrelationListSort(sort: CorrelationListSort): CorrelationListSort {
  return sort === "ascending" ? "descending" : "ascending";
}
