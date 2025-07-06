const { initializeApp } = require("firebase/app");
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  writeBatch,
  query, 
  where 
} = require("firebase/firestore");
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

// Konfiguracja Firebase (z zmiennych środowiskowych)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Sprawdź czy wszystkie zmienne są ustawione
const missingVars = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Brakuje zmiennych środowiskowych:', missingVars.join(', '));
  console.error('💡 Sprawdź plik .env.local');
  process.exit(1);
}

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('✅ Połączono z Firebase:', firebaseConfig.projectId);

// Funkcja backup
async function createBackup() {
  console.log('🔄 Tworzenie backup istniejących danych...');
  
  try {
    // Backup zawodników
    const playersSnapshot = await getDocs(collection(db, "players"));
    const playersBackup = [];
    
    playersSnapshot.docs.forEach(doc => {
      playersBackup.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Backup meczów (dla weryfikacji)
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    const matchesBackup = [];
    
    matchesSnapshot.docs.forEach(doc => {
      matchesBackup.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Backup zespołów
    const teamsSnapshot = await getDocs(collection(db, "teams"));
    const teamsBackup = [];
    
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
      teams: teamsBackup,
      timestamp
    };
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia backup:', error);
    throw error;
  }
}

// Funkcja walidacji
async function validateData(players) {
  console.log('🔍 Walidacja danych przed migracją...');
  
  const issues = [];
  const stats = {
    totalPlayers: players.length,
    playersWithTeams: 0,
    teamDistribution: {},
    duplicateNumbers: [],
    missingData: []
  };

  for (const player of players) {
    // Sprawdź czy zawodnik ma zespoły
    if (!player.teams || player.teams.length === 0) {
      issues.push(`⚠️ Zawodnik ${player.firstName || player.name} ${player.lastName || ''} (${player.id}) nie ma przypisanych zespołów`);
    } else {
      stats.playersWithTeams++;
      
      // Statystyki zespołów
      for (const teamId of player.teams) {
        stats.teamDistribution[teamId] = (stats.teamDistribution[teamId] || 0) + 1;
      }
    }

    // Sprawdź brakujące dane
    const missing = [];
    if (!player.firstName && !player.name) missing.push('firstName/name');
    if (!player.lastName && !player.name) missing.push('lastName');
    if (!player.number) missing.push('number');
    
    if (missing.length > 0) {
      stats.missingData.push({ playerId: player.id, missing });
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

  if (stats.missingData.length > 0) {
    console.log('\n❌ BRAKUJĄCE DANE:');
    stats.missingData.slice(0, 5).forEach(item => { // Pokazuj tylko pierwsze 5
      console.log(`   ${item.playerId}: brak ${item.missing.join(', ')}`);
    });
    if (stats.missingData.length > 5) {
      console.log(`   ... i ${stats.missingData.length - 5} więcej`);
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠️ ZNALEZIONE PROBLEMY:');
    issues.slice(0, 5).forEach(issue => console.log(issue)); // Pokazuj tylko pierwsze 5
    if (issues.length > 5) {
      console.log(`   ... i ${issues.length - 5} więcej problemów`);
    }
  }

  return { issues, stats };
}

// Funkcja migracji (DRY RUN)
async function migratePlayersDryRun(players) {
  console.log(`\n🧪 [DRY RUN] Symulacja migracji ${players.length} zawodników...`);
  
  const migrationLog = [];
  const teamMemberships = {};

  for (const player of players) {
    if (!player.teams || player.teams.length === 0) {
      migrationLog.push(`⚠️ Pominięto: ${player.firstName || player.name} ${player.lastName || ''} - brak zespołów`);
      continue;
    }

    // Parsuj imię i nazwisko
    let firstName = player.firstName || "";
    let lastName = player.lastName || "";
    
    if (!firstName && !lastName && player.name) {
      const nameParts = player.name.trim().split(/\s+/);
      firstName = nameParts[0] || "";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Utwórz podstawowe dane zawodnika (bez teams)
    const newPlayer = {
      id: player.id,
      firstName: firstName,
      lastName: lastName,
      name: player.name || `${firstName} ${lastName}`.trim(),
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

      const membership = {
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

    migrationLog.push(`✅ [DRY RUN] Zawodnik: ${firstName} ${lastName} → teams: ${player.teams.join(', ')}`);
  }

  // Pokaż statystyki zespołów
  for (const [teamId, memberships] of Object.entries(teamMemberships)) {
    migrationLog.push(`\n🏆 Zespół ${teamId}: ${memberships.length} członków`);
    memberships.slice(0, 3).forEach(({ player }) => {
      migrationLog.push(`   - ${player.firstName} ${player.lastName}`);
    });
    if (memberships.length > 3) {
      migrationLog.push(`   ... i ${memberships.length - 3} więcej`);
    }
  }

  console.log('\n📋 LOG MIGRACJI (próbka):');
  migrationLog.slice(0, 20).forEach(log => console.log(log));
  if (migrationLog.length > 20) {
    console.log(`... i ${migrationLog.length - 20} więcej wpisów`);
  }

  return { teamMemberships, migrationLog };
}

// Główna funkcja
async function main() {
  try {
    console.log('🚀 Rozpoczynam analizę danych dla migracji...\n');

    // Krok 1: Backup
    const backupData = await createBackup();
    
    // Krok 2: Walidacja
    const { issues, stats } = await validateData(backupData.players);
    
    if (issues.length > 20) {
      console.log('\n❌ Zbyt wiele problemów w danych. Przerwanie migracji.');
      console.log('💡 Popraw krytyczne problemy i uruchom ponownie.');
      return;
    }

    // Krok 3: Dry run
    const { teamMemberships } = await migratePlayersDryRun(backupData.players);
    
    // Podsumowanie
    console.log('\n📊 PODSUMOWANIE ANALIZY:');
    console.log(`✅ Zawodników do migracji: ${stats.playersWithTeams}`);
    console.log(`🏆 Zespołów: ${Object.keys(stats.teamDistribution).length}`);
    console.log(`📦 Członkostw do utworzenia: ${Object.values(teamMemberships).reduce((sum, members) => sum + members.length, 0)}`);
    console.log(`💾 Backup zapisany z timestampem: ${backupData.timestamp}`);
    
    if (issues.length === 0) {
      console.log('\n🎯 Dane są gotowe do migracji!');
      console.log('📝 Następny krok: uruchom prawdziwą migrację z parametrem --execute');
    } else {
      console.log(`\n⚠️ Znaleziono ${issues.length} problemów - sprawdź je przed migracją`);
    }
    
  } catch (error) {
    console.error('❌ Błąd podczas analizy:', error);
    console.log('\n🆘 W przypadku problemów sprawdź:');
    console.log('1. Połączenie z internetem');
    console.log('2. Konfigurację Firebase w .env.local');
    console.log('3. Uprawnienia do bazy danych');
  }
}

// Uruchom
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Analiza zakończona');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Krytyczny błąd:', error);
    process.exit(1);
  });
} 