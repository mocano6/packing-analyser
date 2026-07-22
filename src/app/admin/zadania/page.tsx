"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useStaffPlanner } from "@/hooks/useStaffPlanner";
import { useTeams } from "@/hooks/useTeams";
import SidePanel from "@/components/SidePanel/SidePanel";
import toast from "react-hot-toast";
import EisenhowerQuadrantTab from "@/components/EisenhowerQuadrantTab/EisenhowerQuadrantTab";
import ModelPanel from "@/components/ModelPanel/ModelPanel";
import StaffPlannerTab from "@/components/StaffPlanner/StaffPlannerTab";
import TrainingMicrocycleTab from "@/components/TrainingMicrocycleTab/TrainingMicrocycleTab";
import { useGameModel } from "@/hooks/useGameModel";
import { useGameModelPacks } from "@/hooks/useGameModelPacks";
import { usePositionSystem } from "@/hooks/usePositionSystem";
import { useTrainingDayTitleTemplates } from "@/hooks/useTrainingDayTitleTemplates";
import { useTrainingMicrocycle } from "@/hooks/useTrainingMicrocycle";
import {
  filterTeamsByUserAccess,
  isTeamIdAccessibleForUser,
} from "@/lib/teamsForUserAccess";
import {
  readAdminZadaniaTab,
  writeAdminZadaniaTab,
  type AdminZadaniaTabId,
} from "@/utils/adminZadaniaTabPreference";
import styles from "./page.module.css";

type ZadaniaTab = AdminZadaniaTabId;

export default function AdminZadaniaPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isLoading, user, userRole, userTeams, logout } = useAuth();
  const { teams, isLoading: teamsLoading } = useTeams();
  const [tab, setTab] = useState<ZadaniaTab>("planner");
  const [selectedTeam, setSelectedTeam] = useState("");
  const uid = user?.uid ?? null;

  const userTeamAccess = useMemo(
    () => ({ isAdmin: !!isAdmin, allowedTeamIds: userTeams ?? [] }),
    [isAdmin, userTeams]
  );

  const availableTeams = useMemo(
    () => filterTeamsByUserAccess(teams, userTeamAccess),
    [teams, userTeamAccess]
  );

  const selectedTeamId = useMemo(() => {
    if (selectedTeam && isTeamIdAccessibleForUser(selectedTeam, userTeamAccess)) {
      return selectedTeam;
    }
    return availableTeams[0]?.id ?? "";
  }, [availableTeams, selectedTeam, userTeamAccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("selectedTeam") || "";
    if (stored && isTeamIdAccessibleForUser(stored, userTeamAccess)) {
      setSelectedTeam(stored);
      return;
    }
    if (availableTeams.length > 0) {
      setSelectedTeam(availableTeams[0].id);
    }
  }, [availableTeams, userTeamAccess]);

  useEffect(() => {
    if (selectedTeamId) {
      localStorage.setItem("selectedTeam", selectedTeamId);
    }
  }, [selectedTeamId]);

  const { state: plannerState, setPlannerState, loading: plannerLoading } = useStaffPlanner(uid);
  const {
    state: gameModelState,
    setGameModelState,
    loading: gameModelLoading,
  } = useGameModel(selectedTeamId || null, uid);
  const {
    state: positionSystemState,
    setPositionSystemState,
    loading: positionSystemLoading,
  } = usePositionSystem(selectedTeamId || null, uid);
  const {
    state: packsState,
    setPacksState,
    loading: packsLoading,
  } = useGameModelPacks(uid);
  const {
    state: microcycleState,
    setMicrocycleState,
    loading: microcycleLoading,
    embeddedDayTitleTemplates,
    clearEmbeddedDayTitleTemplates,
  } = useTrainingMicrocycle(selectedTeamId || null, uid);
  const {
    state: dayTitleTemplatesState,
    setDayTitleTemplatesState,
    loading: dayTitleTemplatesLoading,
    mergeEmbeddedTemplates,
  } = useTrainingDayTitleTemplates(uid);

  useEffect(() => {
    if (microcycleLoading || dayTitleTemplatesLoading) return;
    if (embeddedDayTitleTemplates.length === 0) return;
    mergeEmbeddedTemplates(embeddedDayTitleTemplates);
    clearEmbeddedDayTitleTemplates();
  }, [
    microcycleLoading,
    dayTitleTemplatesLoading,
    embeddedDayTitleTemplates,
    mergeEmbeddedTemplates,
    clearEmbeddedDayTitleTemplates,
  ]);

  const handleTeamChange = useCallback(
    (teamId: string) => {
      if (!isTeamIdAccessibleForUser(teamId, userTeamAccess)) return;
      setSelectedTeam(teamId);
    },
    [userTeamAccess]
  );

  useLayoutEffect(() => {
    if (!uid) return;
    setTab(readAdminZadaniaTab(uid));
  }, [uid]);

  const selectTab = useCallback(
    (next: ZadaniaTab) => {
      setTab(next);
      writeAdminZadaniaTab(uid, next);
    },
    [uid]
  );

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
        selectedTeam={selectedTeamId}
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
          onClick={() => selectTab("planner")}
        >
          Plan tygodnia
        </button>
        <button
          type="button"
          id="tab-eisenhower"
          role="tab"
          aria-selected={tab === "eisenhower"}
          className={`${styles.tab} ${tab === "eisenhower" ? styles.tabActive : ""}`}
          onClick={() => selectTab("eisenhower")}
        >
          Kwadrant Eisenhowera
        </button>
        <button
          type="button"
          id="tab-model"
          role="tab"
          aria-selected={tab === "model"}
          className={`${styles.tab} ${tab === "model" ? styles.tabActive : ""}`}
          onClick={() => selectTab("model")}
        >
          Model
        </button>
        <button
          type="button"
          id="tab-microcycle"
          role="tab"
          aria-selected={tab === "microcycle"}
          className={`${styles.tab} ${tab === "microcycle" ? styles.tabActive : ""}`}
          onClick={() => selectTab("microcycle")}
        >
          Mikrocykl
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

      {tab === "model" && uid && (
        <div role="tabpanel" id="panel-model" aria-labelledby="tab-model">
          <ModelPanel
            gameModelState={gameModelState}
            setGameModelState={setGameModelState}
            gameModelLoading={gameModelLoading || teamsLoading}
            positionSystemState={positionSystemState}
            setPositionSystemState={setPositionSystemState}
            positionSystemLoading={positionSystemLoading}
            packsState={packsState}
            setPacksState={setPacksState}
            packsLoading={packsLoading}
            selectedTeam={selectedTeamId}
            onTeamChange={handleTeamChange}
            teamsCatalog={teams}
            userTeamAccess={userTeamAccess}
          />
        </div>
      )}

      {tab === "microcycle" && uid && (
        <div role="tabpanel" id="panel-microcycle" aria-labelledby="tab-microcycle">
          <TrainingMicrocycleTab
            microcycleState={microcycleState}
            setMicrocycleState={setMicrocycleState}
            microcycleLoading={microcycleLoading || teamsLoading}
            dayTitleTemplatesState={dayTitleTemplatesState}
            setDayTitleTemplatesState={setDayTitleTemplatesState}
            dayTitleTemplatesLoading={dayTitleTemplatesLoading}
            gameModelState={gameModelState}
            gameModelLoading={gameModelLoading}
            selectedTeam={selectedTeamId}
            onTeamChange={handleTeamChange}
            teamsCatalog={teams}
            userTeamAccess={userTeamAccess}
          />
        </div>
      )}
    </div>
  );
}
