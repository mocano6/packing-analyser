import type { PositionSystemState } from "@/types/positionSystem";
import { POSITION_SYSTEM_VERSION } from "@/types/positionSystem";

const VALID_PHASES = new Set<string>(["defense", "attack"]);

const VALID_POSITIONS = new Set<string>([
  "GK",
  "CB",
  "LB",
  "RB",
  "DM",
  "CM",
  "AM",
  "LW",
  "RW",
  "ST",
]);

function safePhase(v: unknown): PositionSystemState["nodes"][number]["phaseId"] | null {
  const s = String(v ?? "");
  return VALID_PHASES.has(s) ? (s as PositionSystemState["nodes"][number]["phaseId"]) : null;
}

function safePosition(v: unknown): PositionSystemState["nodes"][number]["positionId"] | null {
  const s = String(v ?? "");
  return VALID_POSITIONS.has(s) ? (s as PositionSystemState["nodes"][number]["positionId"]) : null;
}

function safeInt(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

export function buildSanitizedPositionSystemState(
  state: PositionSystemState
): Record<string, unknown> {
  return {
    nodes: state.nodes
      .map((n) => {
        const positionId = safePosition(n.positionId);
        const phaseId = safePhase(n.phaseId);
        if (!positionId || !phaseId) return null;
        return {
          id: String(n.id ?? ""),
          positionId,
          phaseId,
          templateId: String(n.templateId ?? ""),
          parentId: n.parentId == null || n.parentId === "" ? null : String(n.parentId),
          order: safeInt(n.order, 0),
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null),
  };
}

export function migratePositionSystemFromFirestore(
  raw: Record<string, unknown>
): PositionSystemState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  const nodes = Array.isArray(inner.nodes)
    ? (inner.nodes as Record<string, unknown>[])
        .map((n) => {
          const positionId = safePosition(n.positionId);
          const phaseId = safePhase(n.phaseId);
          if (!positionId || !phaseId) return null;
          return {
            id: String(n.id ?? ""),
            positionId,
            phaseId,
            templateId: String(n.templateId ?? ""),
            parentId: n.parentId == null || n.parentId === "" ? null : String(n.parentId),
            order: safeInt(n.order, 0),
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null)
    : [];

  return { nodes };
}

export function buildPositionSystemTaskDocument(
  state: PositionSystemState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedPositionSystemState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(POSITION_SYSTEM_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : POSITION_SYSTEM_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
