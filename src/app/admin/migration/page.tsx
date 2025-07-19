"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getDB } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { NewPlayer, TeamMembership } from "@/types/migration";

interface Player {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  teams?: string[];
  number?: number;
  position?: string;
  birthYear?: number;
  imageUrl?: string;
}

interface MigrationAnalysis {
  totalPlayers: number;
  playersWithTeams: number;
  teamDistribution: { [teamId: string]: number };
  duplicateNumbers: Array<{teamId: string, number: number, players: string[]}>;
  missingData: Array<{playerId: string, missing: string[]}>;
  multiTeamPlayers: Array<{player: Player, teams: string[]}>;
  issues: string[];
}

export default function MigrationAnalysisPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<MigrationAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stany migracji
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState<string>("");
  const [isMigrated, setIsMigrated] = useState(false);
  
  // Stany przywracania kopii zapasowej
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState<string>("");
  
  // Stany usuwania nowej struktury
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatus, setDeleteStatus] = useState<string>("");

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push("/login");
    }
  }, [user, isAdmin, isLoading, router]);

  const loadData = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);



             // Pobierz zawodników
       const playersSnapshot = await getDocs(collection(getDB(), "players"));
       const playersData = playersSnapshot.docs.map(doc => ({
         id: doc.id,
         ...doc.data()
       })) as Player[];

       // Pobierz mecze
       const matchesSnapshot = await getDocs(collection(getDB(), "matches"));
       const matchesData = matchesSnapshot.docs.map(doc => ({
         id: doc.id,
         ...doc.data()
       }));

       // Pobierz zespoły
       const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPlayers(playersData);
      setMatches(matchesData);
      setTeams(teamsData);

      

      // Przeprowadź analizę
      const analysisResult = analyzeData(playersData);
      setAnalysis(analysisResult);

    } catch (err) {
      console.error("❌ Błąd podczas ładowania danych:", err);
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeData = (playersData: Player[]): MigrationAnalysis => {
    console.log("🔍 Rozpoczynam analizę danych...");

    const issues: string[] = [];
    const stats = {
      totalPlayers: playersData.length,
      playersWithTeams: 0,
      teamDistribution: {} as { [teamId: string]: number },
      duplicateNumbers: [] as Array<{teamId: string, number: number, players: string[]}>,
      missingData: [] as Array<{playerId: string, missing: string[]}>,
      multiTeamPlayers: [] as Array<{player: Player, teams: string[]}>
    };

    const teamPlayerNumbers: { [teamId: string]: { [number: number]: string[] } } = {};

    for (const player of playersData) {
      // Sprawdź czy zawodnik ma zespoły
      if (!player.teams || player.teams.length === 0) {
        issues.push(`⚠️ Zawodnik ${getPlayerName(player)} (${player.id}) nie ma przypisanych zespołów`);
      } else {
        stats.playersWithTeams++;
        
        // Jeśli zawodnik jest w wielu zespołach
        if (player.teams.length > 1) {
          stats.multiTeamPlayers.push({
            player: player,
            teams: player.teams
          });
        }
        
        // Statystyki zespołów
        for (const teamId of player.teams) {
          stats.teamDistribution[teamId] = (stats.teamDistribution[teamId] || 0) + 1;
          
          // Sprawdź duplikaty numerów w zespołach
          if (player.number) {
            if (!teamPlayerNumbers[teamId]) {
              teamPlayerNumbers[teamId] = {};
            }
            if (!teamPlayerNumbers[teamId][player.number]) {
              teamPlayerNumbers[teamId][player.number] = [];
            }
            teamPlayerNumbers[teamId][player.number].push(getPlayerName(player));
          }
        }
      }

      // Sprawdź brakujące dane
      const missing: string[] = [];
      if (!player.firstName && !player.name) missing.push('firstName/name');
      if (!player.lastName && !player.name) missing.push('lastName');
      if (!player.number) missing.push('number');
      if (!player.position) missing.push('position');
      
      if (missing.length > 0) {
        stats.missingData.push({ playerId: player.id, missing });
      }
    }

    // Znajdź duplikaty numerów w zespołach
    for (const [teamId, numbers] of Object.entries(teamPlayerNumbers)) {
      for (const [number, playersList] of Object.entries(numbers)) {
        if (playersList.length > 1) {
          stats.duplicateNumbers.push({
            teamId,
            number: parseInt(number),
            players: playersList
          });
        }
      }
    }

    return {
      ...stats,
      issues
    };
  };

  const getPlayerName = (player: Player): string => {
    if (player.firstName && player.lastName) {
      return `${player.firstName} ${player.lastName}`;
    }
    if (player.name) {
      return player.name;
    }
    return "Brak nazwy";
  };

  const createBackup = async () => {
    if (!players.length || !matches.length || !teams.length) {
      alert("Najpierw załaduj dane!");
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const backupData = {
        timestamp,
        players,
        matches,
        teams,
        analysis
      };

      // Pobierz dane jako JSON
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Pobierz jako plik
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-migration-analysis-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("✅ Backup został pobrany jako plik JSON");
    } catch (err) {
      console.error("❌ Błąd podczas tworzenia backup:", err);
      alert("❌ Błąd podczas tworzenia backup");
    }
  };

  // Funkcja przywracania danych z kopii zapasowej
  const restoreFromBackup = async (file: File) => {
    try {
      setIsRestoring(true);
      setRestoreProgress(0);
      setError(null);
      setRestoreStatus("Czytam plik kopii zapasowej...");

      // Odczytaj plik JSON
      const fileText = await file.text();
      const backupData = JSON.parse(fileText);

      // Walidacja formatu kopii zapasowej
      if (!backupData.players || !Array.isArray(backupData.players)) {
        throw new Error("Nieprawidłowy format kopii zapasowej - brak danych zawodników");
      }

      console.log(`📥 Znaleziono ${backupData.players.length} zawodników w kopii zapasowej`);
      setRestoreStatus(`Przywracam ${backupData.players.length} zawodników...`);

      const totalPlayers = backupData.players.length;
      let restoredPlayers = 0;

      // Przywróć zawodników
      for (const player of backupData.players) {
        try {
          setRestoreStatus(`Przywracam zawodnika: ${getPlayerName(player)}`);

          // Zapisz zawodnika do kolekcji players
          await setDoc(doc(getDB(), "players", player.id), {
            ...player,
            // Upewnij się że teams to tablica
            teams: Array.isArray(player.teams) ? player.teams : [player.teams].filter(Boolean)
          });

          restoredPlayers++;
          const progress = Math.round((restoredPlayers / totalPlayers) * 100);
          setRestoreProgress(progress);

          console.log(`✅ Przywrócono zawodnika ${getPlayerName(player)} (${restoredPlayers}/${totalPlayers})`);

        } catch (playerError) {
          console.error(`❌ Błąd podczas przywracania zawodnika ${getPlayerName(player)}:`, playerError);
          // Kontynuuj z następnym zawodnikiem
        }
      }

      setRestoreStatus("✅ Przywracanie zakończone pomyślnie!");
      console.log("🎉 Przywracanie danych zakończone pomyślnie!");
      
      // Odśwież dane
      await loadData();
      
      alert(`🎉 Przywracanie zakończone!\n\nPrzywrócono ${restoredPlayers} zawodników z kopii zapasowej.\n\nDane zostały załadowane ponownie.`);

    } catch (err) {
      console.error("❌ Błąd podczas przywracania kopii zapasowej:", err);
      setError(err instanceof Error ? err.message : "Nieznany błąd przywracania");
      setRestoreStatus("❌ Przywracanie nie powiodło się!");
      alert("❌ Błąd podczas przywracania kopii zapasowej: " + (err instanceof Error ? err.message : "Nieznany błąd"));
    } finally {
      setIsRestoring(false);
    }
  };

  // Handler dla wyboru pliku
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert("Proszę wybrać plik JSON z kopią zapasową");
        return;
      }

      if (confirm(`Czy na pewno chcesz przywrócić dane z pliku "${file.name}"?\n\nTo nadpisze istniejące dane zawodników!`)) {
        restoreFromBackup(file);
      }
    }
    // Wyczyść input żeby można było wybrać ten sam plik ponownie
    event.target.value = '';
  };

  // Funkcja usuwania nowej struktury teams/{teamId}/members
  const deleteNewStructure = async () => {
    if (!confirm("Czy na pewno chcesz usunąć WSZYSTKIE dane z kolekcji teams/{teamId}/members?\n\nTo spowoduje usunięcie:\n- Wszystkich membership zawodników\n- Wszystkich danych o przynależności do zespołów\n- Wszystkich numerów zawodników w zespołach\n\nTa operacja jest NIEODWRACALNA!")) {
      return;
    }

    if (!confirm("OSTATNIE OSTRZEŻENIE!\n\nUsunięcie tej struktury oznacza powrót do starej architektury.\n\nCzy na pewno chcesz kontynuować?")) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteProgress(0);
      setError(null);
      setDeleteStatus("Skanowanie zespołów...");

      // 1. Pobierz wszystkie zespoły
      const teamsSnapshot = await getDocs(collection(getDB(), "teams"));
      
      if (teamsSnapshot.empty) {
        setDeleteStatus("Nie znaleziono zespołów do usunięcia");
        alert("Nie znaleziono zespołów w bazie danych");
        return;
      }

      console.log(`🗑️ Znaleziono ${teamsSnapshot.docs.length} zespołów`);
      setDeleteStatus(`Znaleziono ${teamsSnapshot.docs.length} zespołów. Usuwam członków...`);

      const totalTeams = teamsSnapshot.docs.length;
      let processedTeams = 0;
      let totalMembersDeleted = 0;

      // 2. Dla każdego zespołu usuń wszystkich członków
      for (const teamDoc of teamsSnapshot.docs) {
        const teamId = teamDoc.id;
        
        try {
          setDeleteStatus(`Usuwam członków z zespołu: ${teamId}`);
          
          // Pobierz wszystkich członków tego zespołu
          const membersSnapshot = await getDocs(collection(getDB(), "teams", teamId, "members"));
          
          if (!membersSnapshot.empty) {
            console.log(`🗑️ Usuwam ${membersSnapshot.docs.length} członków z zespołu ${teamId}`);
            
            // Usuń wszystkich członków
            await Promise.all(
              membersSnapshot.docs.map(async (memberDoc) => {
                await deleteDoc(memberDoc.ref);
                totalMembersDeleted++;
              })
            );
            
            console.log(`✅ Usunięto ${membersSnapshot.docs.length} członków z zespołu ${teamId}`);
          } else {
            console.log(`ℹ️ Zespół ${teamId} nie ma członków do usunięcia`);
          }
          
          processedTeams++;
          const progress = Math.round((processedTeams / totalTeams) * 100);
          setDeleteProgress(progress);
          
        } catch (teamError) {
          console.error(`❌ Błąd podczas usuwania członków z zespołu ${teamId}:`, teamError);
          // Kontynuuj z następnym zespołem
        }
      }

      setDeleteStatus("✅ Usuwanie zakończone pomyślnie!");
      console.log("🎉 Usuwanie nowej struktury zakończone pomyślnie!");
      
      // Odśwież dane żeby pokazać że nowa struktura została usunięta
      await loadData();
      
      alert(`🎉 Usuwanie zakończone!\n\nUsunięto ${totalMembersDeleted} członków z ${processedTeams} zespołów.\n\nAplikacja powróciła do starej architektury.`);

    } catch (err) {
      console.error("❌ Błąd podczas usuwania nowej struktury:", err);
      setError(err instanceof Error ? err.message : "Nieznany błąd usuwania");
      setDeleteStatus("❌ Usuwanie nie powiodło się!");
      alert("❌ Błąd podczas usuwania nowej struktury: " + (err instanceof Error ? err.message : "Nieznany błąd"));
    } finally {
      setIsDeleting(false);
    }
  };

  const runMigration = async () => {
    if (!players.length || !analysis) {
      alert("Najpierw przeprowadź analizę!");
      return;
    }

    if (!confirm("Czy na pewno chcesz uruchomić migrację?\n\nTo proces nieodwracalny. Upewnij się, że masz backup danych!")) {
      return;
    }

    try {
      setIsMigrating(true);
      setMigrationProgress(0);
      setError(null);

      console.log("🚀 Rozpoczynam migrację danych...");
      setMigrationStatus("Rozpoczynam migrację...");

      const totalPlayers = players.length;
      let processedPlayers = 0;

      for (const oldPlayer of players) {
        try {
          setMigrationStatus(`Migruję zawodnika: ${getPlayerName(oldPlayer)}`);

          // 1. Utwórz nowego zawodnika w głównej kolekcji players
          const now = new Date();
          const newPlayerData: Omit<NewPlayer, "id"> = {
            firstName: oldPlayer.firstName || (oldPlayer.name ? oldPlayer.name.split(' ')[0] : '') || 'Brak',
            lastName: oldPlayer.lastName || (oldPlayer.name ? oldPlayer.name.split(' ').slice(1).join(' ') : '') || 'imienia',
            name: oldPlayer.name, // Zachowaj dla kompatybilności
            birthYear: oldPlayer.birthYear,
            imageUrl: oldPlayer.imageUrl,
            position: oldPlayer.position || 'CB', // Domyślna pozycja
            createdAt: now,
            updatedAt: now
          };

          // Usuń puste pola
          Object.keys(newPlayerData).forEach(key => {
            if (newPlayerData[key as keyof typeof newPlayerData] === undefined) {
              delete newPlayerData[key as keyof typeof newPlayerData];
            }
          });

          // Zapisz nowego zawodnika (używamy tego samego ID)
          await setDoc(doc(getDB(), "players", oldPlayer.id), newPlayerData);

          // 2. Utwórz membership w każdym zespole
          const teams = oldPlayer.teams || [];
          for (const teamId of teams) {
            const membershipData: TeamMembership = {
              playerId: oldPlayer.id,
              number: oldPlayer.number || 0, // Domyślny numer
              joinDate: now,
              status: 'active',
              notes: `Zmigrowano z starej struktury ${now.toISOString()}`
            };

            // Zapisz membership w zespole
            await setDoc(doc(getDB(), "teams", teamId, "members", oldPlayer.id), membershipData);
          }

          processedPlayers++;
          const progress = Math.round((processedPlayers / totalPlayers) * 100);
          setMigrationProgress(progress);

          console.log(`✅ Zmigrowano zawodnika ${getPlayerName(oldPlayer)} (${processedPlayers}/${totalPlayers})`);

        } catch (playerError) {
          console.error(`❌ Błąd podczas migracji zawodnika ${getPlayerName(oldPlayer)}:`, playerError);
          throw new Error(`Błąd migracji zawodnika ${getPlayerName(oldPlayer)}: ${playerError}`);
        }
      }

      setMigrationStatus("✅ Migracja zakończona pomyślnie!");
      setIsMigrated(true);
      console.log("🎉 Migracja danych zakończona pomyślnie!");
      
      alert(`🎉 Migracja zakończona!\n\nZmigrowano ${processedPlayers} zawodników do nowej struktury.\n\nTeraz możesz używać aplikacji z nową architekturą.`);

    } catch (err) {
      console.error("❌ Błąd podczas migracji:", err);
      setError(err instanceof Error ? err.message : "Nieznany błąd migracji");
      setMigrationStatus("❌ Migracja nie powiodła się!");
    } finally {
      setIsMigrating(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "20px" }}>Ładowanie...</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Brak uprawnień</h1>
        <p>Tylko administratorzy mają dostęp do analizy migracji.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link href="/admin" style={{ color: "#007bff", textDecoration: "none" }}>
          ← Powrót do panelu admin
        </Link>
      </div>

      <h1>🔄 Analiza danych przed migracją</h1>
      
      {/* Wyjaśnienie struktury danych */}
      <div style={{
        backgroundColor: "#e7f3ff",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "20px"
      }}>
        <h2>📋 Różnice między strukturami danych</h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "15px" }}>
          <div style={{ backgroundColor: "#fff3cd", padding: "15px", borderRadius: "8px" }}>
            <h3>🗂️ STARA STRUKTURA (aktualna)</h3>
            <code style={{ display: "block", whiteSpace: "pre-wrap", fontSize: "12px", backgroundColor: "#f8f9fa", padding: "10px", borderRadius: "4px" }}>
{`players/{playerId} {
  id: "abc123",
  firstName: "Jan",
  lastName: "Kowalski", 
  name: "Jan Kowalski",
  number: 10,
  position: "CM",
  teams: ["team1", "team2"],
  birthYear: 1995,
  imageUrl: "...",
  
  // DUPLIKATY DANYCH:
  actionsSent: [...],
  actionsReceived: [...],
  matchesInfo: [...]
}`}
            </code>
            <p style={{ marginTop: "10px", fontSize: "14px" }}>
              ❌ <strong>Problemy:</strong> Duplikaty danych, jeden numer dla wszystkich zespołów, 
              trudne zarządzanie transferami
            </p>
          </div>
          
          <div style={{ backgroundColor: "#d4edda", padding: "15px", borderRadius: "8px" }}>
            <h3>🆕 NOWA STRUKTURA (po migracji)</h3>
            <code style={{ display: "block", whiteSpace: "pre-wrap", fontSize: "12px", backgroundColor: "#f8f9fa", padding: "10px", borderRadius: "4px" }}>
{`players/{playerId} {
  id: "abc123",
  firstName: "Jan",
  lastName: "Kowalski",
  name: "Jan Kowalski", 
  position: "CM",
  birthYear: 1995,
  imageUrl: "...",
  createdAt: timestamp,
  updatedAt: timestamp
}

teams/{teamId}/members/{playerId} {
  playerId: "abc123",
  number: 10,
  joinDate: timestamp,
  status: "active",
  notes: "..."
}`}
            </code>
            <p style={{ marginTop: "10px", fontSize: "14px" }}>
              ✅ <strong>Korzyści:</strong> Bez duplikatów, różne numery w różnych zespołach, 
              historia transferów, lepsze zarządzanie
            </p>
          </div>
        </div>
        
        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#d1ecf1", borderRadius: "8px" }}>
          <h4>🔄 Jak działa migracja:</h4>
          <ol>
            <li><strong>Przepisuje dane zawodnika</strong> do <code>players/</code> (bez numeru, bez teams)</li>
            <li><strong>Tworzy membership</strong> w każdym zespole w <code>teams/&#123;teamId&#125;/members/</code></li>
            <li><strong>Hook hybrydowy</strong> łączy dane z powrotem dla UI</li>
            <li><strong>Usuwa duplikaty</strong> actionsSent, actionsReceived, matchesInfo</li>
          </ol>
        </div>
      </div>
      
      <div style={{ marginBottom: "30px" }}>
        <button
          onClick={loadData}
          disabled={isAnalyzing}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isAnalyzing ? "not-allowed" : "pointer",
            marginRight: "10px"
          }}
        >
          {isAnalyzing ? "Analizuję..." : "🔍 Przeprowadź analizę"}
        </button>

        {analysis && (
          <>
            <button
              onClick={createBackup}
              style={{
                padding: "10px 20px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "10px"
              }}
            >
              💾 Pobierz backup
            </button>
            
            <label
              style={{
                padding: "10px 20px",
                backgroundColor: "#ffc107",
                color: "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "10px",
                display: "inline-block"
              }}
            >
              📥 Przywróć z backup
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isRestoring}
                style={{
                  display: "none"
                }}
              />
            </label>
            
            <button
              onClick={deleteNewStructure}
              disabled={isDeleting}
              style={{
                padding: "10px 20px",
                backgroundColor: isDeleting ? "#6c757d" : "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isDeleting ? "not-allowed" : "pointer",
                marginRight: "10px"
              }}
            >
              {isDeleting ? "🗑️ Usuwam..." : "🗑️ Usuń nową strukturę"}
            </button>
            
            {analysis.issues.length === 0 && !isMigrated && (
              <button
                onClick={runMigration}
                disabled={isMigrating}
                style={{
                  padding: "10px 20px",
                  backgroundColor: isMigrating ? "#6c757d" : "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isMigrating ? "not-allowed" : "pointer"
                }}
              >
                {isMigrating ? "🔄 Migruję..." : "🚀 Uruchom migrację"}
              </button>
            )}

            {isMigrated && (
              <span style={{
                padding: "10px 20px",
                backgroundColor: "#d4edda",
                color: "#155724",
                border: "1px solid #c3e6cb",
                borderRadius: "4px",
                fontWeight: "bold"
              }}>
                ✅ Migracja zakończona!
              </span>
            )}
          </>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: "#f8d7da", 
          color: "#721c24", 
          padding: "15px", 
          borderRadius: "4px", 
          marginBottom: "20px" 
        }}>
          ❌ Błąd: {error}
        </div>
      )}

      {/* Pasek postępu przywracania */}
      {isRestoring && (
        <div style={{ 
          backgroundColor: "#fff3cd", 
          padding: "20px", 
          borderRadius: "8px", 
          marginBottom: "20px" 
        }}>
          <h3>📥 Przywracanie kopii zapasowej</h3>
          <p><strong>Status:</strong> {restoreStatus}</p>
          <div style={{ 
            width: "100%", 
            backgroundColor: "#e9ecef", 
            borderRadius: "4px", 
            overflow: "hidden",
            marginTop: "10px"
          }}>
            <div style={{
              width: `${restoreProgress}%`,
              height: "20px",
              backgroundColor: "#ffc107",
              transition: "width 0.3s ease"
            }} />
          </div>
          <p style={{ marginTop: "5px", fontSize: "0.9em" }}>{restoreProgress}% zakończone</p>
        </div>
      )}

      {/* Pasek postępu usuwania */}
      {isDeleting && (
        <div style={{ 
          backgroundColor: "#f8d7da", 
          padding: "20px", 
          borderRadius: "8px", 
          marginBottom: "20px" 
        }}>
          <h3>🗑️ Usuwanie nowej struktury</h3>
          <p><strong>Status:</strong> {deleteStatus}</p>
          <div style={{ 
            width: "100%", 
            backgroundColor: "#e9ecef", 
            borderRadius: "4px", 
            overflow: "hidden",
            marginTop: "10px"
          }}>
            <div style={{
              width: `${deleteProgress}%`,
              height: "20px",
              backgroundColor: "#dc3545",
              transition: "width 0.3s ease"
            }} />
          </div>
          <p style={{ marginTop: "5px", fontSize: "0.9em" }}>{deleteProgress}% zakończone</p>
        </div>
      )}

      {/* Pasek postępu migracji */}
      {isMigrating && (
        <div style={{ 
          backgroundColor: "#e7f3ff", 
          padding: "20px", 
          borderRadius: "8px", 
          marginBottom: "20px" 
        }}>
          <h3>🚀 Migracja w toku...</h3>
          <p><strong>Status:</strong> {migrationStatus}</p>
          <div style={{ 
            width: "100%", 
            backgroundColor: "#e9ecef", 
            borderRadius: "4px", 
            overflow: "hidden",
            marginTop: "10px"
          }}>
            <div style={{
              width: `${migrationProgress}%`,
              height: "20px",
              backgroundColor: "#007bff",
              transition: "width 0.3s ease"
            }} />
          </div>
          <p style={{ marginTop: "5px", fontSize: "0.9em" }}>{migrationProgress}% zakończone</p>
        </div>
      )}

      {analysis && (
        <div>
          <h2>📊 Wyniki analizy</h2>
          
          {/* Przykład transformacji danych */}
          {players.length > 0 && (
            <div style={{ 
              backgroundColor: "#f8f9fa", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h3>🔍 Przykład transformacji danych</h3>
              <p>Tak będzie wyglądać transformacja pierwszego zawodnika:</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "15px" }}>
                <div>
                  <h4 style={{ color: "#856404" }}>PRZED migracją (stara struktura):</h4>
                  <code style={{ display: "block", whiteSpace: "pre-wrap", fontSize: "11px", backgroundColor: "#fff3cd", padding: "10px", borderRadius: "4px" }}>
                    {JSON.stringify({
                      id: players[0].id,
                      firstName: players[0].firstName,
                      lastName: players[0].lastName,
                      name: players[0].name,
                      number: players[0].number,
                      position: players[0].position,
                      teams: players[0].teams,
                      birthYear: players[0].birthYear,
                      imageUrl: players[0].imageUrl ? "url..." : undefined
                    }, null, 2)}
                  </code>
                </div>
                
                <div>
                  <h4 style={{ color: "#155724" }}>PO migracji (nowa struktura):</h4>
                  <div style={{ fontSize: "11px" }}>
                    <div style={{ marginBottom: "10px" }}>
                      <strong>players/{players[0].id}</strong>
                      <code style={{ display: "block", whiteSpace: "pre-wrap", backgroundColor: "#d4edda", padding: "8px", borderRadius: "4px" }}>
                        {JSON.stringify({
                          id: players[0].id,
                          firstName: players[0].firstName || (players[0].name ? players[0].name.split(' ')[0] : 'Brak'),
                          lastName: players[0].lastName || (players[0].name ? players[0].name.split(' ').slice(1).join(' ') : 'imienia'),
                          name: players[0].name,
                          position: players[0].position || 'CB',
                          birthYear: players[0].birthYear,
                          imageUrl: players[0].imageUrl,
                          createdAt: "timestamp",
                          updatedAt: "timestamp"
                        }, null, 2)}
                      </code>
                    </div>
                    
                    {players[0].teams && players[0].teams.map(teamId => (
                      <div key={teamId} style={{ marginBottom: "8px" }}>
                        <strong>teams/{teamId}/members/{players[0].id}</strong>
                        <code style={{ display: "block", whiteSpace: "pre-wrap", backgroundColor: "#d1ecf1", padding: "8px", borderRadius: "4px" }}>
                          {JSON.stringify({
                            playerId: players[0].id,
                            number: players[0].number || 0,
                            joinDate: "timestamp",
                            status: "active",
                            notes: "Zmigrowano z starej struktury"
                          }, null, 2)}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Ogólne statystyki */}
          <div style={{ 
            backgroundColor: "#e7f3ff", 
            padding: "20px", 
            borderRadius: "8px", 
            marginBottom: "20px" 
          }}>
            <h3>📈 Ogólne statystyki</h3>
            <p><strong>Zawodników ogółem:</strong> {analysis.totalPlayers}</p>
            <p><strong>Zawodników z zespołami:</strong> {analysis.playersWithTeams}</p>
            <p><strong>Zawodników bez zespołów:</strong> {analysis.totalPlayers - analysis.playersWithTeams}</p>
            <p><strong>Zawodników w wielu zespołach:</strong> {analysis.multiTeamPlayers.length}</p>
          </div>

          {/* Rozkład zespołów */}
          <div style={{ 
            backgroundColor: "#fff3cd", 
            padding: "20px", 
            borderRadius: "8px", 
            marginBottom: "20px" 
          }}>
            <h3>🏆 Rozkład w zespołach</h3>
            {Object.entries(analysis.teamDistribution).map(([teamId, count]) => (
              <p key={teamId}><strong>{teamId}:</strong> {count} zawodników</p>
            ))}
          </div>

          {/* Zawodnicy w wielu zespołach */}
          {analysis.multiTeamPlayers.length > 0 && (
            <div style={{ 
              backgroundColor: "#d1ecf1", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h3>👥 Zawodnicy w wielu zespołach ({analysis.multiTeamPlayers.length})</h3>
              {analysis.multiTeamPlayers.map(({ player, teams }) => (
                <div key={player.id} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "white", borderRadius: "4px" }}>
                  <strong>{getPlayerName(player)}</strong> (#{player.number})
                  <br />
                  <span style={{ color: "#666" }}>Zespoły: {teams.join(", ")}</span>
                  <br />
                  <span style={{ fontSize: "0.9em", color: "#888" }}>ID: {player.id}</span>
                </div>
              ))}
            </div>
          )}

          {/* Duplikaty numerów */}
          {analysis.duplicateNumbers.length > 0 && (
            <div style={{ 
              backgroundColor: "#f8d7da", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h3>⚠️ Duplikaty numerów w zespołach</h3>
              {analysis.duplicateNumbers.map((dup, index) => (
                <p key={index}>
                  <strong>Zespół {dup.teamId}, numer {dup.number}:</strong> {dup.players.join(", ")}
                </p>
              ))}
            </div>
          )}

          {/* Brakujące dane */}
          {analysis.missingData.length > 0 && (
            <div style={{ 
              backgroundColor: "#f8d7da", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h3>❌ Brakujące dane</h3>
              {analysis.missingData.slice(0, 10).map((item, index) => (
                <p key={index}>
                  <strong>{item.playerId}:</strong> brak {item.missing.join(", ")}
                </p>
              ))}
              {analysis.missingData.length > 10 && (
                <p><em>... i {analysis.missingData.length - 10} więcej problemów</em></p>
              )}
            </div>
          )}

          {/* Problemy */}
          {analysis.issues.length > 0 && (
            <div style={{ 
              backgroundColor: "#f8d7da", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h3>🚨 Znalezione problemy</h3>
              {analysis.issues.slice(0, 10).map((issue, index) => (
                <p key={index}>{issue}</p>
              ))}
              {analysis.issues.length > 10 && (
                <p><em>... i {analysis.issues.length - 10} więcej problemów</em></p>
              )}
            </div>
          )}

          {/* Podsumowanie gotowości */}
          <div style={{ 
            backgroundColor: analysis.issues.length === 0 ? "#d4edda" : "#fff3cd", 
            padding: "20px", 
            borderRadius: "8px", 
            marginBottom: "20px" 
          }}>
            <h3>🎯 Ocena gotowości do migracji</h3>
            {analysis.issues.length === 0 ? (
              <div>
                <p style={{ color: "#155724", fontWeight: "bold" }}>✅ Dane są gotowe do migracji!</p>
                <p>Wszyscy zawodnicy mają przypisane zespoły i podstawowe dane.</p>
                <p><strong>Korzyści migracji:</strong></p>
                <ul>
                  <li>Zawodnicy w {analysis.multiTeamPlayers.length} przypadkach będą mogli mieć różne numery w różnych zespołach</li>
                  <li>Lepsze zarządzanie statusem członkostwa (aktywny/wypożyczony/zawieszony)</li>
                  <li>Szybsze zapytania do bazy danych</li>
                  <li>Historia transferów i dat dołączenia do zespołów</li>
                </ul>
              </div>
            ) : (
              <div>
                <p style={{ color: "#856404", fontWeight: "bold" }}>⚠️ Znaleziono {analysis.issues.length} problemów</p>
                <p>Zalecane jest naprawienie kluczowych problemów przed migracją.</p>
              </div>
            )}
          </div>

          <div style={{ 
            backgroundColor: "#e2e3e5", 
            padding: "20px", 
            borderRadius: "8px" 
          }}>
            <h3>📝 Następne kroki</h3>
            <ol>
              <li>Pobierz backup danych (przycisk powyżej)</li>
              <li>Jeśli analiza pokazuje gotowość - możesz przejść do migracji</li>
              <li>Jeśli są problemy - popraw je w aplikacji i ponów analizę</li>
              <li>Migracja zachowa wszystkich zawodników w wielu zespołach</li>
              <li>Po migracji każdy zespół będzie miał swoje subcollection members/</li>
            </ol>
          </div>
          
          <div style={{ 
            backgroundColor: "#d1ecf1", 
            padding: "20px", 
            borderRadius: "8px",
            marginTop: "20px"
          }}>
            <h3>🔄 Hook hybrydowy - jak działa po migracji</h3>
            <p>Po migracji aplikacja używa "hooka hybrydowego" który:</p>
            <ul>
              <li>🔍 <strong>Najpierw sprawdza</strong> czy istnieją dane w nowej strukturze <code>teams/*/members/</code></li>
              <li>📊 <strong>Łączy dane</strong> z <code>players/</code> (imię, nazwisko, pozycja) + <code>teams/*/members/</code> (numer, status)</li>
              <li>🔄 <strong>Jeśli nowa struktura pusta</strong>, używa starej struktury <code>players.teams[]</code> jako fallback</li>
              <li>🎯 <strong>Zwraca do UI</strong> standardowy format Player - UI nie wie z jakiej struktury pochodzą dane</li>
            </ul>
            
            <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
              <h4>🛡️ Bezpieczne przejście:</h4>
              <p>Dzięki temu rozwiązaniu:</p>
              <ul>
                <li>✅ Aplikacja działa przed, podczas i po migracji</li>
                <li>✅ Możesz przywrócić stare dane z backup jeśli potrzebujesz</li>
                <li>✅ Nie ma ryzyka utraty danych</li>
                <li>✅ Stopniowe przejście na nową architekturę</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 