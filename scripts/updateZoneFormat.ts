/**
 * Skrypt do aktualizacji formatu danych stref w bazie danych
 * Zamienia format string ("A1") na format JSON (["A", 1])
 * 
 * Użycie:
 * npx ts-node scripts/updateZoneFormat.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Funkcja konwertująca stare formaty stref na nowy format JSON
 * @param zoneStr String z nazwą strefy w formacie "A1", "B2", itp.
 * @returns String z danymi JSON w formacie ["A", 1]
 */
function convertZoneFormat(zoneStr: string | null): string | null {
  if (!zoneStr) return null;
  
  // Sprawdź, czy dane są już w formacie JSON
  if (zoneStr.startsWith('[')) {
    try {
      JSON.parse(zoneStr);
      return zoneStr; // Już w formacie JSON
    } catch (e) {
      // Jeśli nie da się sparsować, kontynuuj konwersję
    }
  }
  
  // Ekstraktuj literę i numer z formatu "A1", "B2", itp.
  const matches = zoneStr.match(/^([A-H])(\d+)$/i);
  if (matches && matches.length === 3) {
    const [_, letter, number] = matches;
    // Utwórz tablicę [litera, numer] i zwróć jako JSON
    return JSON.stringify([letter.toUpperCase(), parseInt(number, 10)]);
  }
  
  // Jeśli format nie pasuje, zwróć null
  console.warn(`Nieprawidłowy format strefy: ${zoneStr}`);
  return null;
}

async function updateZoneFormat() {
  try {
    // Sprawdź, jakie pola są dostępne w modelu
    const firstAction = await prisma.actionsPacking.findFirst();
    console.log('Dostępne pola modelu:', Object.keys(firstAction || {}));
    
    // Pobierz wszystkie akcje
    const actions = await prisma.actionsPacking.findMany();
    console.log(`Znaleziono ${actions.length} akcji do aktualizacji.`);
    
    let updatedCount = 0;
    
    // Aktualizuj każdą akcję
    for (const action of actions) {
      // Sprawdź, które pola są używane w aktualnym modelu
      // Najpierw sprawdźmy, czy mamy pola startZone/endZone
      if ('startZone' in action && 'endZone' in action) {
        // Konwertuj obie strefy
        const startZone = action.startZone ? convertZoneFormat(action.startZone as string) : null;
        const endZone = action.endZone ? convertZoneFormat(action.endZone as string) : null;
        
        // Aktualizuj rekord tylko jeśli dane się zmieniły
        if (startZone !== action.startZone || endZone !== action.endZone) {
          await prisma.actionsPacking.update({
            where: { id: action.id },
            data: {
              startZone,
              endZone
            }
          });
          updatedCount++;
        }
      } 
      // Jeśli mamy stare pola senderZone/receiverZone
      else if ('senderZone' in action && 'receiverZone' in action) {
        // Konwertuj obie strefy
        const senderZone = action.senderZone ? convertZoneFormat(action.senderZone as string) : null;
        const receiverZone = action.receiverZone ? convertZoneFormat(action.receiverZone as string) : null;
        
        // Aktualizuj rekord tylko jeśli dane się zmieniły
        if (senderZone !== action.senderZone || receiverZone !== action.receiverZone) {
          await prisma.actionsPacking.update({
            where: { id: action.id },
            data: {
              senderZone,
              receiverZone
            }
          });
          updatedCount++;
        }
      } else {
        console.warn(`Akcja ${action.id} nie posiada pól strefy.`);
      }
    }
    
    console.log(`Zaktualizowano ${updatedCount} akcji.`);
  } catch (error) {
    console.error('Wystąpił błąd podczas aktualizacji formatu stref:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Uruchom skrypt
updateZoneFormat()
  .then(() => console.log('Skrypt zakończył działanie.'))
  .catch((e) => console.error('Błąd skryptu:', e)); 