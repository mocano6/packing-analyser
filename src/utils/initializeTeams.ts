import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, where, getDoc } from "firebase/firestore";
import { TEAMS } from "@/constants/teams";

/**
 * Inicjalizuje kolekcję zespołów w Firebase, dodając stałe identyfikatory 
 * zespołów, które są używane w całej aplikacji.
 * Funkcja sprawdza, czy kolekcja już istnieje przed dodaniem danych,
 * aby uniknąć duplikacji.
 */
export const initializeTeams = async (): Promise<boolean> => {
  try {
    console.log("Rozpoczynam inicjalizację kolekcji teams w Firebase...");
    
    // Spróbujmy najpierw sprawdzić, czy pojedynczy dokument istnieje
    const firstTeamId = Object.values(TEAMS)[0].id;
    const teamDocRef = doc(db, "teams", firstTeamId);
    const teamDoc = await getDoc(teamDocRef);
    
    if (teamDoc.exists()) {
      console.log(`Dokument team o ID ${firstTeamId} już istnieje, pomijanie inicjalizacji.`);
      return false;
    }
    
    console.log("Dokumenty teams nie istnieją, rozpoczynam tworzenie kolekcji...");
    
    // Dodaj wszystkie zespoły z stałej TEAMS do Firebase
    const promises = Object.values(TEAMS).map(async team => {
      try {
        console.log(`Próba dodania zespołu: ${team.name} (${team.id})`);
        await setDoc(doc(db, "teams", team.id), {
          id: team.id,
          name: team.name,
          createdAt: new Date(),
          isSystem: true  // Flaga informująca, że jest to systemowy zespół
        });
        console.log(`✅ Dodano zespół: ${team.name} (${team.id})`);
        return true;
      } catch (error) {
        console.error(`❌ Błąd dodawania zespołu ${team.name}:`, error);
        throw error; // Przekazujemy błąd dalej, aby przerwać całą operację
      }
    });
    
    // Czekamy na zakończenie wszystkich operacji
    await Promise.all(promises);
    
    // Sprawdźmy, czy zespoły zostały dodane
    const verificationResult = await checkTeamsCollection();
    if (verificationResult) {
      console.log("✅ Pomyślnie zainicjalizowano kolekcję teams i zweryfikowano jej istnienie.");
      return true;
    } else {
      console.error("❌ Inicjalizacja zakończona, ale weryfikacja nie powiodła się. Kolekcja może być pusta.");
      return false;
    }
  } catch (error) {
    console.error("❌ Błąd podczas inicjalizacji kolekcji teams:", error);
    if (error instanceof Error) {
      console.error("Szczegóły błędu:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return false;
  }
};

/**
 * Wymusza utworzenie kolekcji teams, nawet jeśli już istnieje.
 * Używać tylko w sytuacjach awaryjnych.
 */
export const forceInitializeTeams = async (): Promise<boolean> => {
  try {
    console.log("Wymuszam inicjalizację kolekcji teams...");
    
    // Dodaj wszystkie zespoły z stałej TEAMS do Firebase
    for (const team of Object.values(TEAMS)) {
      try {
        await setDoc(doc(db, "teams", team.id), {
          id: team.id,
          name: team.name,
          createdAt: new Date(),
          isSystem: true,
          updatedAt: new Date() // Dodajemy pole updatedAt dla rozróżnienia
        }, { merge: true });
        console.log(`Zaktualizowano/dodano zespół: ${team.name} (${team.id})`);
      } catch (e) {
        console.error(`Błąd przy wymuszonym dodawaniu zespołu ${team.name}:`, e);
      }
    }
    
    // Sprawdź, czy operacja się powiodła
    const teamsExist = await checkTeamsCollection();
    return teamsExist;
  } catch (error) {
    console.error("Błąd podczas wymuszonej inicjalizacji kolekcji teams:", error);
    return false;
  }
};

/**
 * Sprawdza, czy kolekcja teams istnieje w Firebase.
 */
export const checkTeamsCollection = async (): Promise<boolean> => {
  try {
    console.log("Sprawdzanie kolekcji teams...");
    
    // Sprawdźmy po kolei każdy dokument, czy istnieje
    const teamIds = Object.values(TEAMS).map(team => team.id);
    let existingCount = 0;
    
    for (const teamId of teamIds) {
      const teamDocRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamDocRef);
      
      if (teamDoc.exists()) {
        console.log(`✅ Zespół ${teamId} istnieje w Firebase`);
        existingCount++;
      } else {
        console.log(`❌ Zespół ${teamId} NIE istnieje w Firebase`);
      }
    }
    
    const allExist = existingCount === teamIds.length;
    console.log(`Znaleziono ${existingCount}/${teamIds.length} zespołów w Firebase. Wynik sprawdzenia: ${allExist ? 'SUKCES' : 'NIEPOWODZENIE'}`);
    
    return allExist;
  } catch (error) {
    console.error("Błąd podczas sprawdzania kolekcji teams:", error);
    if (error instanceof Error) {
      console.error("Szczegóły błędu:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return false;
  }
}; 