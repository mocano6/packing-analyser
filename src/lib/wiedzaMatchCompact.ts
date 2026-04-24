import { Acc8sEntry, Action, PKEntry, PlayerMinutes, Shot, TeamInfo } from "../types";

/**
 * Zostawiamy tylko pola potrzebne do Wiedzy + trendy KPI / Wagi (bez PII i bez ciężkich stringów).
 * Dzięki temu JSON mieści się w localStorage zamiast pełnych dokumentów Firestore.
 */

const ACTION_KEYS = new Set<string>([
  "id",
  "matchId",
  "teamId",
  "minute",
  "fromZone",
  "toZone",
  "startZone",
  "endZone",
  "regainAttackZone",
  "regainDefenseZone",
  "oppositeZone",
  "actionType",
  "videoTimestamp",
  "videoTimestampRaw",
  "possessionTeamId",
  "senderId",
  "receiverId",
  "packingPoints",
  "xTValueStart",
  "xTValueEnd",
  "isP0Start",
  "isP1Start",
  "isP2Start",
  "isP3Start",
  "isP0",
  "isP1",
  "isP2",
  "isP3",
  "isContact1",
  "isContact2",
  "isContact3Plus",
  "isShot",
  "isGoal",
  "isPenaltyAreaEntry",
  "isControversial",
  "isSecondHalf",
  "mode",
  "defensePlayers",
  "isBelow8s",
  "playersBehindBall",
  "opponentsBehindBall",
  "receptionBackAllyCount",
  "losesBackAllyCount",
  "regainOppRosterSquadTallyF1",
  "losesOppRosterSquadTallyF1",
  "receptionAllyCountBehindBall",
  "totalPlayersOnField",
  "totalOpponentsOnField",
  "playersLeftField",
  "opponentsLeftField",
  "regainAttackXT",
  "regainDefenseXT",
  "oppositeXT",
  "isAttack",
  "losesAttackXT",
  "losesDefenseXT",
  "losesAttackZone",
  "losesDefenseZone",
  "isReaction5s",
  "isAut",
  "isBadReaction5s",
  "isReaction5sNotApplicable",
  "_actionSource",
  "isRegain",
]);

const SHOT_KEYS = new Set<string>([
  "id",
  "x",
  "y",
  "playerId",
  "minute",
  "xG",
  "isGoal",
  "bodyPart",
  "matchId",
  "timestamp",
  "videoTimestamp",
  "videoTimestampRaw",
  "shotType",
  "teamContext",
  "teamId",
  "actionType",
  "actionCategory",
  "sfgSubtype",
  "actionPhase",
  "blockingPlayers",
  "linePlayers",
  "linePlayersCount",
  "pkPlayersCount",
  "isContact1",
  "isContact2",
  "isContact3Plus",
  "assistantId",
  "isControversial",
  "previousShotId",
  "isFromPK",
  "isOwnGoal",
]);

const PK_KEYS = new Set<string>([
  "id",
  "matchId",
  "teamId",
  "startX",
  "startY",
  "endX",
  "endY",
  "minute",
  "isSecondHalf",
  "senderId",
  "receiverId",
  "entryType",
  "teamContext",
  "videoTimestamp",
  "videoTimestampRaw",
  "isPossible1T",
  "pkPlayersCount",
  "opponentsInPKCount",
  "isShot",
  "isGoal",
  "isRegain",
  "isControversial",
  "timestamp",
]);

/** Minuty meczu — tylko pola do analizy wieku (bez PII). */
const PLAYER_MINUTES_KEYS = new Set<string>(["playerId", "startMinute", "endMinute", "status"]);

const ACC8S_KEYS = new Set<string>([
  "id",
  "matchId",
  "teamId",
  "minute",
  "isSecondHalf",
  "teamContext",
  "isShotUnder8s",
  "isPKEntryUnder8s",
  "passingPlayerIds",
  "isControversial",
  "videoTimestamp",
  "videoTimestampRaw",
  "timestamp",
]);

function pickKeys(obj: object, allowed: Set<string>): Record<string, unknown> {
  const src = obj as Record<string, unknown>;
  const o: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in src && src[k] !== undefined) o[k] = src[k];
  }
  return o;
}

/** Mecz do zapisu w localStorage — bez logo, URL-i wideo, nazwisk i bez GPS (oszczędność miejsca). */
export function compactWiedzaMatchForStorage(match: TeamInfo & { id: string }): TeamInfo & { id: string } {
  const out: TeamInfo & { id: string } = {
    id: match.id,
    matchId: match.matchId ?? match.id,
    team: match.team,
    opponent: match.opponent,
    isHome: match.isHome,
    competition: match.competition,
    date: match.date,
    matchType: match.matchType,
  };

  if (match.matchData?.possession) {
    out.matchData = { possession: { ...match.matchData.possession } };
  }

  out.actions_regain = (match.actions_regain ?? []).map((a) => pickKeys(a, ACTION_KEYS) as unknown as Action);
  out.actions_loses = (match.actions_loses ?? []).map((a) => pickKeys(a, ACTION_KEYS) as unknown as Action);
  out.actions_packing = (match.actions_packing ?? []).map((a) => pickKeys(a, ACTION_KEYS) as unknown as Action);
  out.actions_unpacking = (match.actions_unpacking ?? []).map((a) => pickKeys(a, ACTION_KEYS) as unknown as Action);

  out.shots = (match.shots ?? []).map((s) => pickKeys(s, SHOT_KEYS) as unknown as Shot);
  out.pkEntries = (match.pkEntries ?? []).map((p) => pickKeys(p, PK_KEYS) as unknown as PKEntry);
  out.acc8sEntries = (match.acc8sEntries ?? []).map((x) => pickKeys(x, ACC8S_KEYS) as unknown as Acc8sEntry);

  if (match.playerMinutes?.length) {
    out.playerMinutes = match.playerMinutes.map(
      (pm) => pickKeys(pm, PLAYER_MINUTES_KEYS) as unknown as PlayerMinutes,
    );
  }

  return out as TeamInfo & { id: string };
}
