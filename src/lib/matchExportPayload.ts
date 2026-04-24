import type { Action, TeamInfo } from "../types";
import {
  splitActionsByMatchField,
  type MatchDocumentActionFieldKey,
} from "./inferActionMatchField";

export type MatchExportJson = {
  exportDate: string;
  formatVersion: string;
  exportType: string;
  appInfo: { name: string; version: string };
  matchInfo: TeamInfo;
  /** Eksport meczu bez listy zawodników — import nadal akceptuje pustą tablicę. */
  players: [];
  actions: Action[];
  actionsByField: Record<MatchDocumentActionFieldKey, Action[]>;
};

/**
 * Buduje payload JSON eksportu: wyłącznie dane meczu i akcje przypisane do tego meczu
 * (z cache dokumentu lub z przefiltrowanej listy akcji).
 */
export function buildMatchExportData(
  actions: Action[],
  matchInfo: TeamInfo | null,
  matchDocumentForExport: TeamInfo | null,
  getMatchDocumentFromCache: (matchId: string) => TeamInfo | null,
  exportDate: Date = new Date(),
): MatchExportJson {
  const matchData: TeamInfo =
    matchInfo ?? {
      matchId: crypto.randomUUID(),
      team: "",
      opponent: "",
      isHome: true,
      competition: "",
      date: "",
    };

  const cached =
    matchDocumentForExport ??
    (matchInfo?.matchId ? getMatchDocumentFromCache(matchInfo.matchId) : null);

  const sameMatch = Boolean(
    cached && matchInfo?.matchId && (cached as TeamInfo).matchId === matchInfo.matchId,
  );

  let actionsByField: Record<MatchDocumentActionFieldKey, Action[]>;
  let actionsFlat: Action[];

  if (sameMatch && cached) {
    const c = cached as TeamInfo;
    actionsByField = {
      actions_packing: [...(c.actions_packing ?? [])],
      actions_unpacking: [...(c.actions_unpacking ?? [])],
      actions_regain: [...(c.actions_regain ?? [])],
      actions_loses: [...(c.actions_loses ?? [])],
    };
    actionsFlat = [
      ...actionsByField.actions_packing,
      ...actionsByField.actions_unpacking,
      ...actionsByField.actions_regain,
      ...actionsByField.actions_loses,
    ];
  } else {
    const matchId = matchData.matchId;
    const filtered = matchId
      ? actions.filter((a) => String(a.matchId) === String(matchId))
      : [];
    actionsByField = splitActionsByMatchField(filtered);
    actionsFlat = [
      ...actionsByField.actions_packing,
      ...actionsByField.actions_unpacking,
      ...actionsByField.actions_regain,
      ...actionsByField.actions_loses,
    ];
  }

  return {
    exportDate: exportDate.toISOString(),
    formatVersion: "2.1",
    exportType: "match_data",
    appInfo: {
      name: "Packing Analyzer",
      version: "1.0.0",
    },
    matchInfo: matchData,
    players: [],
    actions: actionsFlat,
    actionsByField,
  };
}
