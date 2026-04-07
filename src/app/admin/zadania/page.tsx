"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPlanner } from "@/hooks/useStaffPlanner";
import SidePanel from "@/components/SidePanel/SidePanel";
import toast from "react-hot-toast";
import EisenhowerQuadrantTab from "@/components/EisenhowerQuadrantTab/EisenhowerQuadrantTab";
import StaffPlannerTab from "@/components/StaffPlanner/StaffPlannerTab";
import styles from "./page.module.css";

type ZadaniaTab = "planner" | "eisenhower";

export default function AdminZadaniaPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading, user, userRole, logout } = useAuth();
  const [tab, setTab] = useState<ZadaniaTab>("planner");
  const uid = user?.uid ?? null;
  const { state: plannerState, setPlannerState, loading: plannerLoading } = useStaffPlanner(uid);

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Czy na pewno chcesz się wylogować?")) {
      logout();
    }
  }, [logout]);

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
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => router.push("/login")}
        >
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
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => router.push("/analyzer")}
        >
          Powrót
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <SidePanel
        players={[]}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin ?? false}
        userRole={userRole ?? undefined}
        linkedPlayerId={null}
        selectedTeam=""
        onRefreshData={async () => {
          toast.success("Odśwież dane na stronie głównej aplikacji.");
        }}
        onImportSuccess={() => {}}
        onImportError={(err) => toast.error(err)}
        onLogout={handleLogout}
      />
      <header className={styles.header}>
        <h1 className={styles.title}>Zadania — sztab</h1>
      </header>

      <div className={styles.tabBar} role="tablist" aria-label="Widok zadań">
        <button
          type="button"
          id="tab-planner"
          role="tab"
          aria-selected={tab === "planner"}
          className={`${styles.tab} ${tab === "planner" ? styles.tabActive : ""}`}
          onClick={() => setTab("planner")}
        >
          Plan tygodnia
        </button>
        <button
          type="button"
          id="tab-eisenhower"
          role="tab"
          aria-selected={tab === "eisenhower"}
          className={`${styles.tab} ${tab === "eisenhower" ? styles.tabActive : ""}`}
          onClick={() => setTab("eisenhower")}
        >
          Kwadrant Eisenhowera
        </button>
      </div>

      {tab === "planner" && uid && (
        <div role="tabpanel" id="panel-planner" aria-labelledby="tab-planner">
          <StaffPlannerTab
            state={plannerState}
            setPlannerState={setPlannerState}
            loading={plannerLoading}
          />
        </div>
      )}

      {tab === "eisenhower" && uid && (
        <div role="tabpanel" id="panel-eisenhower" aria-labelledby="tab-eisenhower">
          <EisenhowerQuadrantTab uid={uid} />
        </div>
      )}
    </div>
  );
}
