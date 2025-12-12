"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./page.module.css";

export default function PlayerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params?.playerId as string;

  const { players } = usePlayersState();
  const { allMatches } = useMatchInfo();
  const { teams } = useTeams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [allActions, setAllActions] = useState<Action[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);

  // Znajdź zawodnika
  const player = useMemo(() => {
    return players.find(p => p.id === playerId);
  }, [players, playerId]);

  // Pobierz wszystkie akcje dla zawodnika
  useEffect(() => {
    const loadPlayerActions = async () => {
      if (!playerId || !db) return;

      setIsLoadingActions(true);
      try {
        const allActionsData: Action[] = [];

        // Pobierz akcje ze wszystkich meczów
        for (const match of allMatches) {
          if (!match.matchId) continue;

          try {
            const matchDoc = await getDoc(doc(db, "matches", match.matchId));
            if (matchDoc.exists()) {
              const matchData = matchDoc.data() as TeamInfo;
              
              // Pobierz akcje z różnych kolekcji
              const packingActions = matchData.actions_packing || [];
              const unpackingActions = matchData.actions_unpacking || [];
              const regainActions = matchData.actions_regain || [];
              const losesActions = matchData.actions_loses || [];

              // Dodaj matchId do każdej akcji
              const allMatchActions = [
                ...packingActions.map(a => ({ ...a, matchId: match.matchId })),
                ...unpackingActions.map(a => ({ ...a, matchId: match.matchId })),
                ...regainActions.map(a => ({ ...a, matchId: match.matchId })),
                ...losesActions.map(a => ({ ...a, matchId: match.matchId }))
              ];

              // Filtruj akcje dla wybranego zawodnika
              const playerActions = allMatchActions.filter(
                action =>
                  action.senderId === playerId ||
                  action.receiverId === playerId ||
                  action.playerId === playerId
              );

              allActionsData.push(...playerActions);
            }
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
          }
        }

        setAllActions(allActionsData);
        
        // Zaznacz wszystkie mecze domyślnie
        const matchIds = allMatches
          .filter(m => m.matchId)
          .map(m => m.matchId!);
        setSelectedMatchIds(matchIds);
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadPlayerActions();
  }, [playerId, allMatches]);

  // Oblicz statystyki zawodnika
  const playerStats = useMemo(() => {
    if (!player) return null;

    // Filtruj akcje dla wybranych meczów
    let filteredActions = allActions;
    if (selectedMatchIds.length > 0) {
      filteredActions = allActions.filter(action =>
        selectedMatchIds.includes(action.matchId || "")
      );
    }

    let totalPxT = 0;
    let totalXT = 0;
    let totalxG = 0;
    let totalRegains = 0;
    let totalLoses = 0;
    let totalPKEntries = 0;

    filteredActions.forEach((action) => {
      // PxT i xT
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const packingPoints = action.packingPoints || 0;
      const pxtValue = xTDifference * packingPoints;

      if (action.senderId === player.id || action.playerId === player.id) {
        totalPxT += pxtValue;
        totalXT += xTDifference;
      }

      // xG (z akcji strzałów)
      if (action.shot && action.xG) {
        if (action.playerId === player.id) {
          totalxG += action.xG;
        }
      }

      // Regainy
      if (
        (action.isBelow8s !== undefined ||
         action.playersBehindBall !== undefined ||
         action.opponentsBeforeBall !== undefined) &&
        action.senderId === player.id &&
        !action.isReaction5s
      ) {
        totalRegains += 1;
      }

      // Straty
      if (
        (action.isReaction5s !== undefined ||
         (action.isBelow8s !== undefined &&
          action.playersBehindBall === undefined &&
          action.opponentsBeforeBall === undefined)) &&
        action.senderId === player.id
      ) {
        totalLoses += 1;
      }

      // Wejścia w PK
      if (action.isPenaltyAreaEntry && (action.senderId === player.id || action.receiverId === player.id)) {
        totalPKEntries += 1;
      }
    });

    // Znajdź mecze, w których grał zawodnik
    const playerMatches = allMatches.filter((match) => {
      if (selectedMatchIds.length > 0) {
        return selectedMatchIds.includes(match.matchId || "");
      }
      return true;
    });

    return {
      totalPxT,
      totalXT,
      totalxG,
      totalRegains,
      totalLoses,
      totalPKEntries,
      actionsCount: filteredActions.length,
      matchesCount: playerMatches.length,
    };
  }, [player, allActions, allMatches, selectedMatchIds]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Ładowanie...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (!player) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Zawodnik nie znaleziony</h2>
          <Link href="/zawodnicy" className={styles.backLink}>
            ← Powrót do listy zawodników
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/zawodnicy" className={styles.backButton}>
          ← Powrót do listy zawodników
        </Link>
        <h1>Szczegóły zawodnika</h1>
      </div>

      <div className={styles.playerCard}>
        <div className={styles.playerHeader}>
          {player.imageUrl && (
            <div className={styles.imageContainer}>
              <img
                src={player.imageUrl}
                alt={getPlayerFullName(player)}
                className={styles.playerImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className={styles.playerInfo}>
            <h2 className={styles.playerName}>{getPlayerFullName(player)}</h2>
            {player.number && (
              <div className={styles.playerNumber}>#{player.number}</div>
            )}
            {player.position && (
              <div className={styles.playerPosition}>{player.position}</div>
            )}
          </div>
        </div>

        {isLoadingActions ? (
          <div className={styles.loading}>Ładowanie statystyk...</div>
        ) : playerStats ? (
          <div className={styles.statsContainer}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalPxT.toFixed(2)}</div>
                <div className={styles.statLabel}>PxT</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalxG.toFixed(2)}</div>
                <div className={styles.statLabel}>xG</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalRegains}</div>
                <div className={styles.statLabel}>Regainy</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalLoses}</div>
                <div className={styles.statLabel}>Straty</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalPKEntries}</div>
                <div className={styles.statLabel}>Wejścia w PK</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.actionsCount}</div>
                <div className={styles.statLabel}>Akcje</div>
              </div>
            </div>

            <div className={styles.matchesInfo}>
              <p>
                Statystyki z {playerStats.matchesCount}{" "}
                {playerStats.matchesCount === 1 ? "meczu" : "meczów"}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.noData}>Brak danych do wyświetlenia</div>
        )}
      </div>
    </div>
  );
}

