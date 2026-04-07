"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminSidebar.module.css";

const ADMIN_LINKS = [
  { href: "/admin", label: "Panel administratora", icon: "⚙️" },
  { href: "/admin/zadania", label: "Zadania (Eisenhower)", icon: "📋" },
  { href: "/admin/cleanup", label: "Czyszczenie PII", icon: "🧹" },
] as const;

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"}
        aria-expanded={isOpen}
      >
        <span className={styles.triggerIcon} aria-hidden>☰</span>
      </button>

      {isOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}
        aria-label="Menu panelu administratora"
        role="navigation"
      >
        <div className={styles.header}>
          <h3>Panel admin</h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setIsOpen(false)}
            aria-label="Zamknij menu"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <nav className={styles.nav}>
            {ADMIN_LINKS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.menuItem} ${pathname === href ? styles.menuItemActive : ""}`}
                onClick={() => setIsOpen(false)}
              >
                <span className={styles.icon}>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
            <div className={styles.homeItem}>
              <Link
                href="/analyzer"
                className={styles.menuItem}
                onClick={() => setIsOpen(false)}
              >
                <span className={styles.icon}>🏠</span>
                <span>Powrót do aplikacji</span>
              </Link>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
