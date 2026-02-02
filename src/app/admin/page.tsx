"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import styles from "./page.module.css";

const UserManagement = dynamic(
  () => import("@/components/AdminPanel/UserManagement"),
  { ssr: false }
);

const TeamsManagement = dynamic(
  () => import("@/components/AdminPanel/TeamsManagement"),
  { ssr: false }
);

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

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
        <button type="button" className={styles.primaryButton} onClick={() => router.push("/")}>
          Powrót
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Panel administracyjny</h1>
        <button type="button" className={styles.backButton} onClick={() => router.push("/")}>
          Powrót do aplikacji
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Użytkownicy</h2>
        <p className={styles.sectionDesc}>Dostęp do zespołów i role.</p>
        <UserManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Zespoły</h2>
        <p className={styles.sectionDesc}>Dodawanie, edycja i usuwanie zespołów.</p>
        <TeamsManagement currentUserIsAdmin={isAdmin} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Czyszczenie PII</h2>
        <p className={styles.sectionDesc}>Skanuj matches, gps i archiwa, usuń pola PII z wybranych dokumentów (przed usunięciem tworzona jest kopia).</p>
        <Link href="/admin/cleanup" className={styles.linkButton}>
          Otwórz czyszczenie PII
        </Link>
      </section>
    </div>
  );
} 