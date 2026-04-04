"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { loadTrendyKpiDefinitions, saveTrendyKpiDefinition, seedDefaultTrendyKpisIfEmpty } from "@/lib/trendyKpiStore";
import { TrendyKpiDefinition } from "@/utils/trendyKpis";
import styles from "./kpi.module.css";

export default function AdminKpiPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [definitions, setDefinitions] = useState<TrendyKpiDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    (async () => {
      try {
        await seedDefaultTrendyKpisIfEmpty();
      } catch {
        // Brak uprawnień do seedu nie blokuje dalszego odczytu.
      }
      const rows = await loadTrendyKpiDefinitions();
      setDefinitions(rows);
    })();
  }, [isAuthenticated, isAdmin]);

  const canRender = useMemo(() => isAuthenticated && isAdmin, [isAuthenticated, isAdmin]);

  const updateDefinition = (id: string, patch: Partial<TrendyKpiDefinition>) => {
    setDefinitions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus("");
    try {
      await Promise.all(definitions.map((item) => saveTrendyKpiDefinition(item)));
      setStatus("Zapisano definicje KPI.");
    } catch (err: any) {
      const message =
        typeof err?.message === "string"
          ? err.message
          : typeof err === "string"
            ? err
            : "Nieznany błąd";
      setStatus(`Nie udało się zapisać zmian. ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className={styles.centered}>Ładowanie...</div>;
  if (!canRender) return <div className={styles.centered}>Brak uprawnień do tej strony.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>KPI trendów</h1>
        <Link href="/admin" className={styles.backButton}>
          Powrót do panelu admina
        </Link>
      </div>

      <p className={styles.description}>
        Tutaj definiujesz cele KPI używane na stronie <strong>Trendy</strong>. Każda zmiana aktualizuje linię celu i ocenę KPI.
      </p>

      <div className={styles.table}>
        <div className={styles.rowHeader}>
          <span>Label</span>
          <span>Target</span>
          <span>Kierunek</span>
          <span>Jednostka</span>
          <span>Aktywny</span>
          <span>Kolejność</span>
        </div>
        {definitions.map((item) => (
          <div key={item.id} className={styles.row}>
            <div className={styles.cellLabel}>
              <span className={styles.id}>{item.id}</span>
              <input value={item.label} onChange={(e) => updateDefinition(item.id, { label: e.target.value })} className={styles.input} />
            </div>
            <input
              type="number"
              value={item.target}
              onChange={(e) => updateDefinition(item.id, { target: Number(e.target.value) })}
              className={styles.input}
            />
            <select
              value={item.direction}
              onChange={(e) => updateDefinition(item.id, { direction: e.target.value as TrendyKpiDefinition["direction"] })}
              className={styles.input}
            >
              <option value="higher">higher</option>
              <option value="lower">lower</option>
            </select>
            <select
              value={item.unit}
              onChange={(e) => updateDefinition(item.id, { unit: e.target.value as TrendyKpiDefinition["unit"] })}
              className={styles.input}
            >
              <option value="number">number</option>
              <option value="percent">percent</option>
              <option value="ratio">ratio</option>
              <option value="seconds">seconds</option>
            </select>
            <label className={styles.checkboxWrap}>
              <input type="checkbox" checked={item.active} onChange={(e) => updateDefinition(item.id, { active: e.target.checked })} />
            </label>
            <input
              type="number"
              value={item.order}
              onChange={(e) => updateDefinition(item.id, { order: Number(e.target.value) })}
              className={styles.input}
            />
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button onClick={handleSave} disabled={isSaving} className={styles.saveButton} type="button">
          {isSaving ? "Zapisywanie..." : "Zapisz KPI"}
        </button>
        {status && <span className={styles.status}>{status}</span>}
      </div>
    </div>
  );
}
