// src/app/gps/page.tsx
"use client";

import React from "react";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import GPSDataSection from "@/components/GPSDataSection/GPSDataSection";
import SidePanel from "@/components/SidePanel/SidePanel";
import styles from "./page.module.css";

export default function GPSPage() {
  const [selectedTeam, setSelectedTeam] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTeam') || "";
    }
    return "";
  });
  const { players } = usePlayersState(selectedTeam);
  const { teams: allAvailableTeams } = useTeams();
  const { isAdmin, userRole, userTeams, logout } = useAuth();

  // Automatycznie aktywuj tryb deweloperski (obejście uwierzytelniania)
  React.useEffect(() => {
    localStorage.setItem('packing_app_bypass_auth', 'true');
  }, []);

  // Zapisz selectedTeam do localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && selectedTeam) {
      localStorage.setItem('selectedTeam', selectedTeam);
    }
  }, [selectedTeam]);

  const handleRefreshData = async () => {
    window.location.reload();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Dane GPS zawodników</h1>
        <p className={styles.subtitle}>
          Wczytaj plik CSV z danymi GPS i przypisz do daty i zespołu
        </p>
      </div>

      <GPSDataSection
        players={players}
        allAvailableTeams={allAvailableTeams}
      />

      <SidePanel
        players={players}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin}
        userRole={userRole}
        selectedTeam={selectedTeam}
        onRefreshData={handleRefreshData}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
    </div>
  );
}
