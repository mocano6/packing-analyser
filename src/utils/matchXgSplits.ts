import { Action, Shot, TeamInfo } from "@/types";
import { getTeamXgForMatch, getOpponentXGForMatch } from "./trendyKpis";

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

function resolveShotTeamId(shot: Shot, match: TeamInfo): string | null {
  if (shot.teamId) return shot.teamId;
  if (shot.teamContext === "attack") return match.team;
  if (shot.teamContext === "defense") return match.opponent;
  return null;
}

function teamShotsForMatch(match: TeamInfo): Shot[] {
  return (match.shots ?? []).filter((s) => resolveShotTeamId(s, match) === match.team);
}

function opponentShotsForMatch(match: TeamInfo): Shot[] {
  return (match.shots ?? []).filter((s) => resolveShotTeamId(s, match) === match.opponent);
}

/** SFG / stałe fragmenty gry — jak `statystyki-zespolu` (actionCategory lub actionType). */
export function isSfgCategoryShot(shot: Shot): boolean {
  const any = shot as unknown as Record<string, unknown>;
  if (any.actionCategory === "sfg") return true;
  return (
    shot.actionType === "corner" ||
    shot.actionType === "free_kick" ||
    shot.actionType === "direct_free_kick" ||
    shot.actionType === "penalty" ||
    shot.actionType === "throw_in"
  );
}

function isLoseLikeAction(a: Action): boolean {
  const src = (a as any)._actionSource;
  if (src) return src === "lose" || src === "loses" || src === "loss";
  const hasRegainFields = a.playersBehindBall !== undefined || a.opponentsBehindBall !== undefined;
  return (
    a.isReaction5s !== undefined || (a.isBelow8s !== undefined && !hasRegainFields)
  );
}

function isRegainLikeAction(a: Action): boolean {
  if ((a as any).actionType === "regain") return true;
  if ((a as any).isRegain === true) return true;
  const src = (a as any)._actionSource;
  if (src === "regain") return true;
  const hasRegainFields = a.playersBehindBall !== undefined && a.opponentsBehindBall !== undefined;
  return hasRegainFields && !isLoseLikeAction(a);
}

function collectRegainActions(match: TeamInfo): Action[] {
  const raw = [...(match.actions_regain ?? []), ...(match.actions_packing ?? []).filter(isRegainLikeAction)];
  return Array.from(
    new Map(raw.map((a) => [a.id || `${a.minute}_${(a as any).senderId}`, a])).values(),
  );
}

/** Kto wykonał regain — jak `statystyki-zespolu` (brak teamContext → przeciwnik). */
function resolveRegainTeamId(match: TeamInfo, act: Action): string {
  if (act.teamId) return act.teamId;
  const tc = (act as { teamContext?: string }).teamContext;
  return tc === "attack" ? match.team : match.opponent;
}

/**
 * xG przypisane do okien 8 s po regain (jak panel KPI w Statystykach zespołu),
 * sumowane po strzałach strony, która wykonała regain.
 */
/** xG ze strzałów `actionType === 'regain'` (fallback gdy okna czasowe nie złapią przypisań). */
function sumXgRegainTaggedShots(match: TeamInfo, sideTeamId: string): number {
  return (match.shots ?? [])
    .filter((s) => (s as { actionType?: string }).actionType === "regain")
    .filter((s) => resolveShotTeamId(s, match) === sideTeamId)
    .reduce((acc, s) => acc + toNumber(s.xG), 0);
}

export function getTeamXgRegainWindowsForMatch(match: TeamInfo): number {
  const w = computeRegainWindowXg(match, match.team);
  if (w > 1e-9) return w;
  return sumXgRegainTaggedShots(match, match.team);
}

export function getOpponentXgRegainWindowsForMatch(match: TeamInfo): number {
  const w = computeRegainWindowXg(match, match.opponent);
  if (w > 1e-9) return w;
  return sumXgRegainTaggedShots(match, match.opponent);
}

function computeRegainWindowXg(match: TeamInfo, sideTeamId: string): number {
  const regainWithTs = collectRegainActions(match)
    .map((a) => ({
      action: a,
      ts: (a as any).videoTimestampRaw ?? (a as any).videoTimestamp ?? 0,
    }))
    .filter((x) => x.ts > 0)
    .sort((a, b) => a.ts - b.ts);

  const shotsWithTs = (match.shots ?? [])
    .map((s) => ({
      shot: s,
      ts: (s as any).videoTimestampRaw ?? (s as any).videoTimestamp ?? 0,
    }))
    .filter((x) => x.ts > 0);

  let sum = 0;
  regainWithTs.forEach((item, i) => {
    const nextTs = i < regainWithTs.length - 1 ? regainWithTs[i + 1].ts : Infinity;
    const endTs = item.ts + 8;
    const regainTeamId = resolveRegainTeamId(match, item.action);
    if (regainTeamId !== sideTeamId) return;
    const inWin = shotsWithTs.filter(
      (x) =>
        x.ts > item.ts &&
        x.ts <= endTs &&
        x.ts < nextTs &&
        resolveShotTeamId(x.shot, match) === regainTeamId,
    );
    sum += inWin.reduce((acc, x) => acc + toNumber(x.shot.xG), 0);
  });
  return sum;
}

export function getTeamXgSfgForMatch(match: TeamInfo): number {
  return teamShotsForMatch(match)
    .filter(isSfgCategoryShot)
    .reduce((s, x) => s + toNumber(x.xG), 0);
}

export function getOpponentXgSfgForMatch(match: TeamInfo): number {
  return opponentShotsForMatch(match)
    .filter(isSfgCategoryShot)
    .reduce((s, x) => s + toNumber(x.xG), 0);
}

/** Otwarta gra = całkowite xG − SFG − xG z okien po regain (jak KPI). */
export function getTeamXgOpenPlayForMatch(match: TeamInfo): number {
  const total = getTeamXgForMatch(match);
  return total - getTeamXgSfgForMatch(match) - getTeamXgRegainWindowsForMatch(match);
}

export function getOpponentXgOpenPlayForMatch(match: TeamInfo): number {
  const total = getOpponentXGForMatch(match);
  return total - getOpponentXgSfgForMatch(match) - getOpponentXgRegainWindowsForMatch(match);
}
