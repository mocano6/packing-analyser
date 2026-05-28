"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query, where } from "@/lib/firestoreWithMetrics";
import { getDB } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { usePlayersState } from "@/hooks/usePlayersState";
import { getTeamsArray, type Team } from "@/constants/teamsLoader";
import type { Player, TeamInfo } from "@/types";
import SetPieceEditor from "@/components/SetPieceEditor/SetPieceEditor";
import { getMatchSquadPlayerIds } from "@/utils/setPiecesStorage";
import {
  loadSetPiecesPageSelection,
  resolveSetPiecesMatchId,
  saveSetPiecesPageSelection,
  type SetPiecesPageSelection,
} from "@/utils/setPiecesPagePreferences";
import styles from "./page.module.css";

function toDateLabel(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export default function StaleFragmentyPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const { players, isLoading: playersLoading } = usePlayersState();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [matches, setMatches] = useState<TeamInfo[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchDetail, setMatchDetail] = useState<TeamInfo | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [teamPrefsApplied, setTeamPrefsApplied] = useState(false);
  const savedSelectionRef = useRef<SetPiecesPageSelection | null>(null);

  useEffect(() => {
    savedSelectionRef.current = loadSetPiecesPageSelection();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void getTeamsArray({ includeInactive: true }).then(setTeams).catch(() => setTeams([]));
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (teamPrefsApplied || teams.length === 0) return;
    const saved = savedSelectionRef.current;
    if (saved?.teamId && teams.some((team) => team.id === saved.teamId)) {
      setSelectedTeamId(saved.teamId);
    }
    setTeamPrefsApplied(true);
  }, [teamPrefsApplied, teams]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMatches([]);
      setSelectedMatchId("");
      setMatchDetail(null);
      return;
    }

    let cancelled = false;
    setIsLoadingMatches(true);

    getDocs(query(collection(getDB(), "matches"), where("team", "==", selectedTeamId), orderBy("date", "desc")))
      .then((snapshot) => {
        if (cancelled) return;
        const list = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as TeamInfo),
          id: docSnap.id,
          matchId: docSnap.id,
        }));
        setMatches(list);
        setSelectedMatchId((prev) =>
          resolveSetPiecesMatchId(list, {
            savedSelection: savedSelectionRef.current,
            teamId: selectedTeamId,
            previousMatchId: prev,
          }),
        );
      })
      .catch((error) => {
        console.error("[stale-fragmenty] błąd ładowania meczów", error);
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMatches(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedMatchId) {
      setMatchDetail(null);
      return;
    }

    let cancelled = false;
    getDoc(doc(getDB(), "matches", selectedMatchId)).then((snap) => {
      if (cancelled) return;
      if (!snap.exists()) {
        setMatchDetail(null);
        return;
      }
      setMatchDetail({
        ...(snap.data() as TeamInfo),
        matchId: snap.id,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedTeamId || !selectedMatchId) return;
    saveSetPiecesPageSelection({ teamId: selectedTeamId, matchId: selectedMatchId });
  }, [selectedTeamId, selectedMatchId]);

  const squadPlayers = useMemo(() => {
    if (!matchDetail) return [] as Player[];
    const squadIds = new Set(getMatchSquadPlayerIds(matchDetail));
    if (squadIds.size === 0) {
      return players.filter((player) => player.teams?.includes(selectedTeamId) && !player.isDeleted);
    }
    return players.filter((player) => squadIds.has(player.id) && !player.isDeleted);
  }, [matchDetail, players, selectedTeamId]);

  const selectedMatch = matches.find((match) => match.matchId === selectedMatchId);

  if (authLoading) {
    return <div className={styles.centered}>Ładowanie…</div>;
  }

  if (!isAuthenticated) {
    return (
      <AuthDeniedBlock
        message="Zaloguj się, aby korzystać z modułu stałych fragmentów."
        buttonLabel="Zaloguj się"
        onClick={() => router.push("/login")}
      />
    );
  }

  if (!isAdmin) {
    return (
      <AuthDeniedBlock
        message="Moduł stałych fragmentów jest dostępny tylko dla administratorów."
        buttonLabel="Powrót do aplikacji"
        onClick={() => router.push("/analyzer")}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Stałe fragmenty</h1>
          <p className={styles.subtitle}>Prezentacja ustawień — zapis lokalny (localStorage)</p>
        </div>
        <Link href="/admin" className={styles.backLink}>
          Panel admina
        </Link>
      </header>

      <p className={styles.intro}>
        Ustaw zawodników na boisku, podmień zdjęcia i nazwiska (zapis lokalny w przeglądarce), przypisz zadania oraz
        narysuj strefy ruchu i cele. Na start: rzut rożny i rzut wolny w ataku.
      </p>

      <div className={styles.filters}>
        <label className={styles.filterLabel}>
          Zespół
          <select
            className={styles.select}
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            <option value="">— wybierz zespół —</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterLabel}>
          Mecz
          <select
            className={styles.select}
            value={selectedMatchId}
            onChange={(event) => setSelectedMatchId(event.target.value)}
            disabled={!selectedTeamId || isLoadingMatches || matches.length === 0}
          >
            {matches.length === 0 && <option value="">Brak meczów</option>}
            {matches.map((match) => (
              <option key={match.matchId} value={match.matchId}>
                {toDateLabel(match.date)} — vs {match.opponent || "?"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {playersLoading && <p className={styles.status}>Ładowanie zawodników…</p>}
      {isLoadingMatches && <p className={styles.status}>Ładowanie meczów…</p>}

      {selectedTeamId && selectedMatchId && !playersLoading && (
        <>
          {squadPlayers.length === 0 ? (
            <p className={styles.warning}>
              Brak zawodników w składzie tego meczu (playerMinutes / startingLineup). Uzupełnij skład w analizatorze
              meczu.
            </p>
          ) : (
            <SetPieceEditor matchId={selectedMatchId} teamId={selectedTeamId} squadPlayers={squadPlayers} />
          )}
          {selectedMatch && (
            <p className={styles.matchHint}>
              Edycja: {toDateLabel(selectedMatch.date)} vs {selectedMatch.opponent} · {squadPlayers.length} zawodników
              ze składu
            </p>
          )}
        </>
      )}
    </div>
  );
}

function AuthDeniedBlock({
  message,
  buttonLabel,
  onClick,
}: {
  message: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.centered}>
      <p>{message}</p>
      <button type="button" className={styles.primaryButton} onClick={onClick}>
        {buttonLabel}
      </button>
    </div>
  );
}
