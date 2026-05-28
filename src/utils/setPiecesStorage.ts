import type { TeamInfo } from "@/types";
import type {
  SetPieceFrame,
  SetPieceMatchDocument,
  SetPiecePlayerOverride,
  SetPieceSetup,
  SetPieceTypeId,
  SetPieceVariantId,
} from "@/types/setPieces";
import {
  buildSetupStorageKey,
  DEFAULT_SET_PIECE_VARIANT,
} from "../lib/setPiecePresets";
import { createInitialFrames, createEmptyFrame } from "./setPieceFrames";

const STORAGE_PREFIX = "setPieces_match_";

const VALID_TYPES = new Set<SetPieceTypeId>(["corner_attack", "free_kick_attack"]);

export function getSetPieceStorageKey(matchId: string): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

export function getMatchSquadPlayerIds(match: Pick<TeamInfo, "playerMinutes" | "startingLineup">): string[] {
  const ids = new Set<string>();
  match.playerMinutes?.forEach((entry) => {
    if (entry.playerId) ids.add(entry.playerId);
  });
  match.startingLineup?.slots.forEach((slot) => {
    if (slot.playerId) ids.add(slot.playerId);
  });
  return Array.from(ids);
}

function normalizeFrame(raw: Partial<SetPieceFrame>, index: number): SetPieceFrame {
  return createEmptyFrame(index, {
    id: typeof raw.id === "string" ? raw.id : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
    markers: Array.isArray(raw.markers) ? raw.markers : [],
    zones: Array.isArray(raw.zones) ? raw.zones : [],
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
  });
}

type LegacySetupFields = Partial<SetPieceSetup> & {
  markers?: SetPieceSetup["frames"][0]["markers"];
  zones?: SetPieceSetup["frames"][0]["zones"];
  assignments?: SetPieceSetup["frames"][0]["assignments"];
};

function normalizeFrames(value: LegacySetupFields): SetPieceFrame[] {
  if (Array.isArray(value.frames) && value.frames.length > 0) {
    return value.frames.map((frame, index) => normalizeFrame(frame as Partial<SetPieceFrame>, index));
  }

  const legacyMarkers = Array.isArray(value.markers) ? value.markers : [];
  const legacyZones = Array.isArray(value.zones) ? value.zones : [];
  const legacyAssignments = Array.isArray(value.assignments) ? value.assignments : [];

  if (legacyMarkers.length > 0 || legacyZones.length > 0 || legacyAssignments.length > 0) {
    return [
      createEmptyFrame(0, {
        markers: legacyMarkers,
        zones: legacyZones,
        assignments: legacyAssignments,
      }),
    ];
  }

  return createInitialFrames(
    Array.isArray(value.selectedPlayerIds) ? value.selectedPlayerIds : [],
    value.type as SetPieceTypeId,
    (value.variant as SetPieceVariantId) ?? DEFAULT_SET_PIECE_VARIANT,
  );
}

function normalizeSetup(value: Partial<SetPieceSetup>, fallbackKey: string): SetPieceSetup | null {
  const type = value.type;
  if (!type || !VALID_TYPES.has(type)) return null;

  const variant =
    typeof value.variant === "string" && value.variant.trim().length > 0
      ? value.variant.trim()
      : fallbackKey.includes("__")
        ? fallbackKey.split("__").slice(1).join("__") || DEFAULT_SET_PIECE_VARIANT
        : DEFAULT_SET_PIECE_VARIANT;

  const selectedPlayerIds = Array.isArray(value.selectedPlayerIds) ? value.selectedPlayerIds : [];
  const opponentPlayers = Array.isArray(value.opponentPlayers)
    ? value.opponentPlayers.filter(
        (item): item is SetPieceSetup["opponentPlayers"][number] =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { id?: string }).id === "string" &&
          typeof (item as { label?: string }).label === "string",
      )
    : [];
  const selectedOpponentIds = Array.isArray(value.selectedOpponentIds) ? value.selectedOpponentIds : [];
  const frames = normalizeFrames({ ...value, type, variant });

  return {
    type,
    variant,
    matchId: value.matchId ?? "",
    teamId: value.teamId ?? "",
    updatedAt: value.updatedAt ?? "",
    selectedPlayerIds,
    opponentPlayers: opponentPlayers.map((item) => ({
      id: item.id,
      label: item.label,
      number: typeof item.number === "number" ? item.number : 0,
    })),
    selectedOpponentIds,
    frames,
  };
}

/** Migruje legacy klucze (`corner_attack`) → `corner_attack__1`. */
export function migrateSetups(raw: unknown): Record<string, SetPieceSetup> {
  if (!raw || typeof raw !== "object") return {};

  const result: Record<string, SetPieceSetup> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const normalized = normalizeSetup(value as Partial<SetPieceSetup>, key);
    if (!normalized) continue;

    const storageKey = key.includes("__") ? key : buildSetupStorageKey(normalized.type, normalized.variant);
    result[storageKey] = normalized;
  }
  return result;
}

export function normalizeSetPieceMatchDocument(
  raw: Partial<SetPieceMatchDocument> | null,
  matchId: string,
  teamId: string,
): SetPieceMatchDocument {
  return {
    matchId,
    teamId,
    playerOverrides: raw?.playerOverrides && typeof raw.playerOverrides === "object" ? raw.playerOverrides : {},
    setups: migrateSetups(raw?.setups),
  };
}

export function loadSetPieceMatchDocument(matchId: string, teamId: string): SetPieceMatchDocument {
  if (typeof window === "undefined") {
    return normalizeSetPieceMatchDocument(null, matchId, teamId);
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(getSetPieceStorageKey(matchId)) || "null") as
      | Partial<SetPieceMatchDocument>
      | null;
    return normalizeSetPieceMatchDocument(parsed, matchId, teamId);
  } catch {
    return normalizeSetPieceMatchDocument(null, matchId, teamId);
  }
}

export function saveSetPieceMatchDocument(doc: SetPieceMatchDocument): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getSetPieceStorageKey(doc.matchId), JSON.stringify(doc));
}

export function applyPlayerOverride(
  doc: SetPieceMatchDocument,
  playerId: string,
  patch: SetPiecePlayerOverride,
): SetPieceMatchDocument {
  const current = doc.playerOverrides[playerId] ?? {};
  return {
    ...doc,
    playerOverrides: {
      ...doc.playerOverrides,
      [playerId]: { ...current, ...patch },
    },
  };
}

export function getOrCreateSetup(
  doc: SetPieceMatchDocument,
  type: SetPieceTypeId,
  variant: SetPieceVariantId,
  selectedPlayerIds: string[],
): SetPieceSetup {
  const key = buildSetupStorageKey(type, variant);
  const existing = doc.setups[key];
  if (existing && existing.matchId === doc.matchId) {
    return existing;
  }

  return {
    type,
    variant,
    matchId: doc.matchId,
    teamId: doc.teamId,
    updatedAt: new Date().toISOString(),
    selectedPlayerIds,
    opponentPlayers: [],
    selectedOpponentIds: [],
    frames: createInitialFrames(selectedPlayerIds, type, variant),
  };
}

export function upsertSetup(doc: SetPieceMatchDocument, setup: SetPieceSetup): SetPieceMatchDocument {
  const key = buildSetupStorageKey(setup.type, setup.variant);
  return {
    ...doc,
    setups: {
      ...doc.setups,
      [key]: { ...setup, updatedAt: new Date().toISOString() },
    },
  };
}

export { syncSetupPlayers, syncSetupRoster } from "./setPieceFrames";
