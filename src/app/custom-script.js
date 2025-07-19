// Skrypt do obsługi przekierowań na GitHub Pages
// Ten skrypt będzie wstrzykiwany przez plugin Next.js do pliku index.html

(function() {
  // Kod przywracający ścieżkę z parametru URL
  var redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  
  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }
  
  // Obsługa parametrów przekierowania z 404.html
  var p = new URLSearchParams(window.location.search).get('p');
  var q = new URLSearchParams(window.location.search).get('q');
  
  if (p) {
    var newUrl = p.replace(/~and~/g, '&');
    if (q) {
      newUrl += '?' + q.replace(/~and~/g, '&');
    }
    window.history.replaceState(null, null, newUrl);
  }
})();

// ===== FUNKCJE NAPRAWY DANYCH =====

// Funkcja do aktualizacji ID zespołów w meczach
async function updateMatchTeamIds() {
  // Mapowanie starych ID na nowe ID zespołów
  const teamIdMapping = {
    "89039437-62a7-4eda-b67d-70a4fb24e4ea": "4fqwPiTdSZSLEwUHo785", // Rezerwy → Polonia Bytom
    // Dodaj więcej mapowań jeśli potrzebne
  };

  console.log("🔄 Rozpoczynam aktualizację ID zespołów w meczach...");
  
  try {
    // Importuj Firebase
    const { db } = await import('/src/lib/firebase.ts');
    const { collection, getDocs, doc, updateDoc } = await import('firebase/firestore');
    
    // Pobierz wszystkie mecze
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    console.log(`📊 Znaleziono ${matchesSnapshot.docs.length} meczów do sprawdzenia`);
    
    let updatedCount = 0;
    let totalCount = 0;
    
    for (const matchDoc of matchesSnapshot.docs) {
      totalCount++;
      const matchData = matchDoc.data();
      const oldTeamId = matchData.team;
      
      console.log(`🔍 Mecz ${matchDoc.id}: ${matchData.opponent}, team: ${oldTeamId}`);
      
      // Sprawdź czy to ID wymaga aktualizacji
      if (teamIdMapping[oldTeamId]) {
        const newTeamId = teamIdMapping[oldTeamId];
        
        try {
          await updateDoc(doc(db, "matches", matchDoc.id), {
            team: newTeamId
          });
          
          console.log(`✅ Zaktualizowano mecz ${matchDoc.id}: ${oldTeamId} → ${newTeamId}`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Błąd aktualizacji meczu ${matchDoc.id}:`, error);
        }
      } else {
        console.log(`ℹ️ Mecz ${matchDoc.id}: ID zespołu nie wymaga aktualizacji`);
      }
    }
    
    console.log(`\n🎉 Aktualizacja zakończona:`);
    console.log(`   📊 Sprawdzono meczów: ${totalCount}`);
    console.log(`   ✅ Zaktualizowano: ${updatedCount}`);
    console.log(`   ➡️ Odśwież stronę żeby zobaczyć zmiany`);
    
    return { totalCount, updatedCount };
    
  } catch (error) {
    console.error("❌ Błąd podczas aktualizacji ID zespołów:", error);
    throw error;
  }
}

// Funkcja do diagnostyki uprawnień użytkownika
async function checkUserPermissions() {
  console.log("🔍 Sprawdzam uprawnienia użytkownika...");
  
  try {
    // Importuj potrzebne moduły
    const { getAuth } = await import('firebase/auth');
    const { db } = await import('/src/lib/firebase.ts');
    const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
    const { getTeamsArray } = await import('/src/constants/teamsLoader.ts');
    
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log("❌ Użytkownik nie jest zalogowany");
      return;
    }
    
    console.log("👤 Zalogowany użytkownik:", user.email);
    console.log("🆔 UID:", user.uid);
    
    // Sprawdź dokument użytkownika
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log("❌ Dokument użytkownika nie istnieje w Firestore");
      return;
    }
    
    const userData = userDoc.data();
    console.log("📄 Dane użytkownika z Firestore:", userData);
    console.log("🏆 allowedTeams:", userData.allowedTeams);
    console.log("👑 role:", userData.role);
    
    // Sprawdź dostępne zespoły
    try {
      const allTeams = await getTeamsArray();
      console.log("📋 Wszystkie dostępne zespoły:");
      allTeams.forEach(team => {
        const hasAccess = userData.allowedTeams.includes(team.id);
        console.log(`   ${hasAccess ? '✅' : '❌'} ${team.name} (${team.id})`);
      });
    } catch (error) {
      console.error("❌ Błąd pobierania zespołów:", error);
    }
    
    // Sprawdź kolekcję teams w Firebase
    try {
      const teamsSnapshot = await getDocs(collection(db, "teams"));
      console.log("🔥 Zespoły w Firebase:");
      teamsSnapshot.forEach(doc => {
        const teamData = doc.data();
        console.log(`   📁 ${teamData.name} (${teamData.id})`);
      });
    } catch (error) {
      console.error("❌ Błąd dostępu do kolekcji teams:", error);
    }
    
  } catch (error) {
    console.error("❌ Błąd podczas sprawdzania uprawnień:", error);
  }
}

// Funkcja do dodania zespołu "Polonia Bytom" do Firebase
async function addPoloniaBytomTeam() {
  console.log("🏆 Dodaję zespół Polonia Bytom do Firebase...");
  
  try {
    const { db } = await import('/src/lib/firebase.ts');
    const { doc, setDoc } = await import('firebase/firestore');
    
    const teamData = {
      id: "4fqwPiTdSZSLEwUHo785",
      name: "Polonia Bytom",
      createdAt: new Date(),
      isSystem: true
    };
    
    await setDoc(doc(db, "teams", "4fqwPiTdSZSLEwUHo785"), teamData);
    
    console.log("✅ Zespół Polonia Bytom został dodany do Firebase");
    console.log("   📋 Dane zespołu:", teamData);
    console.log("   ➡️ Odśwież stronę żeby zobaczyć zmiany");
    
    return teamData;
    
  } catch (error) {
    console.error("❌ Błąd podczas dodawania zespołu:", error);
    throw error;
  }
}

// Funkcja do czyszczenia cache zespołów
function clearTeamsCache() {
  console.log("🧹 Czyszczę cache zespołów...");
  
  try {
    // Usuń cache z localStorage jeśli istnieje
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('teams') || key.includes('cache'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    console.log("✅ Cache zespołów został wyczyszczony");
    console.log("   ➡️ Odśwież stronę żeby załadować nowe dane");
    
  } catch (error) {
    console.error("❌ Błąd podczas czyszczenia cache:", error);
  }
}

// Udostępnij funkcje w oknie globalnym
if (typeof window !== 'undefined') {
  window.updateMatchTeamIds = updateMatchTeamIds;
  window.checkUserPermissions = checkUserPermissions;
  window.addPoloniaBytomTeam = addPoloniaBytomTeam;
  window.clearTeamsCache = clearTeamsCache;
  
  console.log("💡 Funkcje naprawy danych dostępne w konsoli:");
  console.log("   - updateMatchTeamIds() - naprawia ID zespołów w meczach");
  console.log("   - checkUserPermissions() - sprawdza uprawnienia użytkownika");
  console.log("   - addPoloniaBytomTeam() - dodaje zespół Polonia Bytom do Firebase");
  console.log("   - clearTeamsCache() - czyści cache zespołów");
} 