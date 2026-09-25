import { ROZGRYWKI_HOME_URL } from './rozgrywkiUrl';

const LACZY_ORIGIN = 'https://www.laczynaspilka.pl';

/** Czy aktualny URL to wewnętrzna strona 404 SPA (nie HTTP 404). */
export function isSpa404Url(url: string): boolean {
  return /\/rozgrywki\/404(?:\?|#|$)/.test(url);
}

/** Goła strona /rozgrywki (query OK) — jedyna stabilna kotwica tokenu reCAPTCHA. */
export function isRozgrywkiHomePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== LACZY_ORIGIN) return false;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return path === '/rozgrywki';
  } catch {
    return false;
  }
}

export function isValidRozgrywkiMintUrl(url: string): boolean {
  return url.startsWith(`${LACZY_ORIGIN}/rozgrywki`) && !isSpa404Url(url);
}

/**
 * Token mintujemy z gołego /rozgrywki na początku.
 * Deep-linki (drużyna/mecz/liga) zostają jako zapas — same jako pierwsze powodowały SPA /404
 * i wcześniej spalały sesję zanim crawler zdążył wejść na /rozgrywki.
 */
export function normalizeTokenMintUrlCandidates(urls: string[]): string[] {
  const seen = new Set<string>();
  const rest: string[] = [];
  for (const url of urls) {
    if (!isValidRozgrywkiMintUrl(url)) continue;
    if (isRozgrywkiHomePath(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    rest.push(url);
  }
  return [ROZGRYWKI_HOME_URL, ...rest];
}

/** SPA /404 na jednym kandydacie nie spala sesji, jeśli zostało coś do spróbowania. */
export function shouldMarkAuthDeadOnSpa404(hasRemainingCandidates: boolean): boolean {
  return !hasRemainingCandidates;
}

/**
 * Podłączamy się do już działającego Chrome tylko na zdrowej stronie /rozgrywki.
 * Karta /404 albo deep-link po nieudanej próbie — restart, nie reuse spalonej sesji.
 */
export function shouldReuseExistingCdpPage(url: string): boolean {
  return isRozgrywkiHomePath(url) && !isSpa404Url(url);
}
