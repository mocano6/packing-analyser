import type { Action, PKEntry, Shot, TeamInfo } from "@/types";
import { isRegainOnOpponentHalfForMap } from "./kpiRegainLosesZoneRaw";
import { count8sCaShotForBreakdown, isPkEntryFromRegainSequence, isShotFromRegainSequence } from "./kpiRegainSequenceFlags";

type Timestamped<T> = { item: T; timestamp: number };

const toTimestamp = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return 0;
};

const isTeamAttackShot = (shot: Shot, match: TeamInfo): boolean =>
  shot.teamContext === "attack" && (!shot.teamId || shot.teamId === match.team);

const isTeamPKEntryAttack = (entry: PKEntry, match: TeamInfo): boolean =>
  (entry.teamContext ?? "attack") === "attack" && (!entry.teamId || entry.teamId === match.team);

/**
 * ID przechwytów zespołu, po których w 8 s nastąpił strzał lub wejście PK z sekwencji regain
 * (bez straty między regain a zdarzeniem) — ta sama logika co KPI „8s CA” na statystykach zespołu.
 */
export function buildSuccessfulTeamRegainIds(match: TeamInfo): Set<string> {
  const successful = new Set<string>();

  const regainsOnOpponentHalf: Timestamped<Action>[] = (match.actions_regain ?? [])
    .filter((action) => action && isRegainOnOpponentHalfForMap(action))
    .map((action) => ({ item: action, timestamp: toTimestamp(action.videoTimestampRaw ?? action.videoTimestamp) }))
    .filter((entry) => entry.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (regainsOnOpponentHalf.length === 0) return successful;

  const pkEntriesAttack: Timestamped<PKEntry>[] = (match.pkEntries ?? [])
    .filter((entry) => entry && isTeamPKEntryAttack(entry, match))
    .map((entry) => ({ item: entry, timestamp: toTimestamp(entry.videoTimestampRaw ?? entry.videoTimestamp) }))
    .filter((entry) => entry.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const shotsAttack: Timestamped<Shot>[] = (match.shots ?? [])
    .filter((shot) => shot && isTeamAttackShot(shot, match))
    .map((shot) => ({ item: shot, timestamp: toTimestamp(shot.videoTimestampRaw ?? shot.videoTimestamp) }))
    .filter((entry) => entry.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const loses: Timestamped<Action>[] = (match.actions_loses ?? [])
    .filter((action) => action && action.isAut !== true)
    .map((action) => ({ item: action, timestamp: toTimestamp(action.videoTimestampRaw ?? action.videoTimestamp) }))
    .filter((entry) => entry.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const regainEntry of regainsOnOpponentHalf) {
    const regainTime = regainEntry.timestamp;
    const timeWindowEnd = regainTime + 8;
    const regainId = String(regainEntry.item.id ?? "").trim();
    if (!regainId) continue;

    const pkInWindow = pkEntriesAttack.find(
      (item) =>
        item.timestamp > regainTime &&
        item.timestamp <= timeWindowEnd &&
        isPkEntryFromRegainSequence(item.item),
    );
    const shotInWindow = shotsAttack.find(
      (item) =>
        item.timestamp > regainTime &&
        item.timestamp <= timeWindowEnd &&
        isShotFromRegainSequence(item.item),
    );

    let validShot = false;
    if (shotInWindow) {
      const hasLoseBeforeShot = loses.some(
        (lose) => lose.timestamp > regainTime && lose.timestamp < shotInWindow.timestamp,
      );
      if (!hasLoseBeforeShot) validShot = true;
    }

    let validPk = false;
    if (pkInWindow) {
      const hasLoseBeforePk = loses.some(
        (lose) => lose.timestamp > regainTime && lose.timestamp < pkInWindow.timestamp,
      );
      if (!hasLoseBeforePk) validPk = true;
    }

    const countsShot = count8sCaShotForBreakdown(
      validShot,
      shotInWindow?.timestamp,
      validPk,
      pkInWindow?.item,
      pkInWindow?.timestamp,
    );

    if (countsShot || validPk) {
      successful.add(regainId);
    }
  }

  return successful;
}
