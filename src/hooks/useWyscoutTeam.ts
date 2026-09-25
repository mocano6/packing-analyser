"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { wyscoutFetchJson } from "@/lib/wyscout/fetchClient";
import type { WyscoutPolandCatalog, WyscoutOverviewPayload } from "@/lib/wyscout/service";
import type {
  WyscoutCompetition,
  WyscoutMatchAdvancedStats,
  WyscoutSeason,
  WyscoutTeam,
  WyscoutTeamBinding,
} from "@/types/wyscout";
import {
  filterTeamsByQuery,
  pickActiveOrLatestSeason,
} from "@/utils/wyscoutPolishCompetitions";
import {
  clearWyscoutTeamBinding,
  readWyscoutTeamBinding,
  writeWyscoutTeamBinding,
} from "@/utils/wyscoutTeamBinding";

export function useWyscoutTeam(options: {
  lookballTeamId: string;
  lookballTeamName: string;
  matchDate?: string;
  enabled: boolean;
}) {
  const { lookballTeamId, lookballTeamName, matchDate, enabled } = options;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [binding, setBinding] = useState<WyscoutTeamBinding | null>(null);
  const [overview, setOverview] = useState<WyscoutOverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<WyscoutPolandCatalog | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<WyscoutSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<WyscoutTeam[]>([]);
  const [isLeagueLoading, setIsLeagueLoading] = useState(false);
  const [teamFilter, setTeamFilter] = useState("");
  const [manualCompId, setManualCompId] = useState("");

  useEffect(() => {
    setBinding(lookballTeamId ? readWyscoutTeamBinding(lookballTeamId) : null);
    setOverview(null);
    setError(null);
    setTeamFilter("");
  }, [lookballTeamId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    wyscoutFetchJson<{ configured: boolean }>("/api/wyscout/status")
      .then((data) => {
        if (!cancelled) setConfigured(data.configured);
      })
      .catch((e) => {
        if (!cancelled) {
          setConfigured(false);
          setError(e instanceof Error ? e.message : "Nie udało się sprawdzić statusu Wyscout.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const loadCatalog = useCallback(async (seedCompId?: number) => {
    setIsCatalogLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (seedCompId) params.set("compId", String(seedCompId));
      const data = await wyscoutFetchJson<WyscoutPolandCatalog>(
        `/api/wyscout/competitions${params.toString() ? `?${params}` : ""}`,
      );
      setCatalog(data);
      setSelectedCompId((prev) => seedCompId || prev || data.suggestedCompId);
      if (data.warning && data.competitions.length === 0) {
        setError(data.warning);
      }
    } catch (e) {
      setCatalog({ competitions: [], iiiLiga: [], suggestedCompId: null });
      setError(
        e instanceof Error
          ? e.message
          : "Nie udało się pobrać dostępnych lig z Wyscout.",
      );
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !configured || binding) return;
    void loadCatalog();
  }, [enabled, configured, binding, loadCatalog]);

  useEffect(() => {
    setSeasons([]);
    setSelectedSeasonId(null);
    setLeagueTeams([]);
  }, [selectedCompId]);

  useEffect(() => {
    if (!enabled || !configured || binding || !selectedCompId) return;
    let cancelled = false;
    setIsLeagueLoading(true);
    setError(null);
    wyscoutFetchJson<{ seasons: WyscoutSeason[] }>(
      `/api/wyscout/seasons?compId=${selectedCompId}`,
    )
      .then((data) => {
        if (cancelled) return;
        setSeasons(data.seasons);
        const next = pickActiveOrLatestSeason(data.seasons);
        setSelectedSeasonId(next?.wyId ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setSeasons([]);
          setSelectedSeasonId(null);
          setError(e instanceof Error ? e.message : "Nie udało się pobrać sezonów.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLeagueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, configured, binding, selectedCompId]);

  useEffect(() => {
    if (!enabled || !configured || binding || !selectedCompId) return;
    let cancelled = false;
    setIsLeagueLoading(true);
    const params = new URLSearchParams({ compId: String(selectedCompId) });
    if (selectedSeasonId) params.set("seasonId", String(selectedSeasonId));
    wyscoutFetchJson<{ teams: WyscoutTeam[] }>(`/api/wyscout/teams?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setLeagueTeams(data.teams);
      })
      .catch((e) => {
        if (!cancelled) {
          setLeagueTeams([]);
          setError(e instanceof Error ? e.message : "Nie udało się pobrać drużyn ligi.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLeagueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, configured, binding, selectedCompId, selectedSeasonId]);

  const loadOverview = useCallback(
    async (next: WyscoutTeamBinding) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ wyId: String(next.wyId), teamName: next.name });
        if (matchDate) params.set("matchDate", matchDate);
        if (next.seasonId) params.set("seasonId", String(next.seasonId));
        const data = await wyscoutFetchJson<WyscoutOverviewPayload>(
          `/api/wyscout/overview?${params.toString()}`,
        );
        setOverview(data);
      } catch (e) {
        setOverview(null);
        setError(e instanceof Error ? e.message : "Nie udało się pobrać danych Wyscout.");
      } finally {
        setIsLoading(false);
      }
    },
    [matchDate],
  );

  useEffect(() => {
    if (!enabled || !configured || !binding) return;
    void loadOverview(binding);
  }, [enabled, configured, binding, loadOverview]);

  const bindTeam = useCallback(
    (team: WyscoutTeam) => {
      if (!lookballTeamId) return;
      const competition = catalog?.competitions.find((item) => item.wyId === selectedCompId);
      const next: WyscoutTeamBinding = {
        wyId: team.wyId,
        name: team.name,
        officialName: team.officialName,
        competitionId: selectedCompId ?? undefined,
        competitionName: competition?.name,
        seasonId: selectedSeasonId ?? undefined,
      };
      writeWyscoutTeamBinding(lookballTeamId, next);
      setBinding(next);
    },
    [lookballTeamId, catalog, selectedCompId, selectedSeasonId],
  );

  const unbindTeam = useCallback(() => {
    if (!lookballTeamId) return;
    clearWyscoutTeamBinding(lookballTeamId);
    setBinding(null);
    setOverview(null);
  }, [lookballTeamId]);

  const loadMatchStats = useCallback(
    async (matchWyId: number) => {
      if (!binding) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await wyscoutFetchJson<{ matchStats: WyscoutMatchAdvancedStats }>(
          `/api/wyscout/match-stats?matchWyId=${matchWyId}`,
        );
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                matchedMatch: prev.matches.find((m) => m.matchId === matchWyId) ?? {
                  matchId: matchWyId,
                },
                matchStats: data.matchStats,
              }
            : prev,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się pobrać statystyk meczu.");
      } finally {
        setIsLoading(false);
      }
    },
    [binding],
  );

  const selectedCompetition: WyscoutCompetition | null =
    catalog?.competitions.find((item) => item.wyId === selectedCompId) ?? null;

  const visibleTeams = useMemo(
    () => filterTeamsByQuery(leagueTeams, teamFilter),
    [leagueTeams, teamFilter],
  );

  return useMemo(
    () => ({
      configured,
      binding,
      overview,
      isLoading,
      error,
      catalog,
      isCatalogLoading,
      selectedCompId,
      setSelectedCompId,
      selectedCompetition,
      seasons,
      selectedSeasonId,
      setSelectedSeasonId,
      leagueTeams,
      visibleTeams,
      isLeagueLoading,
      teamFilter,
      setTeamFilter,
      manualCompId,
      setManualCompId,
      loadCatalog,
      bindTeam,
      unbindTeam,
      loadMatchStats,
    }),
    [
      configured,
      binding,
      overview,
      isLoading,
      error,
      catalog,
      isCatalogLoading,
      selectedCompId,
      selectedCompetition,
      seasons,
      selectedSeasonId,
      leagueTeams,
      visibleTeams,
      isLeagueLoading,
      teamFilter,
      manualCompId,
      loadCatalog,
      bindTeam,
      unbindTeam,
      loadMatchStats,
    ],
  );
}
