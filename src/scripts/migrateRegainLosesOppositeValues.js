// src/scripts/migrateRegainLosesOppositeValues.js
// Skrypt migracji - dodaje brakujące wartości oppositeXT, oppositeZone i isAttack do istniejących akcji regain i loses

/**
 * Ten skrypt należy uruchomić jednorazowo, aby uzupełnić brakujące wartości w akcjach regain i loses.
 * Użyj: node src/scripts/migrateRegainLosesOppositeValues.js
 * 
 * Wymagania:
 * - Firebase Admin SDK (firebase-admin)
 * - Zmienna środowiskowa GOOGLE_APPLICATION_CREDENTIALS wskazująca na plik service account key
 *   LUB zmienne środowiskowe z konfiguracją Firebase
 */

// Załaduj zmienne środowiskowe
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // Ignoruj jeśli plik nie istnieje
}
try {
  require('dotenv').config({ path: '.env' });
} catch (e) {
  // Ignoruj jeśli plik nie istnieje
}

const admin = require('firebase-admin');

// Inicjalizacja Firebase Admin SDK
let db;

// Funkcja pomocnicza do sprawdzania czy plik istnieje
const fs = require('fs');
const path = require('path');

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

try {
  let initialized = false;
  
  // Sprawdź czy jest service account key w zmiennej środowiskowej
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fileExists(keyPath)) {
      try {
        const serviceAccount = require(keyPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
        });
        console.log('✅ Firebase Admin SDK zainicjalizowany z service account key');
        initialized = true;
      } catch (error) {
        console.warn(`⚠️ Nie można załadować service account key z ${keyPath}:`, error.message);
      }
    } else {
      console.warn(`⚠️ Plik service account key nie istnieje: ${keyPath}`);
    }
  }
  
  // Jeśli nie udało się zainicjalizować, spróbuj z zmiennej środowiskowej
  if (!initialized && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK zainicjalizowany z zmiennej środowiskowej');
      initialized = true;
    } catch (error) {
      console.warn('⚠️ Nie można załadować service account key z zmiennej środowiskowej:', error.message);
    }
  }
  
  // Jeśli nadal nie udało się zainicjalizować, użyj Application Default Credentials
  if (!initialized) {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      console.error('❌ Brak NEXT_PUBLIC_FIREBASE_PROJECT_ID w zmiennych środowiskowych');
      console.error('\n💡 Aby naprawić ten błąd:');
      console.error('   1. Pobierz service account key z Firebase Console:');
      console.error('      Project Settings → Service Accounts → Generate New Private Key');
      console.error('   2. Ustaw zmienną środowiskową:');
      console.error('      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"');
      console.error('   3. Lub dodaj klucz do .env.local jako FIREBASE_SERVICE_ACCOUNT_KEY (jako JSON string)');
      console.error('   4. Lub użyj gcloud CLI: gcloud auth application-default login');
      process.exit(1);
    }
    
    try {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin SDK zainicjalizowany z Application Default Credentials');
      console.log('💡 Jeśli wystąpi błąd uprawnień, użyj GOOGLE_APPLICATION_CREDENTIALS lub FIREBASE_SERVICE_ACCOUNT_KEY');
      initialized = true;
    } catch (error) {
      console.error('❌ Błąd podczas inicjalizacji Firebase Admin SDK:', error.message);
      console.error('\n💡 Aby naprawić ten błąd:');
      console.error('   1. Pobierz service account key z Firebase Console:');
      console.error('      Project Settings → Service Accounts → Generate New Private Key');
      console.error('   2. Ustaw zmienną środowiskową:');
      console.error('      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"');
      console.error('   3. Lub dodaj klucz do .env.local jako FIREBASE_SERVICE_ACCOUNT_KEY (jako JSON string)');
      console.error('   4. Lub użyj gcloud CLI: gcloud auth application-default login');
      process.exit(1);
    }
  }
  
  db = admin.firestore();
  
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.log(`🔧 Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);
  }
} catch (error) {
  console.error('❌ Błąd podczas inicjalizacji Firebase Admin SDK:', error);
  console.error('\n💡 Aby naprawić ten błąd:');
  console.error('   1. Pobierz service account key z Firebase Console:');
  console.error('      Project Settings → Service Accounts → Generate New Private Key');
  console.error('   2. Ustaw zmienną środowiskową:');
  console.error('      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"');
  console.error('   3. Lub dodaj klucz do .env.local jako FIREBASE_SERVICE_ACCOUNT_KEY (jako JSON string)');
  console.error('   4. Lub użyj gcloud CLI: gcloud auth application-default login');
  process.exit(1);
}

// Funkcje pomocnicze do konwersji stref (z constants/xtValues.ts)
const XT_VALUES = {
  a1: { name: ["A", 1], value: 0.00638303 }, a2: { name: ["A", 2], value: 0.00779616 },
  a3: { name: ["A", 3], value: 0.00844854 }, a4: { name: ["A", 4], value: 0.00977659 },
  a5: { name: ["A", 5], value: 0.01126267 }, a6: { name: ["A", 6], value: 0.01248344 },
  a7: { name: ["A", 7], value: 0.01473596 }, a8: { name: ["A", 8], value: 0.0174506 },
  a9: { name: ["A", 9], value: 0.02122129 }, a10: { name: ["A", 10], value: 0.02756312 },
  a11: { name: ["A", 11], value: 0.03485072 }, a12: { name: ["A", 12], value: 0.0379259 },
  b1: { name: ["B", 1], value: 0.00750072 }, b2: { name: ["B", 2], value: 0.00878589 },
  b3: { name: ["B", 3], value: 0.00942382 }, b4: { name: ["B", 4], value: 0.0105949 },
  b5: { name: ["B", 5], value: 0.01214719 }, b6: { name: ["B", 6], value: 0.0138454 },
  b7: { name: ["B", 7], value: 0.01611813 }, b8: { name: ["B", 8], value: 0.01870347 },
  b9: { name: ["B", 9], value: 0.02401521 }, b10: { name: ["B", 10], value: 0.02953272 },
  b11: { name: ["B", 11], value: 0.04066992 }, b12: { name: ["B", 12], value: 0.04647721 },
  c1: { name: ["C", 1], value: 0.0088799 }, c2: { name: ["C", 2], value: 0.00977745 },
  c3: { name: ["C", 3], value: 0.01001304 }, c4: { name: ["C", 4], value: 0.01110462 },
  c5: { name: ["C", 5], value: 0.01269174 }, c6: { name: ["C", 6], value: 0.01429128 },
  c7: { name: ["C", 7], value: 0.01685596 }, c8: { name: ["C", 8], value: 0.01935132 },
  c9: { name: ["C", 9], value: 0.0241224 }, c10: { name: ["C", 10], value: 0.02855202 },
  c11: { name: ["C", 11], value: 0.05491138 }, c12: { name: ["C", 12], value: 0.06442595 },
  d1: { name: ["D", 1], value: 0.01001304 }, d2: { name: ["D", 2], value: 0.0105949 },
  d3: { name: ["D", 3], value: 0.0105949 }, d4: { name: ["D", 4], value: 0.01126267 },
  d5: { name: ["D", 5], value: 0.01248344 }, d6: { name: ["D", 6], value: 0.0138454 },
  d7: { name: ["D", 7], value: 0.01611813 }, d8: { name: ["D", 8], value: 0.01870347 },
  d9: { name: ["D", 9], value: 0.02401521 }, d10: { name: ["D", 10], value: 0.02953272 },
  d11: { name: ["D", 11], value: 0.04066992 }, d12: { name: ["D", 12], value: 0.04647721 },
  e1: { name: ["E", 1], value: 0.01126267 }, e2: { name: ["E", 2], value: 0.01214719 },
  e3: { name: ["E", 3], value: 0.01248344 }, e4: { name: ["E", 4], value: 0.0138454 },
  e5: { name: ["E", 5], value: 0.01473596 }, e6: { name: ["E", 6], value: 0.01611813 },
  e7: { name: ["E", 7], value: 0.0174506 }, e8: { name: ["E", 8], value: 0.01870347 },
  e9: { name: ["E", 9], value: 0.02122129 }, e10: { name: ["E", 10], value: 0.02401521 },
  e11: { name: ["E", 11], value: 0.02756312 }, e12: { name: ["E", 12], value: 0.02953272 },
  f1: { name: ["F", 1], value: 0.01248344 }, f2: { name: ["F", 2], value: 0.0138454 },
  f3: { name: ["F", 3], value: 0.01429128 }, f4: { name: ["F", 4], value: 0.01611813 },
  f5: { name: ["F", 5], value: 0.01685596 }, f6: { name: ["F", 6], value: 0.0174506 },
  f7: { name: ["F", 7], value: 0.01870347 }, f8: { name: ["F", 8], value: 0.01935132 },
  f9: { name: ["F", 9], value: 0.02122129 }, f10: { name: ["F", 10], value: 0.02401521 },
  f11: { name: ["F", 11], value: 0.02756312 }, f12: { name: ["F", 12], value: 0.02953272 },
  g1: { name: ["G", 1], value: 0.01473596 }, g2: { name: ["G", 2], value: 0.01611813 },
  g3: { name: ["G", 3], value: 0.01685596 }, g4: { name: ["G", 4], value: 0.0174506 },
  g5: { name: ["G", 5], value: 0.01870347 }, g6: { name: ["G", 6], value: 0.01935132 },
  g7: { name: ["G", 7], value: 0.02122129 }, g8: { name: ["G", 8], value: 0.02401521 },
  g9: { name: ["G", 9], value: 0.02756312 }, g10: { name: ["G", 10], value: 0.02953272 },
  g11: { name: ["G", 11], value: 0.03485072 }, g12: { name: ["G", 12], value: 0.04066992 },
  h1: { name: ["H", 1], value: 0.0174506 }, h2: { name: ["H", 2], value: 0.01870347 },
  h3: { name: ["H", 3], value: 0.01935132 }, h4: { name: ["H", 4], value: 0.02122129 },
  h5: { name: ["H", 5], value: 0.02401521 }, h6: { name: ["H", 6], value: 0.02756312 },
  h7: { name: ["H", 7], value: 0.02953272 }, h8: { name: ["H", 8], value: 0.03485072 },
  h9: { name: ["H", 9], value: 0.04066992 }, h10: { name: ["H", 10], value: 0.04647721 },
  h11: { name: ["H", 11], value: 0.05491138 }, h12: { name: ["H", 12], value: 0.06442595 }
};

const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function zoneNameToIndex(zoneName) {
  if (!zoneName || typeof zoneName !== 'string') return null;
  const upperZone = zoneName.toUpperCase();
  const match = upperZone.match(/^([A-H])(\d+)$/);
  if (!match) return null;
  const letter = match[1].toLowerCase();
  const number = parseInt(match[2], 10);
  const row = rowLetters.indexOf(letter);
  if (row === -1 || number < 1 || number > 12) return null;
  return row * 12 + (number - 1);
}

function getZoneName(zoneIndex) {
  if (zoneIndex < 0 || zoneIndex >= 96) return null;
  const row = Math.floor(zoneIndex / 12);
  const col = zoneIndex % 12;
  const rowLetter = rowLetters[row];
  const colNumber = col + 1;
  const key = `${rowLetter}${colNumber}`;
  const zoneData = XT_VALUES[key];
  return zoneData ? zoneData.name : null;
}

function zoneNameToString(zoneName) {
  if (!zoneName || !Array.isArray(zoneName) || zoneName.length !== 2) return null;
  return `${zoneName[0]}${zoneName[1]}`;
}

function getXTValueFromMatrix(row, col) {
  if (row < 0 || row >= 8 || col < 0 || col >= 12) return 0;
  const rowLetter = rowLetters[row];
  const colNumber = col + 1;
  const key = `${rowLetter}${colNumber}`;
  const zoneData = XT_VALUES[key];
  return zoneData ? zoneData.value : 0;
}

function getOppositeXTValueForZone(zone) {
  if (zone < 0 || zone >= 96) return 0;
  const row = Math.floor(zone / 12);
  const col = zone % 12;
  const oppositeRow = 7 - row;
  const oppositeCol = 11 - col;
  return getXTValueFromMatrix(oppositeRow, oppositeCol);
}

function convertZoneToName(zone) {
  if (typeof zone === 'string') {
    return zone.toUpperCase();
  }
  if (typeof zone === 'number') {
    const zoneName = getZoneName(zone);
    return zoneName ? zoneNameToString(zoneName) : null;
  }
  return null;
}

// Funkcja migracji
async function migrateRegainLosesActions() {
  console.log('🚀 Rozpoczynam migrację akcji regain i loses...\n');

  try {
    // 1. Pobierz wszystkie mecze
    const matchesSnapshot = await db.collection('matches').get();
    const matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Pobrano ${matches.length} meczów\n`);

    if (matches.length === 0) {
      console.log('⚠️ Brak meczów do przetworzenia');
      return;
    }

    let totalRegainUpdated = 0;
    let totalLosesUpdated = 0;
    let totalMatchesUpdated = 0;

    // 2. Dla każdego meczu sprawdź akcje regain i loses
    for (const match of matches) {
      let matchUpdated = false;
      const regainActions = match.actions_regain || [];
      const losesActions = match.actions_loses || [];

      // Przetwórz akcje regain
      const updatedRegainActions = regainActions.map(action => {
        // Sprawdź czy akcja już ma wszystkie potrzebne wartości
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action; // Nie wymaga aktualizacji
        }

        // Oblicz brakujące wartości
        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          console.warn(`⚠️ Akcja regain ${action.id} nie ma strefy startowej - pomijam`);
          return action;
        }

        const startZoneName = convertZoneToName(startZone);
        if (!startZoneName) {
          console.warn(`⚠️ Nie można skonwertować strefy ${startZone} dla akcji ${action.id} - pomijam`);
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
          console.warn(`⚠️ Nie można obliczyć indeksu strefy ${startZoneName} dla akcji ${action.id} - pomijam`);
          return action;
        }

        // Oblicz opposite strefę
        const row = Math.floor(zoneIndex / 12);
        const col = zoneIndex % 12;
        const oppositeRow = 7 - row;
        const oppositeCol = 11 - col;
        const oppositeIndex = oppositeRow * 12 + oppositeCol;
        const oppositeZoneData = getZoneName(oppositeIndex);
        const oppositeZone = oppositeZoneData ? zoneNameToString(oppositeZoneData) : null;

        // Oblicz opposite xT
        const oppositeXT = getOppositeXTValueForZone(zoneIndex);

        // Określ czy to atak czy obrona
        const receiverXT = action.xTValueEnd || 0;
        const isAttack = receiverXT < 0.02; // xT < 0.02 to atak

        matchUpdated = true;
        totalRegainUpdated++;

        return {
          ...action,
          oppositeXT,
          oppositeZone,
          isAttack
        };
      });

      // Przetwórz akcje loses (też mogą potrzebować tych wartości)
      const updatedLosesActions = losesActions.map(action => {
        // Sprawdź czy akcja już ma wszystkie potrzebne wartości
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action; // Nie wymaga aktualizacji
        }

        // Oblicz brakujące wartości (podobnie jak dla regain)
        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          console.warn(`⚠️ Akcja loses ${action.id} nie ma strefy startowej - pomijam`);
          return action;
        }

        const startZoneName = convertZoneToName(startZone);
        if (!startZoneName) {
          console.warn(`⚠️ Nie można skonwertować strefy ${startZone} dla akcji ${action.id} - pomijam`);
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
          console.warn(`⚠️ Nie można obliczyć indeksu strefy ${startZoneName} dla akcji ${action.id} - pomijam`);
          return action;
        }

        // Oblicz opposite strefę
        const row = Math.floor(zoneIndex / 12);
        const col = zoneIndex % 12;
        const oppositeRow = 7 - row;
        const oppositeCol = 11 - col;
        const oppositeIndex = oppositeRow * 12 + oppositeCol;
        const oppositeZoneData = getZoneName(oppositeIndex);
        const oppositeZone = oppositeZoneData ? zoneNameToString(oppositeZoneData) : null;

        // Oblicz opposite xT
        const oppositeXT = getOppositeXTValueForZone(zoneIndex);

        // Określ czy to atak czy obrona
        const receiverXT = action.xTValueEnd || 0;
        const isAttack = receiverXT < 0.02; // xT < 0.02 to atak

        matchUpdated = true;
        totalLosesUpdated++;

        return {
          ...action,
          oppositeXT,
          oppositeZone,
          isAttack
        };
      });

      // 3. Zaktualizuj mecz jeśli były zmiany
      if (matchUpdated) {
        const matchRef = db.collection('matches').doc(match.id);
        try {
          await matchRef.update({
            actions_regain: updatedRegainActions,
            actions_loses: updatedLosesActions
          });
          console.log(`✅ Zaktualizowano mecz ${match.id}: ${regainActions.length} regain, ${losesActions.length} loses`);
          totalMatchesUpdated++;
        } catch (error) {
          console.error(`❌ Błąd podczas aktualizacji meczu ${match.id}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Migracja zakończona pomyślnie!');
    console.log(`📊 Statystyki:`);
    console.log(`   - Zaktualizowano ${totalRegainUpdated} akcji regain`);
    console.log(`   - Zaktualizowano ${totalLosesUpdated} akcji loses`);
    console.log(`   - Zaktualizowano ${totalMatchesUpdated} meczów`);

  } catch (error) {
    console.error('❌ Błąd podczas migracji:', error);
    process.exit(1);
  }
}

// Uruchom migrację
migrateRegainLosesActions()
  .then(() => {
    console.log('\n✅ Skrypt zakończony pomyślnie');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Błąd:', error);
    process.exit(1);
  });
