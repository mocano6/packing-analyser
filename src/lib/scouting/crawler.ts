// Crawler API rozgrywek laczynaspilka.pl (TYLKO SERWER).
//
// Prosta ścieżka (domyślna):
//  1) sync sam otwiera zwykły Chrome (nie Playwright) z profilem .scouting-profile,
//  2) podłącza się przez CDP i przechwytuje token reCAPTCHA z /rozgrywki,
//  3) KAŻDA paczka żądań dostaje ŚWIEŻY token i od razu go zużywa (Bearer ~2 s),
//  4) małe bursty + pauza między paczkami; przy 403 raz auto-reset .scouting-profile.
//
// Antywzorzec (powodował 401→403): reuse jednego tokenu na wiele chunków
// albo reload + cookies między mint a fetch (3+ s opóźnienia).
//
// Opcjonalnie: SCOUTING_CDP_URL=http://127.0.0.1:9333 — awaryjny zewnętrzny Chrome.

import path from 'path';
import fs from 'fs';
import { execSync, spawn, type ChildProcess } from 'child_process';
import http from 'http';
import type { Browser, BrowserContext, Page } from 'playwright';
import { ScoutingDebugLogger } from './debugLog';
import { dismissCookieConsent } from './cookieConsent';
import {
  isBearerStillFresh,
  TOKEN_MAX_AGE_MS,
  DEFAULT_BURST_SIZE,
} from './syncLimits';

const API_BASE = 'https://competition-api-pro.laczynaspilka.pl/api/bus/competition/v1/';
const ROZGRYWKI_URL = 'https://www.laczynaspilka.pl/rozgrywki';
const PROFILE_DIR = path.join(process.cwd(), '.scouting-profile');
const SITE_ORIGIN = 'https://www.laczynaspilka.pl';
const DEFAULT_CDP_PORT = 9333;

/** Ile czekamy na token po załadowaniu strony (reCAPTCHA bywa opóźniona). */
const TOKEN_WAIT_MS = 12000;
/** Krótki poll przy soft-mint — po 403/404 nie ma sensu czekać 12 s. */
const SOFT_MINT_WAIT_MS = 5000;
/** Ile razy przeładować /rozgrywki w poszukiwaniu tokenu (bez 403/404). */
const MAX_TOKEN_RELOADS = 1;
/**
 * Po tylu odmowach Authorize/recaptcha (403) uznajemy sesję za spaloną.
 * 1 = fail-fast: dalsze reloady tylko pogarszają reputację i kończą na /404.
 */
const MAX_AUTH_403 = 1;
/** Pauza między paczkami (nie palić reCAPTCHA zbyt częstymi remintami). */
const BETWEEN_BURSTS_MS = 1100;
/** Ile razy w jednej sesji sync wolno automatycznie zresetować .scouting-profile. */
const MAX_AUTO_PROFILE_RESETS = 1;

export { TOKEN_MAX_AGE_MS, DEFAULT_BURST_SIZE };

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome',
  'chromium',
  'chromium-browser',
];

