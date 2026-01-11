// src/components/Tabs/Tabs.tsx
"use client";

import React from "react";
import styles from "./Tabs.module.css";

export type Tab = "packing" | "acc8s" | "xg" | "regain_loses" | "pk_entries";

export interface TabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  const handleTabChange = (tab: Tab) => (e: React.MouseEvent) => {
    e.preventDefault();
    onTabChange(tab);
  };

  return (
    <div
      className={styles.tabsContainer}
      role="tablist"
      aria-orientation="horizontal"
    >
      <div className={styles.actionTypeSelector}>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "packing" ? styles.active : ""
          }`}
          onClick={handleTabChange("packing")}
          role="tab"
          aria-selected={activeTab === "packing"}
          aria-controls="packing-panel"
          id="packing-tab"
        >
          PxT
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "acc8s" ? styles.active : ""
          }`}
          onClick={handleTabChange("acc8s")}
          role="tab"
          aria-selected={activeTab === "acc8s"}
          aria-controls="acc8s-panel"
          id="acc8s-tab"
        >
          8s ACC
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "xg" ? styles.active : ""
          }`}
          onClick={handleTabChange("xg")}
          role="tab"
          aria-selected={activeTab === "xg"}
          aria-controls="xg-panel"
          id="xg-tab"
        >
          xG
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "regain_loses" ? styles.active : ""
          }`}
          onClick={handleTabChange("regain_loses")}
          role="tab"
          aria-selected={activeTab === "regain_loses"}
          aria-controls="regain-loses-panel"
          id="regain-loses-tab"
        >
          Regain/Loses
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "pk_entries" ? styles.active : ""
          }`}
          onClick={handleTabChange("pk_entries")}
          role="tab"
          aria-selected={activeTab === "pk_entries"}
          aria-controls="pk_entries-panel"
          id="pk_entries-tab"
        >
          Wejścia PK
        </button>
      </div>
    </div>
  );
}
