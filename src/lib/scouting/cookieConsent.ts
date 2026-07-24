// Automatyczne zamykanie banera Usercentrics na laczynaspilka.pl (TYLKO SERWER).

import type { Page } from 'playwright';
import type { ScoutingDebugLogger } from './debugLog';

export const USERCENTRICS_ROOT_SELECTOR = '#usercentrics-root';

/** Selektory przycisku akceptacji (Usercentrics v2, shadow DOM). */
export const USERCENTRICS_ACCEPT_SELECTORS = [
  '[data-testid="uc-accept-all-button"]',
  'button[data-testid="uc-accept-all-button"]',
] as const;

/** Selektory przycisku odrzucenia — fallback gdy akceptacja niedostępna. */
export const USERCENTRICS_DENY_SELECTORS = [
  '[data-testid="uc-deny-all-button"]',
  'button[data-testid="uc-deny-all-button"]',
] as const;

const CONSENT_WAIT_MS = 4500;

const clickFirstVisible = async (page: Page, selectors: readonly string[]): Promise<boolean> => {
  for (const sel of selectors) {
    const btn = page.locator(`>>> ${sel}`).first();
    const visible = await btn.isVisible({ timeout: 1200 }).catch(() => false);
    if (!visible) continue;
    await btn.click({ timeout: 3000 }).catch(() => undefined);
    return true;
  }
  return false;
};

/**
 * Zamyka baner cookies Usercentrics, jeśli jest widoczny.
 * Preferuje „Zaakceptuj wszystkie” — pełna zgoda często odblokowuje skrypty analityczne/reCAPTCHA.
 */
export async function dismissCookieConsent(
  page: Page,
  debug?: ScoutingDebugLogger | null,
  opts?: { logWhenAbsent?: boolean }
): Promise<boolean> {
  try {
    const host = page.locator(USERCENTRICS_ROOT_SELECTOR);
    const attached = await host
      .waitFor({ state: 'attached', timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    if (!attached) {
      if (opts?.logWhenAbsent) {
        debug?.info('browser', 'Baner cookies niewidoczny (zgoda zapisana w profilu Chrome?)');
      }
      return false;
    }

    let clicked =
      (await clickFirstVisible(page, USERCENTRICS_ACCEPT_SELECTORS)) ||
      (await page
        .getByRole('button', { name: /Zaakceptuj wszystkie/i })
        .click({ timeout: 2000 })
        .then(() => true)
        .catch(() => false));

    if (!clicked) {
      clicked =
        (await clickFirstVisible(page, USERCENTRICS_DENY_SELECTORS)) ||
        (await page
          .getByRole('button', { name: /Odrzuć wszystkie/i })
          .click({ timeout: 2000 })
          .then(() => true)
          .catch(() => false));
    }

    if (!clicked) return false;

    await host.waitFor({ state: 'hidden', timeout: CONSENT_WAIT_MS }).catch(() => undefined);
    debug?.ok('browser', 'Zamknięto baner cookies (Usercentrics)');
    return true;
  } catch {
    return false;
  }
}