/** Czy aktualny URL to wewnętrzna strona 404 SPA (nie HTTP 404). */
const isSpa404Url = (url: string): boolean => /\/rozgrywki\/404(?:\?|#|$)/.test(url);

const findChromeBinary = (): string | null => {
  for (const c of CHROME_CANDIDATES) {
    if (c.startsWith('/') && fs.existsSync(c)) return c;
    try {
      execSync(`command -v ${c}`, { stdio: 'ignore' });
      return c;
    } catch {
      /* next */
    }
  }
  return null;
};

/** Zamyka wiszące procesy Chrome tylko gdy profil jest zablokowany (SingletonLock). */
const prepareProfile = (): void => {
  const lock = path.join(PROFILE_DIR, 'SingletonLock');
  if (!fs.existsSync(lock)) return;
  try {
    execSync('pkill -f "user-data-dir=.*scouting-profile" 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(lock);
  } catch {
    /* ignore */
  }
};

const waitForCdp = (port: number, timeoutMs = 20000): Promise<void> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tryOnce = (): void => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };
    const retry = (): void => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Chrome CDP nie wystartował na porcie ${port} w ${timeoutMs} ms`));
        return;
      }
      setTimeout(tryOnce, 400);
    };
    tryOnce();
  });

/** Komunikat gdy reCAPTCHA/API odrzuca automatyzację (po nieudanym auto-resetcie). */
export const SCOUTING_AUTH_HELP =
  'API odrzuciło reCAPTCHA (403) / strona na /404 — auto-reset profilu Chrome też nie pomógł. ' +
  'Poczekaj 1–2 minuty i kliknij Sync ponownie. W ostateczności: rm -rf .scouting-profile && npm run scouting:warmup.';

export interface BurstResult<T = unknown> {
  status: number;
  data: T | null;
  error?: string;
}

export interface CrawlerOptions {
  /** false = widoczne okno (wymagane dla reCAPTCHA). Domyślnie z env SCOUTING_HEADLESS. */
  headless?: boolean;
  /** maks. liczba równoległych żądań na jeden token */
  burstSize?: number;
  debugLog?: ScoutingDebugLogger;
  /** Główny URL rozgrywek do mintowania tokenu (domyślnie goły /rozgrywki). */
  initialRozgrywkiUrl?: string;
  /** Zapasowe URL kotwicy (zwykle tylko /rozgrywki). */
  initialRozgrywkiUrlCandidates?: string[];
}

export class LaczyCrawler {
  private ctx: BrowserContext | null = null;
  private cdpBrowser: Browser | null = null;
  private page: Page | null = null;
  private bearer: string | null = null;
  private rozgrywkiUrl = ROZGRYWKI_URL;
  private rozgrywkiUrlCandidates: string[] = [ROZGRYWKI_URL];
  private cdpMode = false;
  /** Czy to my uruchomiliśmy Chrome (wtedy zamykamy go w close()). */
  private ownsChromeProcess = false;
  private chromeProcess: ChildProcess | null = null;
  private auth403Count = 0;
  /** Sesja auth spalona (403 Authorize lub SPA /404) — zero dalszych remintów (aż do auto-reset). */
  private authDead = false;
  private authDeadLogged = false;
  private lastAuthDeadDetail: string | undefined;
  /** Ile razy zresetowaliśmy profil w tej sesji crawlera. */
  private profileResets = 0;
  /** Timestamp przechwycenia bieżącego bearer (ms). */
  private tokenAt = 0;
  private listenedPages = new WeakSet<Page>();
  private consentAbsentLogged = false;
  private consentDone = false;
  private readonly headless: boolean;
  private readonly burstSize: number;
  private readonly debug: ScoutingDebugLogger | null;

  constructor(opts: CrawlerOptions = {}) {
    this.headless = opts.headless ?? process.env.SCOUTING_HEADLESS === 'true';
    this.burstSize = opts.burstSize ?? DEFAULT_BURST_SIZE;
    this.debug = opts.debugLog ?? null;
    if (opts.initialRozgrywkiUrlCandidates?.length) {
      this.setRozgrywkiUrlCandidates(opts.initialRozgrywkiUrlCandidates);
    } else if (opts.initialRozgrywkiUrl) {
      this.setRozgrywkiUrl(opts.initialRozgrywkiUrl);
    }
  }

  getDebugLog(): ScoutingDebugLogger | null {
    return this.debug;
  }

  setRozgrywkiUrl(url: string): void {
    if (url.startsWith(`${SITE_ORIGIN}/rozgrywki`)) {
      this.rozgrywkiUrl = url;
      this.rozgrywkiUrlCandidates = [url, ...this.rozgrywkiUrlCandidates.filter((u) => u !== url)];
    }
  }

  setRozgrywkiUrlCandidates(urls: string[]): void {
    const valid = urls.filter((u) => u.startsWith(`${SITE_ORIGIN}/rozgrywki`));
    if (!valid.length) return;
    this.rozgrywkiUrlCandidates = valid;
    this.rozgrywkiUrl = valid[0];
  }

  async open(): Promise<void> {
    const cdpUrl = process.env.SCOUTING_CDP_URL?.trim();
    if (!cdpUrl) {
      if (process.env.SCOUTING_RESET_PROFILE === '1') {
        prepareProfile();
        fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
      } else {
        prepareProfile();
      }
    }
    await this.launchContext();
    await this.navigate();
  }

  /** Podłącza Playwright do już działającego Chrome przez CDP. */
  private async attachToCdp(cdpUrl: string, label: string): Promise<void> {
    const { chromium } = await import('playwright');
    const browser = await chromium.connectOverCDP(cdpUrl, { noDefaults: true });
    this.cdpBrowser = browser;
    this.cdpMode = true;
    const contexts = browser.contexts();
    if (!contexts.length) {
      throw new Error('CDP: brak kontekstu Chrome.');
    }
    this.ctx = contexts[0];
    const pages = this.ctx.pages();
    for (const p of pages) this.attachTokenListener(p);
    this.page =
      pages.find((p) => /laczynaspilka\.pl\/rozgrywki/i.test(p.url()) && !isSpa404Url(p.url())) ||
      pages.find((p) => /laczynaspilka\.pl/i.test(p.url())) ||
      pages[0] ||
      (await this.ctx.newPage());
    this.attachTokenListener(this.page);
    this.page.setDefaultNavigationTimeout(90000);
    this.debug?.ok('browser', label, { detail: cdpUrl });
  }

  /**
   * Domyślna ścieżka: odpal natywny Chrome (bez fingerprintu Playwright)
   * i podepnij się przez lokalny CDP — okno otwiera się samo.
   */
  private async launchNativeChromeOverCdp(): Promise<boolean> {
    if (this.headless) {
      this.debug?.warn('browser', 'SCOUTING_HEADLESS=true — pomijam natywny Chrome, reCAPTCHA prawie na pewno padnie');
      return false;
    }
    const binary = findChromeBinary();
    if (!binary) {
      this.debug?.warn('browser', 'Brak systemowego Chrome — fallback Playwright');
      return false;
    }

    const port = Number(process.env.SCOUTING_CDP_PORT || DEFAULT_CDP_PORT);
    const cdpUrl = `http://127.0.0.1:${port}`;
    fs.mkdirSync(PROFILE_DIR, { recursive: true });

    // Jeśli ktoś już trzyma CDP na tym porcie z naszym profilem — użyj go.
    try {
      await waitForCdp(port, 800);
      await this.attachToCdp(cdpUrl, 'Połączono z już działającym Chrome (CDP)');
      this.ownsChromeProcess = false;
      return true;
    } catch {
      /* startujemy własny */
    }

    prepareProfile();
    const child = spawn(
      binary,
      [
        `--remote-debugging-port=${port}`,
        '--remote-allow-origins=*',
        `--user-data-dir=${PROFILE_DIR}`,
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        this.rozgrywkiUrl || ROZGRYWKI_URL,
      ],
      { stdio: 'ignore', detached: true }
    );
    child.unref();
    this.chromeProcess = child;
    this.ownsChromeProcess = true;

    try {
      await waitForCdp(port, 25000);
      await this.attachToCdp(cdpUrl, 'Uruchomiono Chrome (natywny, auto-CDP)');
      return true;
    } catch (err) {
      this.debug?.warn('browser', 'Natywny Chrome CDP nie wystartował', {
        detail: err instanceof Error ? err.message : String(err),
      });
      this.killOwnedChrome();
      return false;
    }
  }

  private killOwnedChrome(): void {
    if (!this.ownsChromeProcess) return;
    try {
      if (this.chromeProcess?.pid) {
        process.kill(-this.chromeProcess.pid, 'SIGTERM');
      }
    } catch {
      /* ignore */
    }
    try {
      execSync('pkill -f "user-data-dir=.*scouting-profile" 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
    this.chromeProcess = null;
    this.ownsChromeProcess = false;
  }

  private async launchContext(): Promise<void> {
    const { chromium } = await import('playwright');
    const externalCdp = process.env.SCOUTING_CDP_URL?.trim();

    // 0) Zewnętrzny CDP (opcjonalny, awaryjny).
    if (externalCdp) {
      await this.attachToCdp(externalCdp, 'Połączono z Chrome przez CDP (zewnętrzny)');
      this.ownsChromeProcess = false;
      return;
    }

    // 1) Preferuj natywny Chrome + auto-CDP (prosty sync, lepszy score reCAPTCHA).
    if (await this.launchNativeChromeOverCdp()) return;

    // 2) Fallback: Playwright persistent context (gorzej działa z reCAPTCHA).
    const launchOpts = {
      headless: this.headless,
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
      viewport: { width: 1366, height: 900 },
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--disable-blink-features=AutomationControlled', '--disable-infobars'] as string[],
    };

    const tryLaunch = (withChromeChannel: boolean): Promise<BrowserContext> =>
      withChromeChannel
        ? chromium.launchPersistentContext(PROFILE_DIR, { ...launchOpts, channel: 'chrome' })
        : chromium.launchPersistentContext(PROFILE_DIR, launchOpts);

    let lastError: Error | null = null;
    try {
      this.ctx = await tryLaunch(true);
      this.debug?.warn('browser', 'Fallback: Playwright Chrome (channel) — reCAPTCHA może odrzucić');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        lastError.message.includes('existing browser session') ||
        lastError.message.includes('SingletonLock') ||
        lastError.message.includes('profile is already in use')
      ) {
        prepareProfile();
        await new Promise((r) => setTimeout(r, 1500));
        try {
          this.ctx = await tryLaunch(true);
          lastError = null;
        } catch (retryErr) {
          lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        }
      }
    }

    if (!this.ctx) {
      try {
        this.ctx = await tryLaunch(false);
        this.debug?.warn('browser', 'Fallback: Chromium z Playwright');
      } catch (chromiumErr) {
        const detail = chromiumErr instanceof Error ? chromiumErr.message : String(chromiumErr);
        this.debug?.error('browser', 'Nie udało się uruchomić przeglądarki', { detail });
        throw new Error(
          `Nie udało się uruchomić przeglądarki scoutingu. ${lastError?.message || detail}`
        );
      }
    }

    await this.ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = { runtime: {} };
    });

    this.page = await this.ctx.newPage();
    for (const p of this.ctx.pages()) {
      if (p !== this.page) await p.close().catch(() => undefined);
    }
    this.page.setDefaultNavigationTimeout(90000);
    this.attachTokenListener(this.page);
  }

  private attachTokenListener(page: Page): void {
    if (this.listenedPages.has(page)) return;
    this.listenedPages.add(page);
    page.on('response', async (res) => {
      try {
        if (!res.url().includes('Authorize/recaptcha')) return;
        if (res.status() === 403) {
          this.auth403Count++;
          this.debug?.warn('token', `reCAPTCHA odrzucona (403) [${this.auth403Count}/${MAX_AUTH_403}]`, {
            detail: page.url(),
          });
          // Fail-fast: jedno 403 Authorize = sesja spalona, nie reloaduj w kółko.
          this.markAuthDead(page.url());
          return;
        }
        if (res.status() !== 200) return;
        const body = (await res.text()).replace(/^"|"$/g, '');
        if (body && body.split('.').length === 3) {
          this.bearer = body;
          this.tokenAt = Date.now();
          this.auth403Count = 0;
          this.debug?.ok('token', 'Przechwycono token reCAPTCHA', { detail: `JWT ${body.slice(0, 24)}…` });
        }
      } catch {
        /* ignore */
      }
    });
  }

  private markAuthDead(detail?: string): void {
    this.authDead = true;
    this.lastAuthDeadDetail = detail || this.page?.url() || this.lastAuthDeadDetail;
    // HELP logujemy dopiero gdy auto-reset się nie uda (finalizeAuthDead).
  }

  private finalizeAuthDead(): void {
    this.authDead = true;
    if (this.authDeadLogged) return;
    this.authDeadLogged = true;
    this.debug?.error('token', SCOUTING_AUTH_HELP, {
      detail: this.lastAuthDeadDetail || this.page?.url() || undefined,
    });
  }

  /** Czy dalsze mintowanie tokenu jest bezcelowe (403 /404), dopóki nie zresetujemy profilu. */
  isAuthDead(): boolean {
    return this.authDead || this.auth403Count >= MAX_AUTH_403;
  }

  /**
   * Automatyczny odpowiednik: rm -rf .scouting-profile && warmup.
   * Zamyka Chrome, czyści profil, odpala świeżą sesję z cookies.
   * Max 1× na sesję sync — żeby nie kręcić się w nieskończoność przy blokadzie IP.
   */
  private async tryAutoResetProfile(): Promise<boolean> {
    if (this.profileResets >= MAX_AUTO_PROFILE_RESETS) return false;
    // Zewnętrzny CDP użytkownika — nie kasujemy mu profilu w tle.
    if (process.env.SCOUTING_CDP_URL?.trim()) return false;

    this.profileResets++;
    this.debug?.warn(
      'browser',
      `Auto-reset profilu Chrome (#${this.profileResets}/${MAX_AUTO_PROFILE_RESETS}) — jak scouting:warmup`
    );

    this.authDead = false;
    this.authDeadLogged = false;
    this.auth403Count = 0;
    this.consentDone = false;
    this.consentAbsentLogged = false;
    this.clearToken();

    try {
      await this.close();
    } catch {
      /* ignore */
    }

    try {
      execSync('pkill -f "user-data-dir=.*scouting-profile" 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
    prepareProfile();
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    await new Promise((r) => setTimeout(r, 2000));

    try {
      await this.launchContext();
      await this.navigate();
    } catch (err) {
      this.debug?.error('browser', 'Auto-reset: nie udało się uruchomić Chrome', {
        detail: err instanceof Error ? err.message : String(err),
      });
      this.finalizeAuthDead();
      return false;
    }

    if (this.isAuthDead()) {
      this.finalizeAuthDead();
      return false;
    }

    this.debug?.ok('browser', 'Profil odświeżony — kontynuuję sync');
    return true;
  }

  private clearToken(): void {
    this.bearer = null;
    this.tokenAt = 0;
  }

  /** Token jest świeży tylko przez TOKEN_MAX_AGE_MS (~1 s z buforem przed wygaśnięciem ~2 s). */
  private hasFreshToken(): boolean {
    return !!this.bearer && isBearerStillFresh(this.tokenAt, Date.now(), TOKEN_MAX_AGE_MS);
  }

  private async safeWait(ms: number): Promise<void> {
    if (!this.page) throw new Error('Crawler nie został otwarty');
    try {
      await this.page.waitForTimeout(ms);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('crashed') || msg.includes('closed') || msg.includes('Target')) {
        throw new Error(
          'Przeglądarka scoutingu uległa awarii (Chrome crash). Uruchom sync ponownie — zapisane mecze pozostaną w bazie.'
        );
      }
      throw err;
    }
  }

  private async dismissConsentIfPresent(): Promise<void> {
    if (!this.page || this.consentDone) return;
    const dismissed = await dismissCookieConsent(this.page, this.debug, {
      logWhenAbsent: !this.consentAbsentLogged,
    });
    this.consentAbsentLogged = true;
    this.consentDone = true;
    if (dismissed) this.clearToken();
  }

  private async waitForToken(maxMs: number): Promise<void> {
    for (let t = 0; t < maxMs && !this.bearer; t += 100) {
      if (this.isAuthDead()) return;
      if (this.page && isSpa404Url(this.page.url())) {
        this.markAuthDead(this.page.url());
        return;
      }
      await this.safeWait(100);
    }
  }

  /**
   * Szybkie mintowanie: reload bez cookies.
   * Po 403 lub SPA /404 — natychmiast authDead, bez kolejnych prób.
   */
  private async softMintToken(): Promise<string | null> {
    if (!this.page) throw new Error('Crawler nie został otwarty');
    if (this.isAuthDead()) return null;

    this.clearToken();

    if (isSpa404Url(this.page.url())) {
      // Jedna szansa: wróć na goły /rozgrywki zamiast reloadować /404.
      await this.page.goto(ROZGRYWKI_URL, { waitUntil: 'commit', timeout: 90000 }).catch(() => undefined);
    } else if (/laczynaspilka\.pl\/rozgrywki/i.test(this.page.url())) {
      await this.page.reload({ waitUntil: 'commit', timeout: 90000 }).catch(() => undefined);
    } else {
      await this.page
        .goto(this.rozgrywkiUrl || ROZGRYWKI_URL, { waitUntil: 'commit', timeout: 90000 })
        .catch(() => undefined);
    }

    await this.waitForToken(SOFT_MINT_WAIT_MS);

    if (this.bearer) return this.bearer;
    if (isSpa404Url(this.page.url())) {
      this.markAuthDead(this.page.url());
    }
    return null;
  }

  /** Pierwsze wejście na /rozgrywki — tu wolno zamknąć cookies. */
  private async loadRozgrywkiUrl(url: string): Promise<boolean> {
    if (!this.page) throw new Error('Crawler nie został otwarty');
    if (this.isAuthDead()) return false;
    this.clearToken();
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => undefined);
    await this.dismissConsentIfPresent();
    if (!this.bearer) await this.waitForToken(TOKEN_WAIT_MS);
    if (isSpa404Url(this.page.url())) {
      this.markAuthDead(this.page.url());
      return false;
    }
    return this.bearer != null || !isSpa404Url(this.page.url());
  }

  private async navigate(): Promise<void> {
    if (!this.page) throw new Error('Crawler nie został otwarty');

    if (
      this.cdpMode &&
      /laczynaspilka\.pl\/rozgrywki/i.test(this.page.url()) &&
      !isSpa404Url(this.page.url())
    ) {
      this.debug?.info('navigate', 'Używam otwartej karty Rozgrywki', { detail: this.page.url() });
      await this.dismissConsentIfPresent();
      this.rozgrywkiUrl = this.page.url();
      return;
    }

    for (const url of this.rozgrywkiUrlCandidates) {
      if (this.isAuthDead()) break;
      if (await this.loadRozgrywkiUrl(url)) {
        this.rozgrywkiUrl = url;
        this.debug?.info('navigate', 'Załadowano stronę', { detail: this.page.url() });
        this.clearToken();
        return;
      }
      this.debug?.info('navigate', 'URL → /404, próbuję następny…', { detail: this.page.url() });
    }
  }

  /**
   * Token gotowy do natychmiastowego użycia.
   * Po authDead: raz próbuje auto-reset profilu (wbudowany warmup), potem poddaje się.
   */
  private async getFreshToken(forceMint = false): Promise<string | null> {
    if (!this.page && !this.isAuthDead()) throw new Error('Crawler nie został otwarty');

    if (this.isAuthDead()) {
      if (!(await this.tryAutoResetProfile())) {
        this.finalizeAuthDead();
        return null;
      }
    }
    if (!this.page) throw new Error('Crawler nie został otwarty');
    if (!forceMint && this.hasFreshToken()) return this.bearer;

    for (let attempt = 0; attempt <= MAX_TOKEN_RELOADS; attempt++) {
      if (this.isAuthDead()) break;
      if (attempt > 0) {
        this.debug?.info('token', `Próba tokenu #${attempt + 1}/${MAX_TOKEN_RELOADS + 1}`);
      }
      const token = await this.softMintToken();
      if (token) return token;
      if (this.isAuthDead()) break;
    }

    if (this.isAuthDead()) {
      if (await this.tryAutoResetProfile()) {
        const token = await this.softMintToken();
        if (token) return token;
      }
      this.finalizeAuthDead();
      return null;
    }

    if (!this.authDeadLogged) {
      this.debug?.error('token', 'Brak tokenu po wszystkich próbach', { detail: this.page.url() });
    }
    return null;
  }

  private async fireBurst<T>(token: string, endpoints: string[]): Promise<BurstResult<T>[]> {
    if (!this.page) throw new Error('Crawler nie został otwarty');
    this.clearToken();
    const raw = await this.page.evaluate(
      async ({ api, tk, eps }) => {
        return await Promise.all(
          eps.map(async (e: string) => {
            try {
              const r = await fetch(api + e, { headers: { Authorization: 'Bearer ' + tk } });
              const txt = await r.text();
              let data: unknown = null;
              try {
                data = txt ? JSON.parse(txt) : null;
              } catch {
                data = null;
              }
              return { status: r.status, data };
            } catch (err) {
              return { status: -1, data: null, error: String(err) };
            }
          })
        );
      },
      { api: API_BASE, tk: token, eps: endpoints }
    );
    return raw as BurstResult<T>[];
  }

  private tokenErrorMessage(): string {
    return this.isAuthDead() ? SCOUTING_AUTH_HELP : 'Nie udało się uzyskać tokenu (reCAPTCHA)';
  }

  private async burstOnce<T = unknown>(endpoints: string[], allowAuthRetry = true): Promise<BurstResult<T>[]> {
    // Nie short-circuituj na authDead — getFreshToken może raz zresetować .scouting-profile.
    const token = await this.getFreshToken(true);
    if (!token) {
      const err = this.tokenErrorMessage();
      endpoints.forEach((ep) => this.debug?.logApi(ep, 0, null, err));
      return endpoints.map(() => ({ status: 0, data: null, error: err }));
    }

    let results = await this.fireBurst<T>(token, endpoints);
    const authFailed = results.some((r) => r?.status === 401 || r?.status === 403);

    if (allowAuthRetry && authFailed && !this.isAuthDead()) {
      this.debug?.warn('token', '401/403 w paczce — szybki remint i retry');
      const retryToken = await this.getFreshToken(true);
      if (retryToken) {
        results = await this.fireBurst<T>(retryToken, endpoints);
      }
    }

    endpoints.forEach((ep, i) => {
      const r = results[i];
      this.debug?.logApi(ep, r?.status ?? -1, r?.data ?? null, r?.error);
    });
    return results;
  }

  async fetchMany<T = unknown>(endpoints: string[]): Promise<BurstResult<T>[]> {
    const results: BurstResult<T>[] = new Array(endpoints.length);
    const indices = endpoints.map((_, i) => i);

    const fillAuthErrors = (idxs: number[]): void => {
      const err = this.tokenErrorMessage();
      idxs.forEach((idx) => {
        if (!results[idx]) results[idx] = { status: 0, data: null, error: err };
      });
    };

    const runPass = async (idxs: number[]): Promise<number[]> => {
      const failed: number[] = [];
      for (let i = 0; i < idxs.length; i += this.burstSize) {
        const chunkIdx = idxs.slice(i, i + this.burstSize);
        const chunkEps = chunkIdx.map((idx) => endpoints[idx]);
        const res = await this.burstOnce<T>(chunkEps);
        // Po nieudanym auto-resetcie nie ma sensu młócić pozostałych paczek.
        const authExhausted = res.every((r) => r?.status === 0 && /reCAPTCHA|403|404/i.test(r?.error || ''));
        chunkIdx.forEach((idx, j) => {
          results[idx] = res[j] ?? { status: 0, data: null, error: this.tokenErrorMessage() };
          if (!results[idx] || results[idx].status !== 200) failed.push(idx);
        });
        if (authExhausted && this.isAuthDead()) {
          fillAuthErrors(idxs.slice(i + this.burstSize));
          idxs.slice(i + this.burstSize).forEach((idx) => failed.push(idx));
          break;
        }
        if (i + this.burstSize < idxs.length && !this.isAuthDead()) {
          await this.safeWait(BETWEEN_BURSTS_MS);
        }
      }
      return failed;
    };

    let pending = indices;
    for (let pass = 0; pass < 2 && pending.length > 0; pass++) {
      // pass>0: ponów nieudane (getFreshToken może zrobić auto-reset profilu).
      if (pass > 0) await this.safeWait(1000);
      pending = await runPass(pending);
    }

    // Gwarancja: żaden slot nie zostaje undefined (fetchOne czyta results[0]).
    fillAuthErrors(indices);
    return results;
  }

  async fetchOne<T = unknown>(endpoint: string): Promise<BurstResult<T>> {
    const [r] = await this.fetchMany<T>([endpoint]);
    return (
      r ?? {
        status: 0,
        data: null,
        error: this.tokenErrorMessage(),
      }
    );
  }

  async close(): Promise<void> {
    if (this.cdpMode && this.cdpBrowser) {
      try {
        await this.cdpBrowser.close();
      } catch {
        /* ignore */
      }
      this.cdpBrowser = null;
      this.ctx = null;
      this.page = null;
      this.cdpMode = false;
      if (this.ownsChromeProcess) this.killOwnedChrome();
      return;
    }
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.page = null;
    }
    this.cdpMode = false;
  }

  seasonsEndpoint(): string {
    return 'seasons/dictionaries';
  }

  leagueGroupsEndpoint(seasonId: string, sex: string): string {
    return `leagues/seasons/${seasonId}/sexes/${sex}/league-groups`;
  }

  matchesEndpoint(leagueId: string, seasonId: string): string {
    return `leagues/${leagueId}/seasons/${seasonId}/matches`;
  }

  matchEventsEndpoint(matchId: string): string {
    return `matches/${matchId}/events`;
  }

  playerEndpoint(playerId: string): string {
    return `players/${playerId}`;
  }
}
