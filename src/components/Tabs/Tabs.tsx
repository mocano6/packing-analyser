// src/components/Tabs/Tabs.tsx
"use client";

import React from "react";
import styles from "./Tabs.module.css";
import type { Tab } from "./Tabs.types";
import { getTabForShortcutKey } from "./tabShortcuts";

export interface TabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  const handleTabChange = (tab: Tab) => (e: React.MouseEvent) => {
    e.preventDefault();
    onTabChange(tab);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = getTabForShortcutKey(e.key);
    if (!next) return;
    e.preventDefault();
    onTabChange(next);
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
            activeTab === "acc8s" ? styles.active : ""
          }`}
          onClick={handleTabChange("acc8s")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          aria-selected={activeTab === "acc8s"}
          aria-controls="acc8s-panel"
          id="acc8s-tab"
          aria-keyshortcuts="Q"
          title="Skrót: Q"
          type="button"
        >
          <span className={styles.tabText}>8s ACC</span>
          <span className={styles.tabShortcut} aria-hidden="true">
            Q
          </span>
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "pk_entries" ? styles.active : ""
          }`}
          onClick={handleTabChange("pk_entries")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          aria-selected={activeTab === "pk_entries"}
          aria-controls="pk_entries-panel"
          id="pk_entries-tab"
          aria-keyshortcuts="W"
          title="Skrót: W"
          type="button"
        >
          <span className={styles.tabText}>Wejścia PK</span>
          <span className={styles.tabShortcut} aria-hidden="true">
            W
          </span>
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "xg" ? styles.active : ""
          }`}
          onClick={handleTabChange("xg")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          aria-selected={activeTab === "xg"}
          aria-controls="xg-panel"
          id="xg-tab"
          aria-keyshortcuts="E"
          title="Skrót: E"
          type="button"
        >
          <span className={styles.tabText}>xG</span>
          <span className={styles.tabShortcut} aria-hidden="true">
            E
          </span>
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "packing" ? styles.active : ""
          }`}
          onClick={handleTabChange("packing")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          aria-selected={activeTab === "packing"}
          aria-controls="packing-panel"
          id="packing-tab"
          aria-keyshortcuts="R"
          title="Skrót: R"
          type="button"
        >
          <span className={styles.tabText}>PxT</span>
          <span className={styles.tabShortcut} aria-hidden="true">
            R
          </span>
        </button>
        <button
          className={`${styles.actionTypeButton} ${
            activeTab === "regain_loses" ? styles.active : ""
          }`}
          onClick={handleTabChange("regain_loses")}
          onKeyDown={handleTabKeyDown}
          role="tab"
          aria-selected={activeTab === "regain_loses"}
          aria-controls="regain-loses-panel"
          id="regain-loses-tab"
          aria-keyshortcuts="T"
          title="Skrót: T"
          type="button"
        >
          <span className={styles.tabText}>Regain/Loses</span>
          <span className={styles.tabShortcut} aria-hidden="true">
            T
          </span>
        </button>
      </div>
    </div>
  );
}
