/** Klucz localStorage i event — strona analizatora, skróty wideo, toggle w nagłówku. */
export const POSSESSION_COUNTER_STORAGE_KEY = "possession_counter_enabled";
export const POSSESSION_COUNTER_CHANGED_EVENT = "possessionCounterEnabledChanged";

/** Brak wpisu => domyślnie ON (zgodnie z istniejącą logiką). */
export function isPossessionCounterEnabledStoredValue(raw: string | null): boolean {
  return raw !== "false";
}

export function applyPossessionCounterEnabledInBrowser(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(POSSESSION_COUNTER_STORAGE_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent(POSSESSION_COUNTER_CHANGED_EVENT, { detail: { enabled } })
  );
}
