"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// Dynamiczny import komponentu, aby zapewnić, że jest renderowany tylko po stronie klienta
const TeamsInitializer = dynamic(
  () => import("@/components/AdminPanel/TeamsInitializer"),
  { ssr: false }
);

export default function AdminPage() {
  const router = useRouter();
  const [showSecurityRules, setShowSecurityRules] = useState(false);

  const firebaseRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Pozwól na odczyt wszystkim, ale ograniczony zapis tylko dla zalogowanych użytkowników
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Specjalna reguła dla kolekcji teams - pozwala na odczyt wszystkim
    match /teams/{teamId} {
      allow read: if true;
      
      // Zezwól wszystkim na zapis do kolekcji teams (uproszczona wersja)
      allow write: if true;
    }
    
    // Kolekcja testowa do sprawdzania uprawnień
    match /permission_tests/{document} {
      allow read, write: if true;
    }
  }
}`;

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px" }}>
        <h1>Panel administracyjny</h1>
        <p>Ta strona umożliwia wykonywanie działań administracyjnych na aplikacji.</p>
        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "8px 12px",
              backgroundColor: "#4a90e2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Powrót do aplikacji
          </button>
        </div>
      </header>

      <section style={{ marginBottom: "30px" }}>
        <h2>Ustawienia zespołów</h2>
        <p>
          Ten panel umożliwia inicjalizację kolekcji teams w Firebase. 
          Operacja ta powinna być wykonana tylko raz dla całej aplikacji.
        </p>
        <TeamsInitializer />
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Reguły bezpieczeństwa Firebase</h2>
        <p>
          Aby inicjalizacja kolekcji teams działała poprawnie, należy ustawić odpowiednie 
          reguły bezpieczeństwa w Firebase Firestore.
        </p>
        
        <div style={{ marginTop: "15px" }}>
          <button
            onClick={() => setShowSecurityRules(!showSecurityRules)}
            style={{
              padding: "8px 12px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginBottom: "10px"
            }}
          >
            {showSecurityRules ? "Ukryj reguły bezpieczeństwa" : "Pokaż reguły bezpieczeństwa"}
          </button>
          
          {showSecurityRules && (
            <div style={{ 
              padding: "15px", 
              backgroundColor: "#f8f9fa", 
              borderRadius: "4px",
              border: "1px solid #dee2e6",
              marginTop: "10px",
              marginBottom: "15px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap"
            }}>
              {firebaseRules}
            </div>
          )}
          
          <div style={{ marginTop: "15px" }}>
            <p><strong>Instrukcja konfiguracji reguł bezpieczeństwa:</strong></p>
            <ol style={{ paddingLeft: "20px" }}>
              <li>Zaloguj się do <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>konsoli Firebase</a></li>
              <li>Wybierz swój projekt</li>
              <li>Przejdź do sekcji "Firestore Database"</li>
              <li>Kliknij zakładkę "Rules"</li>
              <li>Wprowadź powyższe reguły i kliknij "Publish"</li>
            </ol>
          </div>
          
          <div style={{ 
            padding: "10px", 
            backgroundColor: "#fff3cd", 
            borderRadius: "4px",
            marginTop: "15px",
            color: "#856404",
            border: "1px solid #ffeeba"
          }}>
            <p><strong>⚠️ Uwaga:</strong> Ustawienie uproszczonych reguł bezpieczeństwa (bez uwierzytelniania) 
            powinno być używane tylko w wersji testowej lub wewnętrznej aplikacji. W środowisku produkcyjnym 
            zalecane jest używanie uwierzytelniania.</p>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: "40px", borderTop: "1px solid #eaeaea", paddingTop: "20px" }}>
        <p>Ta strona jest dostępna tylko dla administratorów. Wszystkie operacje są logowane.</p>
      </footer>
    </div>
  );
} 