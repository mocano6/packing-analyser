export type AdminZadaniaTabId = "planner" | "eisenhower" | "model" | "microcycle";

export const ADMIN_ZADANIA_TAB_STORAGE_PREFIX = "adminZadania_activeTab" as const;

export const DEFAULT_ADMIN_ZADANIA_TAB: AdminZadaniaTabId = "planner";

export function adminZadaniaTabStorageKey(uid?: string | null): string {
  if (uid && uid.trim().length > 0) {
    return `${ADMIN_ZADANIA_TAB_STORAGE_PREFIX}_${uid.trim()}`;
  }
  return ADMIN_ZADANIA_TAB_STORAGE_PREFIX;
}

export function parseAdminZadaniaTab(raw: unknown): AdminZadaniaTabId | null {
  if (raw === "planner" || raw === "eisenhower" || raw === "model" || raw === "microcycle") return raw;
  return null;
}

function browserLocalStorage(): Storage | null {
  try {
    const w = (globalThis as { window?: Window }).window;
    return w?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readAdminZadaniaTab(uid?: string | null): AdminZadaniaTabId {
  const storage = browserLocalStorage();
  if (!storage) return DEFAULT_ADMIN_ZADANIA_TAB;
  try {
    return parseAdminZadaniaTab(storage.getItem(adminZadaniaTabStorageKey(uid))) ?? DEFAULT_ADMIN_ZADANIA_TAB;
  } catch {
    return DEFAULT_ADMIN_ZADANIA_TAB;
  }
}

export function writeAdminZadaniaTab(uid: string | null | undefined, tab: AdminZadaniaTabId): void {
  if (!parseAdminZadaniaTab(tab)) return;
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(adminZadaniaTabStorageKey(uid), tab);
  } catch {
    // ignore quota / private mode
  }
}
