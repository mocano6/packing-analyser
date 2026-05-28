import { createDefaultMarkers, createDefaultOpponentMarkers } from "../lib/setPiecePresets";
import type { SetPieceOpponentPlayer } from "@/types/setPieces";
import type {
  SetPieceFrame,
  SetPieceMarker,
  SetPieceSetup,
  SetPieceTypeId,
  SetPieceVariantId,
  SetPieceZone,
} from "@/types/setPieces";

export function generateFrameId(): string {
  return `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createFrameLabel(index: number): string {
  return `Klatka ${index + 1}`;
}

export function createEmptyFrame(index: number, partial?: Partial<SetPieceFrame>): SetPieceFrame {
  return {
    id: partial?.id ?? generateFrameId(),
    label: partial?.label ?? createFrameLabel(index),
    markers: partial?.markers ?? [],
    zones: partial?.zones ?? [],
    assignments: partial?.assignments ?? [],
  };
}

export function createInitialFrames(
  selectedPlayerIds: string[],
  type: SetPieceTypeId,
  variant: SetPieceVariantId,
): SetPieceFrame[] {
  return [
    createEmptyFrame(0, {
      markers: createDefaultMarkers(selectedPlayerIds, type, variant),
      assignments: selectedPlayerIds.map((playerId) => ({ playerId, task: "" })),
    }),
  ];
}

export function duplicateFrame(frame: SetPieceFrame, index: number): SetPieceFrame {
  return {
    id: generateFrameId(),
    label: createFrameLabel(index),
    markers: frame.markers.map((marker) => ({ ...marker })),
    zones: frame.zones.map((zone) => ({ ...zone, id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })),
    assignments: frame.assignments.map((item) => ({ ...item })),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Płynne przejście ease-in-out dla animacji. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function interpolateMarkers(from: SetPieceMarker[], to: SetPieceMarker[], t: number): SetPieceMarker[] {
  const fromMap = new Map(from.map((marker) => [marker.playerId, marker]));
  const toMap = new Map(to.map((marker) => [marker.playerId, marker]));
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);
  const result: SetPieceMarker[] = [];

  for (const playerId of ids) {
    const a = fromMap.get(playerId);
    const b = toMap.get(playerId);
    if (a && b) {
      result.push({
        playerId,
        side: t < 0.5 ? a.side : b.side,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
      });
    } else if (a && t < 0.5) {
      result.push({ ...a });
    } else if (b && t >= 0.5) {
      result.push({ ...b });
    }
  }

  return result;
}

export function interpolateZones(from: SetPieceZone[], to: SetPieceZone[], t: number): SetPieceZone[] {
  const fromMap = new Map(from.map((zone) => [zone.id, zone]));
  const toMap = new Map(to.map((zone) => [zone.id, zone]));
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);
  const result: SetPieceZone[] = [];

  for (const id of ids) {
    const a = fromMap.get(id);
    const b = toMap.get(id);
    if (a && b) {
      result.push({
        id,
        label: t < 0.5 ? a.label : b.label,
        kind: t < 0.5 ? a.kind : b.kind,
        task: t < 0.5 ? a.task : b.task,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        width: lerp(a.width, b.width, t),
        height: lerp(a.height, b.height, t),
      });
    } else if (a && t < 0.5) {
      result.push({ ...a });
    } else if (b && t >= 0.5) {
      result.push({ ...b });
    }
  }

  return result;
}

export interface SetPieceInterpolatedSnapshot {
  markers: SetPieceMarker[];
  zones: SetPieceZone[];
}

export function interpolateFrames(
  frameA: SetPieceFrame,
  frameB: SetPieceFrame,
  rawProgress: number,
): SetPieceInterpolatedSnapshot {
  const t = easeInOutCubic(Math.max(0, Math.min(1, rawProgress)));
  return {
    markers: interpolateMarkers(frameA.markers, frameB.markers, t),
    zones: interpolateZones(frameA.zones, frameB.zones, t),
  };
}

export function getFramePairAtPlayback(
  frames: SetPieceFrame[],
  segmentIndex: number,
  loop: boolean,
): { frameA: SetPieceFrame; frameB: SetPieceFrame; segmentIndex: number } {
  if (frames.length === 0) {
    const empty = createEmptyFrame(0);
    return { frameA: empty, frameB: empty, segmentIndex: 0 };
  }
  if (frames.length === 1) {
    return { frameA: frames[0], frameB: frames[0], segmentIndex: 0 };
  }

  const maxSegment = loop ? frames.length : frames.length - 1;
  const safeSegment = ((segmentIndex % maxSegment) + maxSegment) % maxSegment;
  const frameA = frames[safeSegment];
  const frameB = loop ? frames[(safeSegment + 1) % frames.length] : frames[Math.min(safeSegment + 1, frames.length - 1)];
  return { frameA, frameB, segmentIndex: safeSegment };
}

export function computePlaybackElapsed(
  startMs: number,
  nowMs: number,
  msPerSegment: number,
  frameCount: number,
  loop: boolean,
): { segmentIndex: number; segmentProgress: number; isFinished: boolean } {
  if (frameCount <= 1) {
    return { segmentIndex: 0, segmentProgress: 0, isFinished: true };
  }

  const segmentCount = loop ? frameCount : frameCount - 1;
  const totalMs = segmentCount * msPerSegment;
  const elapsed = nowMs - startMs;

  if (!loop && elapsed >= totalMs) {
    return { segmentIndex: segmentCount - 1, segmentProgress: 1, isFinished: true };
  }

  const wrapped = loop ? elapsed % totalMs : elapsed;
  const segmentIndex = Math.floor(wrapped / msPerSegment);
  const segmentProgress = (wrapped % msPerSegment) / msPerSegment;
  return { segmentIndex, segmentProgress, isFinished: false };
}

function isOpponentMarker(marker: SetPieceMarker): boolean {
  return marker.side === "opponent";
}

export function syncFrameRoster(
  frame: SetPieceFrame,
  selectedPlayerIds: string[],
  selectedOpponentIds: string[],
  opponentPlayers: SetPieceOpponentPlayer[],
  type: SetPieceTypeId,
  variant: SetPieceVariantId,
): SetPieceFrame {
  const ownSet = new Set(selectedPlayerIds);
  const oppSet = new Set(selectedOpponentIds);

  const ownMarkers = frame.markers.filter((marker) => !isOpponentMarker(marker) && ownSet.has(marker.playerId));
  const oppMarkers = frame.markers.filter((marker) => isOpponentMarker(marker) && oppSet.has(marker.playerId));

  const existingOwnIds = new Set(ownMarkers.map((marker) => marker.playerId));
  const existingOppIds = new Set(oppMarkers.map((marker) => marker.playerId));

  const newOwnMarkers = createDefaultMarkers(
    selectedPlayerIds.filter((id) => !existingOwnIds.has(id)),
    type,
    variant,
  );
  const newOppMarkers = createDefaultOpponentMarkers(
    selectedOpponentIds.filter((id) => !existingOppIds.has(id)),
    opponentPlayers,
    variant,
  );

  const assignmentByPlayer = new Map(frame.assignments.map((item) => [item.playerId, item]));
  const assignments = selectedPlayerIds.map((playerId) => {
    const existing = assignmentByPlayer.get(playerId);
    return existing ?? { playerId, task: "" };
  });

  return {
    ...frame,
    markers: [...ownMarkers, ...newOwnMarkers, ...oppMarkers, ...newOppMarkers],
    assignments,
  };
}

export function syncSetupRoster(
  setup: SetPieceSetup,
  selectedPlayerIds: string[],
  selectedOpponentIds: string[],
): SetPieceSetup {
  const opponentPlayers = setup.opponentPlayers ?? [];
  return {
    ...setup,
    selectedPlayerIds,
    selectedOpponentIds,
    opponentPlayers,
    frames: setup.frames.map((frame) =>
      syncFrameRoster(frame, selectedPlayerIds, selectedOpponentIds, opponentPlayers, setup.type, setup.variant),
    ),
  };
}

export function syncSetupPlayers(setup: SetPieceSetup, selectedPlayerIds: string[]): SetPieceSetup {
  return syncSetupRoster(setup, selectedPlayerIds, setup.selectedOpponentIds ?? []);
}

export function setupHasSavedLayout(setup: SetPieceSetup | undefined): boolean {
  if (!setup) return false;
  return setup.selectedPlayerIds.length > 0;
}
