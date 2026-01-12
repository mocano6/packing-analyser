"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// Dynamiczny import komponentów, aby zapewnić, że są renderowane tylko po stronie klienta
const TeamsInitializer = dynamic(
  () => import("@/components/AdminPanel/TeamsInitializer"),
  { ssr: false }
);

const UserManagement = dynamic(
  () => import("@/components/AdminPanel/UserManagement"),
  { ssr: false }
);

const TeamsManagement = dynamic(
  () => import("@/components/AdminPanel/TeamsManagement"),
  { ssr: false }
);

const RegainLosesMigration = dynamic(
  () => import("@/components/AdminPanel/RegainLosesMigration"),
  { ssr: false }
);

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [showSecurityRules, setShowSecurityRules] = useState(false);

  // Sprawdź czy użytkownik jest zalogowany i ma uprawnienia admina
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Brak dostępu</h1>
        <p>Musisz być zalogowany, aby uzyskać dostęp do panelu administracyjnego.</p>
        <button
          onClick={() => router.push("/login")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#4a90e2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Przejdź do logowania
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Brak uprawnień</h1>
        <p>Tylko administratorzy mają dostęp do tego panelu.</p>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 20px",
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
    );
  }

  const firebaseRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Podstawowe reguły dla uwierzytelnionego dostępu
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Kolekcja użytkowników - tylko właściciel i admini
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Kolekcja zespołów - wszyscy zalogowani użytkownicy
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Mecze, gracze, akcje - tylko użytkownicy z dostępem do zespołu
    match /matches/{matchId} {
      allow read, write: if request.auth != null && 
        resource.data.teamId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.allowedTeams;
    }
    
    match /players/{playerId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        resource.data.teams != null &&
        resource.data.teams.hasAny(get(/databases/$(database)/documents/users/$(request.auth.uid)).data.allowedTeams);
    }
    
    match /actions/{actionId} {
      allow read, write: if request.auth != null;
    }
    
    // Kolekcja testowa do sprawdzania uprawnień
    match /permission_tests/{document} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
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
        <h2>Zarządzanie użytkownikami</h2>
        <p>
          Zarządzaj użytkownikami aplikacji i ich dostępem do zespołów.
        </p>
        <UserManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Zarządzanie zespołami</h2>
        <p>
          Dodawaj, edytuj i usuwaj zespoły. Zarządzaj wszystkimi zespołami dostępnymi w aplikacji.
        </p>
        <TeamsManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Inicjalizacja zespołów</h2>
        <p>
          Ten panel umożliwia inicjalizację kolekcji teams w Firebase z domyślnymi zespołami. 
          Operacja ta powinna być wykonana tylko raz dla całej aplikacji.
        </p>
        <TeamsInitializer />
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>🔄 Migracja struktury danych</h2>
        <p>
          Analiza i migracja struktury zawodników z obecnej struktury (players.teams[]) 
          na nową strukturę z subcollections (teams/{'{teamId}'}/members/).
        </p>
        <div style={{ 
          backgroundColor: "#e7f3ff", 
          padding: "15px", 
          borderRadius: "4px", 
          marginBottom: "15px" 
        }}>
          <strong>💡 Korzyści migracji:</strong>
          <ul style={{ marginTop: "10px", marginBottom: "0" }}>
            <li>Różne numery zawodników w różnych zespołach</li>
            <li>Status członkostwa (aktywny/wypożyczony/zawieszony)</li>
            <li>Historia transferów i dat dołączenia</li>
            <li>Szybsze zapytania do bazy danych</li>
            <li>Lepsze bezpieczeństwo na poziomie zespołu</li>
          </ul>
        </div>
        <Link 
          href="/admin/migration"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#17a2b8",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🔍 Przeprowadź analizę danych
        </Link>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Migracja akcji Regain i Loses</h2>
        <RegainLosesMigration />
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2>Reguły bezpieczeństwa Firebase</h2>
        <p>
          Poniżej znajdują się zalecane reguły bezpieczeństwa dla nowego systemu uwierzytelniania.
        </p>
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
          {showSecurityRules ? "Ukryj reguły" : "Pokaż reguły"}
        </button>
        
        {showSecurityRules && (
          <div style={{
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "4px",
            padding: "15px",
            marginTop: "10px"
          }}>
            <h4>Skopiuj i wklej te reguły w Firebase Console (Firestore → Rules):</h4>
            <pre style={{
              backgroundColor: "#e9ecef",
              padding: "10px",
              borderRadius: "4px",
              overflow: "auto",
              fontSize: "12px",
              lineHeight: "1.4"
            }}>
              {firebaseRules}
            </pre>
            <p style={{ marginTop: "10px", fontSize: "0.9em", color: "#666" }}>
              <strong>Uwaga:</strong> Te reguły zapewniają bezpieczny dostęp oparty na uwierzytelnianiu i uprawnieniach użytkowników.
            </p>
          </div>
        )}
      </section>
    </div>
  );
} 