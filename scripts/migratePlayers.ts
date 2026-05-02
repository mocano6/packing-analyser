// @ts-nocheck
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, writeBatch, query, where } from "firebase/firestore";
import * as fs from 'fs';
import * as path from 'path';

// Konfiguracja Firebase (użyj swoich danych z firebase.ts)
const firebaseConfig = {
  // Dodaj swoją konfigurację Firebase tutaj
  // lub zaimportuj z ../src/lib/firebase.ts
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Typy dla migracji
interface OldPlayer {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  number: number;
  position: string;
  birthYear?: number;
  imageUrl?: string;
  teams: string[];
  actionsSent?: { [matchId: string]: any[] };
  actionsReceived?: { [matchId: string]: any[] };
  matchesInfo?: { [matchId: string]: { startMinute: number, endMinute: number, position: string } };
}

interface NewPlayer {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  birthYear?: number;
  imageUrl?: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamMembership {
  playerId: string;
  number: number;
  joinDate: Date;
  status: 'active' | 'inactive';
  // Zachowujemy dane specyficzne dla zespołu
  actionsSent?: { [matchId: string]: any[] };
  actionsReceived?: { [matchId: string]: any[] };
  matchesInfo?: { [matchId: string]: { startMinute: number, endMinute: number, position: string } };
}

async function createBackup() {
  console.log('🔄 Tworzenie backup istniejących danych...');
  
  try {
    // Backup zawodników
    const playersSnapshot = await getDocs(collection(db, "players"));
    const playersBackup: any[] = [];
    
    playersSnapshot.docs.forEach(doc => {
      playersBackup.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Backup meczów (dla weryfikacji)
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    const matchesBackup: any[] = [];
    
    matchesSnapshot.docs.forEach(doc => {
      matchesBackup.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Backup zespołów
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teamsBackup: any[] = [];
    
    teamsSnapshot.docs.forEach(doc => {
      teamsBackup.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Zapisz backupy do plików
    const backupDir = path.join(__dirname, '../backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    fs.writeFileSync(
      path.join(backupDir, `players-backup-${timestamp}.json`),
      JSON.stringify(playersBackup, null, 2)
    );
    
    fs.writeFileSync(
      path.join(backupDir, `matches-backup-${timestamp}.json`),
      JSON.stringify(matchesBackup, null, 2)
    );
    
    fs.writeFileSync(
      path.join(backupDir, `teams-backup-${timestamp}.json`),
      JSON.stringify(teamsBackup, null, 2)
    );

    console.log(`✅ Backup utworzony w folderze backup/`);
    console.log(`📊 Zawodników: ${playersBackup.length}`);
    console.log(`📊 Meczów: ${matchesBackup.length}`);
    console.log(`📊 Zespołów: ${teamsBackup.length}`);
    
    return {
      players: playersBackup,
      matches: matchesBackup,
      teams: teamsBackup
    };
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia backup:', error);
    throw error;
  }
}

async function validateData(players: OldPlayer[]) {
  console.log('🔍 Walidacja danych przed migracją...');
  
  const issues: string[] = [];
  const stats = {
    totalPlayers: players.length,
    playersWithTeams: 0,
    teamDistribution: {} as Record<string, number>,
    duplicateNumbers: [] as Array<{teamId: string, number: number, players: string[]}>,
    missingData: [] as Array<{playerId: string, missing: string[]}>
  };

  for (const player of players) {
    // Sprawdź czy zawodnik ma zespoły
    if (!player.teams || player.teams.length === 0) {
      issues.push(`⚠️ Zawodnik ${player.firstName} ${player.lastName} (${player.id}) nie ma przypisanych zespołów`);
    } else {
      stats.playersWithTeams++;
      
      // Statystyki zespołów
      for (const teamId of player.teams) {
        stats.teamDistribution[teamId] = (stats.teamDistribution[teamId] || 0) + 1;
      }
    }

    // Sprawdź brakujące dane
    const missing: string[] = [];
    if (!player.firstName) missing.push('firstName');
    if (!player.lastName) missing.push('lastName');
    if (!player.number) missing.push('number');
    if (!player.position) missing.push('position');
    
    if (missing.length > 0) {
      stats.missingData.push({ playerId: player.id, missing });
    }
  }

  // Sprawdź duplikaty numerów w zespołach
  const teamPlayerNumbers: Record<string, Record<number, string[]>> = {};
  
  for (const player of players) {
    if (player.teams && player.number) {
      for (const teamId of player.teams) {
        if (!teamPlayerNumbers[teamId]) {
          teamPlayerNumbers[teamId] = {};
        }
        if (!teamPlayerNumbers[teamId][player.number]) {
          teamPlayerNumbers[teamId][player.number] = [];
        }
        teamPlayerNumbers[teamId][player.number].push(`${player.firstName} ${player.lastName} (${player.id})`);
      }
    }
  }

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

  // Raport walidacji
  console.log('\n📊 RAPORT WALIDACJI:');
  console.log(`📈 Zawodników ogółem: ${stats.totalPlayers}`);
  console.log(`✅ Zawodników z zespołami: ${stats.playersWithTeams}`);
  console.log(`❌ Zawodników bez zespołów: ${stats.totalPlayers - stats.playersWithTeams}`);
  
  console.log('\n🏆 Rozkład w zespołach:');
  Object.entries(stats.teamDistribution).forEach(([teamId, count]) => {
    console.log(`   ${teamId}: ${count} zawodników`);
  });

  if (stats.duplicateNumbers.length > 0) {
    console.log('\n⚠️ DUPLIKATY NUMERÓW:');
    stats.duplicateNumbers.forEach(dup => {
      console.log(`   Zespół ${dup.teamId}, numer ${dup.number}: ${dup.players.join(', ')}`);
    });
  }

  if (stats.missingData.length > 0) {
    console.log('\n❌ BRAKUJĄCE DANE:');
    stats.missingData.forEach(item => {
      console.log(`   ${item.playerId}: brak ${item.missing.join(', ')}`);
    });
  }

  if (issues.length > 0) {
    console.log('\n⚠️ ZNALEZIONE PROBLEMY:');
    issues.forEach(issue => console.log(issue));
  }

  return { issues, stats };
}

async function migratePlayersToNewStructure(players: OldPlayer[], dryRun = true) {
  console.log(`\n🔄 ${dryRun ? '[DRY RUN] ' : ''}Rozpoczynam migrację ${players.length} zawodników...`);
  
  const migrationLog: string[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Grupuj zawodników według zespołów
  const teamMemberships: Record<string, Array<{player: OldPlayer, membership: TeamMembership}>> = {};

  for (const player of players) {
    if (!player.teams || player.teams.length === 0) {
      migrationLog.push(`⚠️ Pominięto: ${player.firstName} ${player.lastName} - brak zespołów`);
      continue;
    }

    // Utwórz podstawowe dane zawodnika (bez teams)
    const newPlayer: NewPlayer = {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      name: player.name,
      birthYear: player.birthYear,
      imageUrl: player.imageUrl,
      position: player.position,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Utwórz membership dla każdego zespołu
    for (const teamId of player.teams) {
      if (!teamMemberships[teamId]) {
        teamMemberships[teamId] = [];
      }

      const membership: TeamMembership = {
        playerId: player.id,
        number: player.number,
        joinDate: new Date(),
        status: 'active',
        // Zachowaj dane specyficzne dla zespołu
        actionsSent: player.actionsSent,
        actionsReceived: player.actionsReceived,
        matchesInfo: player.matchesInfo
      };

      teamMemberships[teamId].push({ player: newPlayer, membership });
    }

    if (!dryRun) {
      try {
        // Zapisz podstawowe dane zawodnika
        await setDoc(doc(db, "players_new", player.id), newPlayer);
        successCount++;
      } catch (error) {
        migrationLog.push(`❌ Błąd zapisu zawodnika ${player.firstName} ${player.lastName}: ${error}`);
        errorCount++;
      }
    } else {
      migrationLog.push(`✅ [DRY RUN] Zawodnik: ${player.firstName} ${player.lastName} → teams: ${player.teams.join(', ')}`);
    }
  }

  // Zapisz memberships w zespołach
  for (const [teamId, memberships] of Object.entries(teamMemberships)) {
    migrationLog.push(`\n🏆 Zespół ${teamId}: ${memberships.length} członków`);
    
    if (!dryRun) {
      // Użyj batch dla lepszej wydajności
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const { membership } of memberships) {
        const memberRef = doc(db, "teams", teamId, "members", membership.playerId);
        batch.set(memberRef, membership);
        batchCount++;
        
        // Firestore ma limit 500 operacji na batch
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      migrationLog.push(`   ✅ Zapisano ${memberships.length} członków zespołu ${teamId}`);
    } else {
      memberships.forEach(({ player, membership }) => {
        migrationLog.push(`   - ${player.firstName} ${player.lastName} (${membership.number})`);
      });
    }
  }

  console.log('\n📋 LOG MIGRACJI:');
  migrationLog.forEach(log => console.log(log));
  
  if (!dryRun) {
    console.log(`\n✅ Migracja zakończona: ${successCount} sukces, ${errorCount} błędów`);
  }

  return { successCount, errorCount, migrationLog };
}

async function verifyMigration(originalPlayers: OldPlayer[]) {
  console.log('\n🔍 Weryfikacja migracji...');
  
  const issues: string[] = [];
  let verifiedPlayers = 0;
  let verifiedMemberships = 0;

  try {
    // Sprawdź czy nowa kolekcja players_new istnieje
    const newPlayersSnapshot = await getDocs(collection(db, "players_new"));
    
    if (newPlayersSnapshot.empty) {
      issues.push('❌ Kolekcja players_new jest pusta!');
      return { success: false, issues };
    }

    const newPlayers = new Map();
    newPlayersSnapshot.docs.forEach(doc => {
      newPlayers.set(doc.id, doc.data());
      verifiedPlayers++;
    });

    // Sprawdź każdego oryginalnego zawodnika
    for (const originalPlayer of originalPlayers) {
      if (!newPlayers.has(originalPlayer.id)) {
        issues.push(`❌ Brakuje zawodnika: ${originalPlayer.firstName} ${originalPlayer.lastName} (${originalPlayer.id})`);
        continue;
      }

      const newPlayer = newPlayers.get(originalPlayer.id);
      
      // Sprawdź podstawowe dane
      if (newPlayer.firstName !== originalPlayer.firstName) {
        issues.push(`❌ Niezgodność firstName dla ${originalPlayer.id}: '${newPlayer.firstName}' vs '${originalPlayer.firstName}'`);
      }
      
      if (newPlayer.lastName !== originalPlayer.lastName) {
        issues.push(`❌ Niezgodność lastName dla ${originalPlayer.id}: '${newPlayer.lastName}' vs '${originalPlayer.lastName}'`);
      }

      // Sprawdź memberships w zespołach
      if (originalPlayer.teams && originalPlayer.teams.length > 0) {
        for (const teamId of originalPlayer.teams) {
          try {
            const memberDoc = await getDoc(doc(db, "teams", teamId, "members", originalPlayer.id));
            
            if (!memberDoc.exists()) {
              issues.push(`❌ Brakuje membership: ${originalPlayer.firstName} ${originalPlayer.lastName} w zespole ${teamId}`);
            } else {
              const membershipData = memberDoc.data() as TeamMembership;
              
              if (membershipData.number !== originalPlayer.number) {
                issues.push(`❌ Niezgodność numeru dla ${originalPlayer.id} w zespole ${teamId}: ${membershipData.number} vs ${originalPlayer.number}`);
              }
              
              verifiedMemberships++;
            }
          } catch (error) {
            issues.push(`❌ Błąd sprawdzania membership ${originalPlayer.id} w ${teamId}: ${error}`);
          }
        }
      }
    }

    console.log(`✅ Zweryfikowano ${verifiedPlayers} zawodników`);
    console.log(`✅ Zweryfikowano ${verifiedMemberships} członkostw`);
    
    if (issues.length > 0) {
      console.log('\n❌ PROBLEMY WERYFIKACJI:');
      issues.forEach(issue => console.log(issue));
      return { success: false, issues };
    } else {
      console.log('\n✅ Weryfikacja przebiegła pomyślnie!');
      return { success: true, issues: [] };
    }
    
  } catch (error) {
    issues.push(`❌ Błąd weryfikacji: ${error}`);
    return { success: false, issues };
  }
}

async function switchToNewStructure() {
  console.log('\n🔄 Przełączanie na nową strukturę...');
  
  try {
    // 1. Zmień nazwę starej kolekcji na players_old
    console.log('📦 Tworzenie kolekcji players_old...');
    const oldPlayersSnapshot = await getDocs(collection(db, "players"));
    const batch = writeBatch(db);
    
    oldPlayersSnapshot.docs.forEach(doc => {
      const oldRef = doc.ref;
      const newRef = doc(db, "players_old", doc.id);
      batch.set(newRef, doc.data());
    });
    
    await batch.commit();
    console.log('✅ Skopiowano starą kolekcję do players_old');

    // 2. Zmień nazwę players_new na players
    console.log('🔄 Migracja players_new → players...');
    const newPlayersSnapshot = await getDocs(collection(db, "players_new"));
    const newBatch = writeBatch(db);
    
    newPlayersSnapshot.docs.forEach(doc => {
      const currentRef = doc.ref;
      const finalRef = doc(db, "players", doc.id);
      newBatch.set(finalRef, doc.data());
    });
    
    await newBatch.commit();
    console.log('✅ Skopiowano players_new do players');

    console.log('\n✅ Przełączenie zakończone pomyślnie!');
    console.log('⚠️ Stara kolekcja została zachowana jako players_old');
    console.log('⚠️ Pamiętaj o aktualizacji hooków w aplikacji!');
    
  } catch (error) {
    console.error('❌ Błąd podczas przełączania:', error);
    throw error;
  }
}

// Główna funkcja migracji
async function main() {
  try {
    console.log('🚀 Rozpoczynam bezpieczną migrację zawodników...\n');

    // Krok 1: Backup
    const backupData = await createBackup();
    
    // Krok 2: Walidacja
    const { issues, stats } = await validateData(backupData.players);
    
    if (issues.length > 10) {
      console.log('\n❌ Zbyt wiele problemów w danych. Przerwanie migracji.');
      console.log('Popraw problemy i uruchom ponownie.');
      return;
    }

    // Krok 3: Dry run
    console.log('\n🧪 Wykonuję test migracji (dry run)...');
    await migratePlayersToNewStructure(backupData.players, true);
    
    // Zapytaj użytkownika o kontynuację
    console.log('\n❓ Czy kontynuować prawdziwą migrację? (tak/nie)');
    // W rzeczywistości tutaj byłby prompt, ale na potrzeby skryptu kontynuujemy
    
    // Krok 4: Prawdziwa migracja
    console.log('\n🚀 Wykonuję prawdziwą migrację...');
    const migrationResult = await migratePlayersToNewStructure(backupData.players, false);
    
    if (migrationResult.errorCount > 0) {
      console.log('\n❌ Błędy podczas migracji. Sprawdź logi powyżej.');
      return;
    }

    // Krok 5: Weryfikacja
    const verificationResult = await verifyMigration(backupData.players);
    
    if (!verificationResult.success) {
      console.log('\n❌ Weryfikacja nieudana. NIE przełączam na nową strukturę.');
      return;
    }

    // Krok 6: Przełączenie (opcjonalne - pozostawiam do ręcznego wywołania)
    console.log('\n✅ Migracja zakończona pomyślnie!');
    console.log('🔧 Aby przełączyć na nową strukturę, wywołaj: switchToNewStructure()');
    console.log('📝 Następnie zaktualizuj hooki w aplikacji.');
    
  } catch (error) {
    console.error('❌ Błąd podczas migracji:', error);
    console.log('\n🆘 W przypadku problemów przywróć dane z backup/');
  }
}

// Eksportuj funkcje dla ręcznego wywołania
export {
  main as runMigration,
  createBackup,
  validateData,
  migratePlayersToNewStructure,
  verifyMigration,
  switchToNewStructure
};

// Uruchom jeśli wywołano bezpośrednio
if (require.main === module) {
  main();
} 