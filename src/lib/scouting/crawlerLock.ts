/** Jedna sesja Chrome/reCAPTCHA naraz — Odśwież dane i Odśwież podgląd nie mogą się ścigać. */

let chain: Promise<unknown> = Promise.resolve();

export function withLaczyCrawlerLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
