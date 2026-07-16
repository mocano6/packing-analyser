import type {
  GameModelPhaseId,
  GameModelRulePriority,
  GameModelState,
} from "@/types/gameModel";
import { GAME_MODEL_VERSION } from "@/types/gameModel";

const VALID_PHASES = new Set<string>(["defense", "attack", "set_pieces"]);

function safePhase(v: unknown): GameModelPhaseId | null {
  const s = String(v ?? "");
  return VALID_PHASES.has(s) ? (s as GameModelPhaseId) : null;
}

/** Priorytet szablonu — zwraca undefined, aby nie zaśmiecać dokumentu. */
function safePriority(v: unknown): GameModelRulePriority | undefined {
  return v === "key" || v === "support" ? v : undefined;
}

/** Normalizuje opcjonalny tekst — pusty/whitespace zwraca undefined. */
function optionalTrimmed(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : undefined;
}

function safeLevel(v: unknown): 0 | 1 | 2 {
  const n = typeof v === "number" ? v : Number(v);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
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

export function buildSanitizedGameModelState(state: GameModelState): Record<string, unknown> {
  return {
    templates: state.templates.map((t) => ({
      id: String(t.id ?? ""),
      title: String(t.title ?? ""),
      level: safeLevel(t.level),
      description: optionalTrimmed(t.description),
      trigger: optionalTrimmed(t.trigger),
      priority: safePriority(t.priority),
    })),
    nodes: state.nodes
      .map((n) => {
        const phaseId = safePhase(n.phaseId);
        if (!phaseId) return null;
        return {
          id: String(n.id ?? ""),
          templateId: String(n.templateId ?? ""),
          phaseId,
          parentId: n.parentId == null || n.parentId === "" ? null : String(n.parentId),
          order: safeInt(n.order, 0),
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null),
  };
}

export function migrateGameModelFromFirestore(raw: Record<string, unknown>): GameModelState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  const templates = Array.isArray(inner.templates)
    ? (inner.templates as Record<string, unknown>[]).map((t) => ({
        id: String(t.id ?? ""),
        title: String(t.title ?? ""),
        level: safeLevel(t.level),
        description: optionalTrimmed(t.description),
        trigger: optionalTrimmed(t.trigger),
        priority: safePriority(t.priority),
      }))
    : [];

  const nodes = Array.isArray(inner.nodes)
    ? (inner.nodes as Record<string, unknown>[])
        .map((n) => {
          const phaseId = safePhase(n.phaseId);
          if (!phaseId) return null;
          return {
            id: String(n.id ?? ""),
            templateId: String(n.templateId ?? ""),
            phaseId,
            parentId: n.parentId == null || n.parentId === "" ? null : String(n.parentId),
            order: safeInt(n.order, 0),
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null)
    : [];

  return { templates, nodes };
}

export function buildGameModelTaskDocument(
  state: GameModelState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedGameModelState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(GAME_MODEL_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : GAME_MODEL_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
