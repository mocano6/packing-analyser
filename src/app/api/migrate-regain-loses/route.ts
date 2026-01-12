import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Firestore } from 'firebase/firestore';
import { 
  getOppositeXTValueForZone, 
  zoneNameToIndex, 
  getZoneName, 
  zoneNameToString 
} from '@/constants/xtValues';

// Inicjalizacja Firebase dla serwera (API routes)
function getServerFirestore(): Firestore {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

// Funkcja pomocnicza do konwersji strefy
function convertZoneToName(zone: string | number | undefined): string | null {
  if (typeof zone === 'string') {
    return zone.toUpperCase();
  }
  if (typeof zone === 'number') {
    const zoneName = getZoneName(zone);
    return zoneName ? zoneNameToString(zoneName) : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Rozpoczynam migrację akcji regain i loses...');

    // Inicjalizuj Firestore dla serwera
    const db = getServerFirestore();

    // 1. Pobierz wszystkie mecze
    const matchesCollection = collection(db, 'matches');
    const matchesSnapshot = await getDocs(matchesCollection);
    const matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Pobrano ${matches.length} meczów`);

    if (matches.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Brak meczów do przetworzenia',
        stats: {
          regainUpdated: 0,
          losesUpdated: 0,
          matchesUpdated: 0
        }
      });
    }

    let totalRegainUpdated = 0;
    let totalLosesUpdated = 0;
    let totalMatchesUpdated = 0;
    const errors: string[] = [];

    // 2. Dla każdego meczu sprawdź akcje regain i loses
    for (const match of matches) {
      let matchUpdated = false;
      const regainActions = (match.actions_regain as any[]) || [];
      const losesActions = (match.actions_loses as any[]) || [];

      // Przetwórz akcje regain
      const updatedRegainActions = regainActions.map((action: any) => {
        // Sprawdź czy akcja już ma wszystkie potrzebne wartości
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action; // Nie wymaga aktualizacji
        }

        // Oblicz brakujące wartości
        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          return action;
        }

        const startZoneName = convertZoneToName(startZone);
        if (!startZoneName) {
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
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

      // Przetwórz akcje loses
      const updatedLosesActions = losesActions.map((action: any) => {
        // Sprawdź czy akcja już ma wszystkie potrzebne wartości
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action; // Nie wymaga aktualizacji
        }

        // Oblicz brakujące wartości (podobnie jak dla regain)
        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          return action;
        }

        const startZoneName = convertZoneToName(startZone);
        if (!startZoneName) {
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
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
        const matchRef = doc(db, 'matches', match.id);
        try {
          await updateDoc(matchRef, {
            actions_regain: updatedRegainActions,
            actions_loses: updatedLosesActions
          });
          console.log(`✅ Zaktualizowano mecz ${match.id}`);
          totalMatchesUpdated++;
        } catch (error: any) {
          const errorMsg = `Błąd podczas aktualizacji meczu ${match.id}: ${error.message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migracja zakończona pomyślnie',
      stats: {
        regainUpdated: totalRegainUpdated,
        losesUpdated: totalLosesUpdated,
        matchesUpdated: totalMatchesUpdated,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ Błąd podczas migracji:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Błąd podczas migracji',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
