"use client";

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDB } from "@/lib/firebase";
import type { Action, TeamInfo } from "@/types";

const STORAGE_KEY = "packing_actions_pending_sync";
const FLUSH_DEBOUNCE_MS = 5 * 60 * 1000; // 5 min – batch co 5 min
const BATCH_COUNT = 25;
const OFFLINE_FLAG_KEY = "firestore_offline_mode";

export type PendingOp =
  | { type: "add"; matchId: string; collectionField: string; action: Action }
  | { type: "delete"; matchId: string; collectionField: string; actionId: string }
  | {
      type: "edit";
      matchId: string;
      collectionField: string;
      actionId: string;
      payload: Partial<Action>;
    };

type StateProvider = () => Action[];

// matchId -> collectionField -> getState
const stateProviders = new Map<string, Map<string, StateProvider>>();
// matchId:collectionField -> debounce timer
const dirtyTimers = new Map<string, ReturnType<typeof setTimeout>>();
// matchId:collectionField -> oznaczenie "dirty" (batch online)
const dirtyFields = new Set<string>();
// matchId:collectionField -> liczba zmian od ostatniego flush
const dirtyCounts = new Map<string, number>();

let pendingOps: PendingOp[] = [];
let storageLoaded = false;
let initialized = false;

function loadFromStorage(): PendingOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(ops: PendingOp[]) {
  if (typeof window === "undefined") return;
  try {
    if (ops.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
    }
  } catch (e) {
    console.warn("actionsSyncQueue: nie udało się zapisać do localStorage", e);
  }
}

function getPendingMatchFields(): Array<{ matchId: string; collectionField: string }> {
  const set = new Set<string>();
  for (const op of pendingOps) {
    set.add(`${op.matchId}:${op.collectionField}`);
  }
  for (const key of dirtyFields) {
    set.add(key);
  }
  return Array.from(set).map((key) => {
    const [matchId, collectionField] = key.split(":");
    return { matchId, collectionField };
  });
}

export function isOnline(): boolean {
  if (typeof window === "undefined") return false;
  if (!navigator.onLine) return false;
  return localStorage.getItem(OFFLINE_FLAG_KEY) !== "true";
}

export function getPendingCount(): number {
  if (!storageLoaded && typeof window !== "undefined") {
    pendingOps = loadFromStorage();
    storageLoaded = true;
  }
  return pendingOps.length;
}

export function registerStateProvider(
  matchId: string,
  collectionField: string,
  getState: StateProvider
): () => void {
  if (!stateProviders.has(matchId)) {
    stateProviders.set(matchId, new Map());
  }
  stateProviders.get(matchId)!.set(collectionField, getState);
  return () => {
    stateProviders.get(matchId)?.delete(collectionField);
    if (stateProviders.get(matchId)?.size === 0) stateProviders.delete(matchId);
  };
}

export function markDirty(matchId: string, collectionField: string): void {
  if (typeof window === "undefined") return;
  const key = `${matchId}:${collectionField}`;
  dirtyFields.add(key);
  const count = (dirtyCounts.get(key) ?? 0) + 1;
  dirtyCounts.set(key, count);
  if (count >= BATCH_COUNT) {
    dirtyCounts.set(key, 0);
    flushMatch(matchId).catch((e) =>
      console.warn("actionsSyncQueue: flush po liczbie akcji", e)
    );
    return;
  }
  scheduleFlushMatch(matchId, collectionField);
}

function scheduleFlushMatch(matchId: string, collectionField: string): void {
  const timerKey = `${matchId}:${collectionField}`;
  const existing = dirtyTimers.get(timerKey);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    dirtyTimers.delete(timerKey);
    flushMatch(matchId).catch((e) =>
      console.warn("actionsSyncQueue: flush po timerze", e)
    );
  }, FLUSH_DEBOUNCE_MS);
  dirtyTimers.set(timerKey, t);
}

export function enqueue(op: PendingOp): void {
  if (typeof window === "undefined") return;
  if (!storageLoaded) {
    pendingOps = loadFromStorage();
    storageLoaded = true;
  }
  pendingOps.push(op);
  saveToStorage(pendingOps);
}

function removePendingForMatch(matchId: string, collectionField: string): void {
  pendingOps = pendingOps.filter(
    (op) => !(op.matchId === matchId && op.collectionField === collectionField)
  );
  saveToStorage(pendingOps);
}

