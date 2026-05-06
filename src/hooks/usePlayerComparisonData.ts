"use client";

import { useCallback, useState } from "react";
import type { Player, TeamInfo } from "@/types";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "@/lib/firestoreWithMetrics";
import {
  buildPlayerComparisonRows,
  type PlayerComparisonMode,
  type PlayerComparisonResult,
} from "@/utils/playerComparisonMetrics";

export type PlayerComparisonFilters = {
  teamIds: string[];
  birthYearFrom?: number;
  birthYearTo?: number;
  dateFrom?: string;
  dateTo?: string;
  mode: PlayerComparisonMode;
};

type PlayerComparisonDataState = {
  players: Player[];
  matches: TeamInfo[];
  comparison: PlayerComparisonResult | null;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const normalizeTeams = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === "string" && id.length > 0);
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
};

const normalizePlayer = (id: string, data: Partial<Player> & { team?: unknown; teamId?: unknown }): Player => ({
  id,
  firstName: data.firstName || "",
  lastName: data.lastName || "",
  name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
  number: typeof data.number === "number" ? data.number : 0,
  position: data.position || "-",
  birthYear: typeof data.birthYear === "number" ? data.birthYear : undefined,
  imageUrl: data.imageUrl,
  teams: normalizeTeams(data.teams).length
    ? normalizeTeams(data.teams)
    : normalizeTeams(data.teamId ?? data.team),
  isDeleted: data.isDeleted,
  isTestPlayer: data.isTestPlayer,
});

const isBirthYearInRange = (player: Player, from?: number, to?: number): boolean => {
  if (from === undefined && to === undefined) return true;
  if (typeof player.birthYear !== "number") return false;
  if (from !== undefined && player.birthYear < from) return false;
  if (to !== undefined && player.birthYear > to) return false;
  return true;
};

const isMatchInDateRange = (match: TeamInfo, from?: string, to?: string): boolean => {
  if (!from && !to) return true;
  const date = typeof match.date === "string" ? match.date.slice(0, 10) : "";
  if (!date) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

async function fetchPlayersForTeams(teamIds: string[]): Promise<Player[]> {
  const db = getDB();
  const playersById = new Map<string, Player>();
  const playersCollection = collection(db, "players");

  for (const teamChunk of chunk(teamIds, 10)) {
    const snapshot = await getDocs(query(playersCollection, where("teams", "array-contains-any", teamChunk)));
    for (const docSnap of snapshot.docs) {
      const player = normalizePlayer(docSnap.id, docSnap.data() as Partial<Player>);
      if (player.isDeleted === true) continue;
      if (!player.teams.some((teamId) => teamIds.includes(teamId))) continue;
      playersById.set(player.id, player);
    }
  }

  return Array.from(playersById.values());
}

async function fetchMatchesForTeams(teamIds: string[], dateFrom?: string, dateTo?: string): Promise<TeamInfo[]> {
  const db = getDB();
  const matchesCollection = collection(db, "matches");
  const allMatches: TeamInfo[] = [];

  for (const teamId of teamIds) {
    const snapshot = await getDocs(query(matchesCollection, where("team", "==", teamId), orderBy("date", "desc")));
    for (const docSnap of snapshot.docs) {
      const match = {
        ...(docSnap.data() as TeamInfo),
        id: docSnap.id,
        matchId: docSnap.id,
      } as TeamInfo;
      if (isMatchInDateRange(match, dateFrom, dateTo)) {
        allMatches.push(match);
      }
    }
  }

  return allMatches;
}

export function usePlayerComparisonData() {
  const [data, setData] = useState<PlayerComparisonDataState>({
    players: [],
    matches: [],
    comparison: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<PlayerComparisonFilters | null>(null);

  const loadComparison = useCallback(async (filters: PlayerComparisonFilters) => {
    const teamIds = unique(filters.teamIds);
    if (teamIds.length === 0) {
      setError("Wybierz co najmniej jeden zespół.");
      setData({ players: [], matches: [], comparison: null });
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [playersRaw, matches] = await Promise.all([
        fetchPlayersForTeams(teamIds),
        fetchMatchesForTeams(teamIds, filters.dateFrom, filters.dateTo),
      ]);
      const players = playersRaw.filter((player) =>
        isBirthYearInRange(player, filters.birthYearFrom, filters.birthYearTo),
      );
      const comparison = buildPlayerComparisonRows(players, matches, filters.mode);

      setData({ players, matches, comparison });
      setLastFilters({ ...filters, teamIds });
      return comparison;
    } catch (loadError) {
      console.error("[player-comparison] load", loadError);
      setError("Nie udało się załadować porównania zawodników. Sprawdź filtry i spróbuj ponownie.");
      setData({ players: [], matches: [], comparison: null });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData({ players: [], matches: [], comparison: null });
    setError(null);
    setLastFilters(null);
  }, []);

  return {
    ...data,
    isLoading,
    error,
    lastFilters,
    loadComparison,
    reset,
  };
}
