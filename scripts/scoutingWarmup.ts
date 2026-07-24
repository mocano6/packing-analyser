/**
 * Rozgrzewa profil Chrome scoutingu (.scouting-profile) przed sync.
 * Otwiera zwykły Chrome (bez Playwright) — tak samo jak Sync.
 *
 * Użycie: npm run scouting:warmup
 */
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import http from 'http';
import { ROZGRYWKI_HOME_URL } from '../src/lib/scouting/rozgrywkiUrl';

const PROFILE_DIR = path.join(process.cwd(), '.scouting-profile');
const PORT = Number(process.env.SCOUTING_CDP_PORT || 9333);
const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const isSpa404 = (url: string): boolean => /\/rozgrywki\/404(?:\?|#|$)/.test(url);

const waitEnter = (): Promise<void> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nGdy widzisz Rozgrywki (nie 404), naciśnij Enter… ', () => {
      rl.close();
      resolve();
    });
  });

const waitForCdp = (timeoutMs = 20000): Promise<void> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tryOnce = (): void => {
      const req = http.get(`http://127.0.0.1:${PORT}/json/version`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('CDP timeout'));
        else setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });

const getActiveUrl = async (): Promise<string> => {
  const { chromium } = await import('playwright');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { noDefaults: true });
  try {
    const page = browser.contexts()[0]?.pages()[0];
    return page?.url() || '';
  } finally {
    await browser.close().catch(() => undefined);
  }
};

(async () => {
  if (!fs.existsSync(CHROME)) {
    console.error('Brak Google Chrome w /Applications');
    process.exit(1);
  }

  try {
    execSync('pkill -f "user-data-dir=.*scouting-profile" 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    /* ignore */
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log('Profil:', PROFILE_DIR);
  console.log('URL:   ', ROZGRYWKI_HOME_URL);
  console.log('Otwieram zwykły Chrome (bez Playwright)…\n');

  const child = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${PROFILE_DIR}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      ROZGRYWKI_HOME_URL,
    ],
    { stdio: 'ignore', detached: true }
  );
  child.unref();

  await waitForCdp();
  await new Promise((r) => setTimeout(r, 4000));

  let url = await getActiveUrl().catch(() => '');
  if (isSpa404(url)) {
    console.log('⚠ Na razie /404 — w otwartym Chrome:');
    console.log('  1. Zaakceptuj cookies');
    console.log('  2. Odśwież / wejdź na https://www.laczynaspilka.pl/rozgrywki');
    console.log('  3. Wybierz dowolną ligę, aż NIE ma napisu 404');
  } else {
    console.log('✓ Strona:', url || '(ładowanie…)');
    console.log('Zaakceptuj cookies, jeśli wyskoczy baner.');
  }

  await waitEnter();

  url = await getActiveUrl().catch(() => url);
  const ok = url ? !isSpa404(url) : false;
  console.log('\nAktualny URL:', url || '(nieznany)');

  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* ignore */
  }
  try {
    execSync('pkill -f "user-data-dir=.*scouting-profile" 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    /* ignore */
  }

  if (ok) {
    console.log('✓ Profil zapisany. Kliknij Sync w aplikacji — Chrome otworzy się sam.');
    process.exit(0);
  }
  console.warn('⚠ Nadal /404. Spróbuj: rm -rf .scouting-profile && npm run scouting:warmup');
  process.exit(1);
})().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
