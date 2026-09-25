import fs from 'fs';
import path from 'path';

/** Po 403/404 nie mintuj od razu — kolejne kliknięcie (np. Odśwież podgląd) tylko pogarsza score. */
export const SCOUTING_AUTH_COOLDOWN_MS = 90_000;

const MARKER_PATH = path.join(process.cwd(), '.scouting-auth-dead-at');

export function authCooldownRemainingMs(
  nowMs: number,
  lastDeadAtMs: number | null,
  cooldownMs = SCOUTING_AUTH_COOLDOWN_MS
): number {
  if (lastDeadAtMs == null || !Number.isFinite(lastDeadAtMs)) return 0;
  return Math.max(0, lastDeadAtMs + cooldownMs - nowMs);
}

export function formatAuthCooldownMessage(remainingMs: number): string | null {
  if (remainingMs <= 0) return null;
  const sec = Math.ceil(remainingMs / 1000);
  return (
    `Poprzednia próba ŁNP dostała 403/404. Poczekaj jeszcze ${sec} s ` +
    `i spróbuj ponownie (Odśwież dane / Odśwież podgląd) — kolejne kliknięcia od razu pogarszają reCAPTCHA.`
  );
}

export function readLastAuthDeadAtMs(): number | null {
  try {
    const raw = fs.readFileSync(MARKER_PATH, 'utf8').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function readAuthCooldownMessage(nowMs = Date.now()): string | null {
  return formatAuthCooldownMessage(authCooldownRemainingMs(nowMs, readLastAuthDeadAtMs()));
}

export function markAuthCooldown(atMs = Date.now()): void {
  try {
    fs.writeFileSync(MARKER_PATH, String(atMs));
  } catch {
    /* ignore */
  }
}

export function clearAuthCooldown(): void {
  try {
    fs.unlinkSync(MARKER_PATH);
  } catch {
    /* ignore */
  }
}
