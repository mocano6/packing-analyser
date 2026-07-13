/**
 * Kandydaci na kartę docelową przy ręcznym scalaniu z głównej tabeli listy zawodników.
 */

export type ListaMergeCandidatePlayer = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  number?: number | string | null;
  globalDataTotal: number;
  isDeleted?: boolean;
};

function normalizeNameToken(token: string): string {
  if (!token) return "";
  return token
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s]/g, "");
}

/** Imię i nazwisko z dokumentu (bez maskowania trybu prezentacji). */
export function rawFirstLastFromPlayer(p: ListaMergeCandidatePlayer): { first: string; last: string } {
  const fn = (p.firstName ?? "").trim();
  const ln = (p.lastName ?? "").trim();
  if (fn || ln) {
    return { first: fn, last: ln };
  }
  const raw = (p.name ?? "").trim();
  if (!raw) return { first: "", last: "" };
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: "", last: "" };
  if (words.length === 1) return { first: "", last: words[0] };
  return { first: words.slice(0, -1).join(" "), last: words[words.length - 1] };
}

function playerMatchesSearchTerm(
  p: ListaMergeCandidatePlayer,
  searchTerm: string,
  labelForPlayer: (id: string) => string,
): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;
  const label = labelForPlayer(p.id).toLowerCase();
  const num = (p.number?.toString() ?? "").toLowerCase();
  return label.includes(term) || num.includes(term) || p.id.toLowerCase().includes(term);
}

export type BuildMainTableMergeTargetCandidatesOptions = {
  maxWithSearch?: number;
  maxSameLastName?: number;
  maxFallback?: number;
};

const DEFAULT_OPTS: Required<BuildMainTableMergeTargetCandidatesOptions> = {
  maxWithSearch: 100,
  maxSameLastName: 50,
  maxFallback: 40,
};

/**
 * Zwraca aktywnych kandydatów (bez źródła), posortowanych malejąco wg globalDataTotal.
 * Gdy searchTerm niepusty — filtr po etykiecie/numerze/ID.
 * Gdy pusty — najpierw ta sama nazwisko co źródło, inaczej top N wg powiązań.
 */
export function buildMainTableMergeTargetCandidates(
  source: ListaMergeCandidatePlayer,
  all: ListaMergeCandidatePlayer[],
  searchTerm: string,
  labelForPlayer: (id: string) => string,
  options?: BuildMainTableMergeTargetCandidatesOptions,
): ListaMergeCandidatePlayer[] {
  const opts = { ...DEFAULT_OPTS, ...options };
  const active = all.filter((p) => !p.isDeleted && p.id !== source.id);
  const byTotalDesc = (a: ListaMergeCandidatePlayer, b: ListaMergeCandidatePlayer) => {
    if (a.globalDataTotal !== b.globalDataTotal) {
      return b.globalDataTotal - a.globalDataTotal;
    }
    return a.id.localeCompare(b.id);
  };

  const term = searchTerm.trim();
  if (term) {
    return active
      .filter((p) => playerMatchesSearchTerm(p, term, labelForPlayer))
      .sort(byTotalDesc)
      .slice(0, opts.maxWithSearch);
  }

  const sourceLast = normalizeNameToken(rawFirstLastFromPlayer(source).last);
  if (sourceLast) {
    const sameLast = active.filter((p) => {
      const last = normalizeNameToken(rawFirstLastFromPlayer(p).last);
      return last === sourceLast;
    });
    if (sameLast.length > 0) {
      return sameLast.sort(byTotalDesc).slice(0, opts.maxSameLastName);
    }
  }

  return active.sort(byTotalDesc).slice(0, opts.maxFallback);
}

export function describeMainTableMergeCandidateScope(
  searchTerm: string,
  candidateCount: number,
  options?: BuildMainTableMergeTargetCandidatesOptions,
): string {
  const opts = { ...DEFAULT_OPTS, ...options };
  const term = searchTerm.trim();
  if (term) {
    return `Wyniki wyszukiwania „${term}” (max ${opts.maxWithSearch} kart).`;
  }
  if (candidateCount <= opts.maxFallback) {
    return "Ta sama nazwisko co źródło lub lista najbogatszych kart (bez wyszukiwania).";
  }
  return `Pokazano ${candidateCount} kart — wpisz w wyszukiwarce nazwisko lub ID, aby zawęzić listę.`;
}
