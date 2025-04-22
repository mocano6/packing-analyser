// src/scripts/migrateActionsToDocs.js
// Skrypt migracji danych z kolekcji actions_packing do tablicy actions_packing w dokumentach matches

/**
 * Ten skrypt należy uruchomić jednorazowo, aby przenieść dane.
 * Użyj: node migrateActionsToDocs.js
 * 
 * Upewnij się, że masz odpowiednie uprawnienia do Firebase zanim uruchomisz ten skrypt.
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, collection, getDocs, query, 
  where, doc, updateDoc, deleteDoc 
} = require('firebase/firestore');

// Skonfiguruj swoje dane Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Funkcja migracji
async function migrateActions() {
  console.log('🚀 Rozpoczynam migrację akcji...');

  try {
    // 1. Pobierz wszystkie akcje z kolekcji actions_packing
    const actionsCollection = collection(db, "actions_packing");
    const actionsSnapshot = await getDocs(actionsCollection);
    const actions = actionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Pobrano ${actions.length} akcji z kolekcji actions_packing`);

    // 2. Grupuj akcje według matchId
    const actionsByMatch = {};
    actions.forEach(action => {
      if (!action.matchId) {
        console.warn(`⚠️ Akcja ${action.id} nie ma przypisanego matchId - pomijam`);
        return;
      }

      if (!actionsByMatch[action.matchId]) {
        actionsByMatch[action.matchId] = [];
      }
      
      // Dodaj akcję do odpowiedniej grupy
      const actionData = { ...action };
      delete actionData.docId; // Usuwamy pole docId, które może być nadmiarowe
      delete actionData.second; // Usuwamy pole second
      delete actionData.success; // Usuwamy pole success
      
      // Przenosimy value z playerId do senderId, jeśli senderId nie istnieje
      if (!actionData.senderId && actionData.playerId) {
        actionData.senderId = actionData.playerId;
      }
      delete actionData.playerId; // Usuwamy playerId, bo używamy senderId
      
      // Konwertujemy strefy z liczb na format literowo-liczbowy
      if (typeof actionData.fromZone === 'number') {
        actionData.fromZone = convertZoneNumberToString(actionData.fromZone);
      }
      
      if (typeof actionData.toZone === 'number') {
        actionData.toZone = convertZoneNumberToString(actionData.toZone);
      }
      
      // Dodajemy nowe pola xT, jeśli istnieje stare pole xTValue
      if (actionData.xTValue !== undefined) {
        // Jeśli istnieje stare pole xTValue, używamy go jako wartości końcowej
        actionData.xTValueEnd = actionData.xTValue;
        
        // Usuwamy stare pole
        delete actionData.xTValue;
        
        // Dla starych danych zakładamy, że wartość początkowa to 0 (można to później zmienić)
        if (actionData.xTValueStart === undefined) {
          actionData.xTValueStart = 0;
        }
      }
      
      // Usuwamy pola senderClickValue i receiverClickValue, jeśli istnieją
      delete actionData.senderClickValue;
      delete actionData.receiverClickValue;
      
      // Usuwamy xTValueDelta, jeśli istnieje
      delete actionData.xTValueDelta;
      
      // Upewniamy się, że wartości xT istnieją
      if (actionData.xTValueStart === undefined) {
        actionData.xTValueStart = 0;
      }
      
      if (actionData.xTValueEnd === undefined) {
        actionData.xTValueEnd = 0;
      }
      
      actionsByMatch[action.matchId].push(actionData);
    });

    // 3. Aktualizuj każdy dokument meczu, dodając akcje do tablicy actions_packing
    const matchIds = Object.keys(actionsByMatch);
    console.log(`🔄 Aktualizuję ${matchIds.length} dokumentów meczów...`);

    for (const matchId of matchIds) {
      const matchActions = actionsByMatch[matchId];
      const matchRef = doc(db, "matches", matchId);
      
      try {
        // Aktualizuj dokument, dodając tablicę actions_packing
        await updateDoc(matchRef, {
          actions_packing: matchActions
        });
        console.log(`✅ Zaktualizowano mecz ${matchId} z ${matchActions.length} akcjami`);
      } catch (error) {
        console.error(`❌ Błąd podczas aktualizacji meczu ${matchId}:`, error);
      }
    }

    console.log('🎉 Migracja zakończona pomyślnie!');
    console.log('⚠️ UWAGA: Nie usuwamy automatycznie danych z kolekcji actions_packing.');
    console.log('⚠️ Po zweryfikowaniu poprawności migracji, możesz ręcznie usunąć kolekcję actions_packing.');

  } catch (error) {
    console.error('❌ Błąd podczas migracji:', error);
  }
}

// Funkcja do konwersji numeru strefy na format literowo-liczbowy
// Zakładamy, że boisko ma 12 kolumn (a-l) i 8 wierszy (1-8)
function convertZoneNumberToString(zoneNumber) {
  if (typeof zoneNumber !== 'number') return zoneNumber;
  
  // Zakładamy, że numeracja biegnie od lewej do prawej, od góry do dołu
  // np. 0-11 to pierwszy wiersz, 12-23 to drugi wiersz, itd.
  const row = Math.floor(zoneNumber / 12) + 1; // Wiersze od 1
  const col = zoneNumber % 12; // Kolumny od 0
  
  // Konwertujemy kolumnę na literę (0 -> 'a', 1 -> 'b', itd.)
  const colLetter = String.fromCharCode(97 + col); // 97 to kod ASCII dla 'a'
  
  return `${colLetter}${row}`;
}

// Uruchom migrację
migrateActions(); 