"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { FIRESTORE_METRICS_HIDDEN_KEY } from "@/components/FirestoreMetricsBadge/FirestoreMetricsBadge";
import UserManagement from "@/components/AdminPanel/UserManagement";
import TeamsManagement from "@/components/AdminPanel/TeamsManagement";
import styles from "./page.module.css";

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [firestoreMetricsHidden, setFirestoreMetricsHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setFirestoreMetricsHidden(localStorage.getItem(FIRESTORE_METRICS_HIDDEN_KEY) === "true");
  }, []);

  const toggleFirestoreMetricsVisibility = () => {
    if (typeof window === "undefined") return;
    const next = !firestoreMetricsHidden;
    setFirestoreMetricsHidden(next);
    localStorage.setItem(FIRESTORE_METRICS_HIDDEN_KEY, next ? "true" : "false");
    window.dispatchEvent(new CustomEvent("firestore-metrics-visibility-change"));
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} aria-hidden />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.deniedWrap}>
        <h1 className={styles.deniedTitle}>Brak dostępu</h1>
        <p className={styles.deniedText}>Zaloguj się, aby wejść do panelu.</p>
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/login")}>
          Zaloguj się
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.deniedWrap}>
        <h1 className={styles.deniedTitle}>Brak uprawnień</h1>
        <p className={styles.deniedText}>Dostęp mają tylko administratorzy.</p>
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/analyzer")}>
          Powrót
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Panel administracyjny</h1>
        <button type="button" className={styles.backButton} onClick={() => router.push("/analyzer")}>
          Powrót do aplikacji
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Użytkownicy</h2>
        <UserManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Zespoły</h2>
        <TeamsManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Szybkie linki</h2>
        <div className={styles.quickLinks}>
          <Link href="/admin/zadania" className={styles.linkButton}>
            Zadania
          </Link>
          <Link href="/admin/stale-fragmenty" className={styles.linkButton}>
            Stałe fragmenty
          </Link>
          <Link href="/admin/kpi" className={styles.linkButton}>
            KPI trendów
          </Link>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={toggleFirestoreMetricsVisibility}
            aria-pressed={firestoreMetricsHidden}
          >
            {firestoreMetricsHidden ? "Pokaż metryki Firestore" : "Ukryj metryki Firestore"}
          </button>
        </div>
      </section>
    </div>
  );
} 