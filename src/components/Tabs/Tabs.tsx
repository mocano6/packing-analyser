// src/components/Tabs/Tabs.tsx
"use client";

import React from "react";
import styles from "./Tabs.module.css";

export type Tab = "packing" | "acc8s" | "xg" | "regain" | "loses" | "pk_entries";

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
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "packing" ? styles.active : ""
          }`}
          onClick={handleTabChange("packing")}
          role="tab"
          aria-selected={activeTab === "packing"}
          aria-controls="packing-panel"
          id="packing-tab"
        >
          Packing
        </button>
        <button
          className={`${styles.tab} ${
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
          className={`${styles.tab} ${
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
          className={`${styles.tab} ${
            activeTab === "regain" ? styles.active : ""
          }`}
          onClick={handleTabChange("regain")}
          role="tab"
          aria-selected={activeTab === "regain"}
          aria-controls="regain-panel"
          id="regain-tab"
        >
          Regain
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "loses" ? styles.active : ""
          }`}
          onClick={handleTabChange("loses")}
          role="tab"
          aria-selected={activeTab === "loses"}
          aria-controls="loses-panel"
          id="loses-tab"
        >
          Loses
        </button>
        <button
          className={`${styles.tab} ${
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
