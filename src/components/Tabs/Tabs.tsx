// src/components/Tabs/Tabs.tsx
"use client";

import React from "react";
import styles from "./Tabs.module.css";

export type Tab = "packing";

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
      </div>
    </div>
  );
}