function applyOpsToActions(
  current: Action[],
  ops: PendingOp[],
  collectionField: string
): Action[] {
  let result = [...current];
  for (const op of ops) {
    if (op.collectionField !== collectionField) continue;
    if (op.type === "add" && op.action && op.action.id) {
      result = result.filter((a) => a.id !== op.action!.id);
      result.push(op.action as Action);
    } else if (op.type === "delete") {
      if (op.actionId === "__all__") {
        result = [];
      } else {
        result = result.filter((a) => a.id !== op.actionId);
      }
    } else if (op.type === "edit") {
      result = result.map((a) =>
        a.id === op.actionId ? { ...a, ...op.payload } : a
      );
    }
  }
  return result;
}

export async function flushMatch(matchId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getDB();
  const matchRef = doc(db, "matches", matchId);
  const providers = stateProviders.get(matchId);
  const pendingForMatch = getPendingMatchFields().filter((p) => p.matchId === matchId);

  const updates: Record<string, Action[]> = {};

  for (const { collectionField } of pendingForMatch) {
    const getState = providers?.get(collectionField);
    if (getState) {
      updates[collectionField] = getState();
    } else {
      const ops = pendingOps.filter(
        (op) => op.matchId === matchId && op.collectionField === collectionField
      );
      if (ops.length === 0) continue;
      try {
        const snap = await getDoc(matchRef);
        if (!snap.exists()) continue;
        const data = snap.data() as TeamInfo;
        const current =
          (data[collectionField as keyof TeamInfo] as Action[] | undefined) || [];
        updates[collectionField] = applyOpsToActions(
          current,
          pendingOps,
          collectionField
        );
      } catch (e) {
        console.warn(
          "actionsSyncQueue: getDoc dla apply ops nie powiódł się",
          e
        );
        continue;
      }
    }
  }

  if (Object.keys(updates).length === 0) return;

  try {
    await updateDoc(matchRef, updates);
    for (const { collectionField } of pendingForMatch) {
      removePendingForMatch(matchId, collectionField);
      dirtyFields.delete(`${matchId}:${collectionField}`);
      dirtyCounts.delete(`${matchId}:${collectionField}`);
    }
    const timerKeyBase = `${matchId}:`;
    for (const key of dirtyTimers.keys()) {
      if (key.startsWith(timerKeyBase)) {
        clearTimeout(dirtyTimers.get(key)!);
        dirtyTimers.delete(key);
      }
    }
  } catch (e) {
    console.warn("actionsSyncQueue: updateDoc nie powiódł się", e);
    throw e;
  }
}

export async function flushAll(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!storageLoaded) {
    pendingOps = loadFromStorage();
    storageLoaded = true;
  }
  const matchIds = new Set<string>();
  for (const op of pendingOps) {
    matchIds.add(op.matchId);
  }
  for (const { matchId } of getPendingMatchFields()) {
    matchIds.add(matchId);
  }
  for (const matchId of matchIds) {
    const hasPending =
      pendingOps.some((op) => op.matchId === matchId) ||
      Array.from(stateProviders.keys()).includes(matchId) ||
      Array.from(dirtyFields).some((key) => key.startsWith(`${matchId}:`));
    if (hasPending) {
      try {
        await flushMatch(matchId);
      } catch {
        // kontynuuj z innymi meczami
      }
    }
  }
}

export function setupFlushOnLeave(): void {
  if (typeof window === "undefined") return;

  const run = () => {
    if (!isOnline()) return;
    flushAll().catch((e) =>
      console.warn("actionsSyncQueue: flush on leave", e)
    );
  };

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") run();
  });
  window.addEventListener("pagehide", run);
}

export function setupFlushOnOnline(onFlushed?: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => {
    if (!navigator.onLine) return;
    if (localStorage.getItem(OFFLINE_FLAG_KEY) === "true") return;
    flushAll()
      .then(() => onFlushed?.())
      .catch((e) => console.warn("actionsSyncQueue: flush on online", e));
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

export function initActionsSyncQueue(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;
  pendingOps = loadFromStorage();
  storageLoaded = true;
  setupFlushOnLeave();
  setupFlushOnOnline();
}
