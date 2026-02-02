import type { Tab } from "./Tabs.types";

/**
 * Skróty Q/W/E/R/T mapujemy od lewej do prawej, zgodnie z UI:
 * Q: 8s ACC
 * W: Wejścia PK
 * E: xG
 * R: PxT
 * T: Regain/Loses
 */
export const TAB_SHORTCUT_KEY_TO_TAB: Readonly<Record<"q" | "w" | "e" | "r" | "t", Tab>> =
  Object.freeze({
    q: "acc8s",
    w: "pk_entries",
    e: "xg",
    r: "packing",
    t: "regain_loses",
  });

export function getTabForShortcutKey(key: string): Tab | null {
  const k = String(key || "").toLowerCase();
  if (k === "q" || k === "w" || k === "e" || k === "r" || k === "t") return TAB_SHORTCUT_KEY_TO_TAB[k];
  return null;
}

