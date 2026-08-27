"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Player } from "@/types";
import { POSITIONS } from "@/constants/positions";
import { parseLaczyTeamIdFromUrl } from "@/utils/laczyTeamUrl";
import {
  findExistingLnpDuplicate,
  toNewPlayerPayload,
  type LnpImportedPlayer,
} from "@/utils/lnpTeamPlayers";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./ImportLnpPlayersModal.module.css";

interface DraftRow extends LnpImportedPlayer {
  duplicateName?: string;
}

interface ImportLnpPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeam: string;
  existingPlayers: Player[];
  initialUrl?: string;
  onConfirm: (players: Omit<Player, "id">[]) => Promise<{ saved: number; errors: string[] }>;
}

const lnpUrlStorageKey = (teamId: string) => `microcycle_lnp_team_url_${teamId}`;

const ImportLnpPlayersModal: React.FC<ImportLnpPlayersModalProps> = ({
  isOpen,
  onClose,
  currentTeam,
  existingPlayers,
  initialUrl = "",
  onConfirm,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsFetching(false);
    setIsSaving(false);
    setTeamName(null);
    setRows([]);
    const saved =
      (initialUrl || "").trim() ||
      (typeof window !== "undefined" && currentTeam
        ? window.localStorage.getItem(lnpUrlStorageKey(currentTeam)) || ""
        : "");
    setUrl(saved);
  }, [isOpen, initialUrl, currentTeam]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isSaving, onClose]);

  const includedCount = useMemo(
    () => rows.filter((row) => !row.duplicateName).length,
    [rows]
  );

  const fetchPlayers = useCallback(async () => {
    const teamId = parseLaczyTeamIdFromUrl(url);
    if (!teamId) {
      setError("Wklej link do drużyny ŁNP (…/rozgrywki/druzyna/…) albo UUID.");
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/microcycle/team-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        teamName?: string;
        players?: LnpImportedPlayer[];
      };
      if (!res.ok || !data.ok || !Array.isArray(data.players)) {
        setRows([]);
        setError(data.error || data.message || "Nie udało się pobrać kadry z ŁNP.");
        return;
      }
      if (typeof window !== "undefined" && currentTeam) {
        window.localStorage.setItem(lnpUrlStorageKey(currentTeam), url.trim());
      }
      setTeamName(data.teamName || null);
      setRows(
        data.players.map((player) => {
          const duplicate = findExistingLnpDuplicate(player, existingPlayers);
          return {
            ...player,
            duplicateName: duplicate ? getPlayerFullName(duplicate) : undefined,
          };
        })
      );
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Błąd sieci podczas pobierania kadry.");
    } finally {
      setIsFetching(false);
    }
  }, [url, currentTeam, existingPlayers]);

  const updateRow = (lnpId: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((row) => (row.lnpId === lnpId ? { ...row, ...patch } : row)));
  };

  const removeRow = (lnpId: string) => {
    setRows((prev) => prev.filter((row) => row.lnpId !== lnpId));
  };

  const handleConfirm = async () => {
    const toSave = rows
      .filter((row) => !row.duplicateName)
      .map((row) => toNewPlayerPayload(row, currentTeam));
    if (toSave.length === 0) {
      setError("Nie ma zawodników do dodania. Usuń duplikaty albo pobierz kadrę ponownie.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await onConfirm(toSave);
      if (result.errors.length > 0 && result.saved === 0) {
        setError(result.errors.join(" "));
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu zawodników.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lnp-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id="lnp-import-title" className={styles.modalTitle}>
            Zawodnicy z Łączy Nas Piłka
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>
        <p className={styles.hint}>
          Wklej link do drużyny z zakładki Zawodnicy, pobierz listę, usuń zbędnych i zatwierdź
          dodanie do aktualnego zespołu.
        </p>
        <div className={styles.fetchRow}>
          <input
            type="url"
            className={styles.urlInput}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.laczynaspilka.pl/rozgrywki/druzyna/…?tab=tab-zawodnicy"
            aria-label="Link do drużyny Łączy Nas Piłka"
            disabled={isFetching || isSaving}
          />
          <button
            type="button"
            className={styles.fetchButton}
            onClick={() => void fetchPlayers()}
            disabled={isFetching || isSaving || !url.trim()}
          >
            {isFetching ? "Pobieram…" : "Pobierz listę"}
          </button>
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        {rows.length > 0 ? (
          <p className={styles.meta}>
            {teamName ? (
              <>
                Drużyna: <strong>{teamName}</strong>
                {" · "}
              </>
            ) : null}
            {includedCount} do dodania
            {rows.length - includedCount > 0
              ? ` · ${rows.length - includedCount} już w bazie`
              : null}
          </p>
        ) : null}
        <div className={styles.list} role="list">
          {rows.map((row) => (
            <div
              key={row.lnpId}
              className={`${styles.row} ${row.duplicateName ? styles.rowDuplicate : ""}`}
              role="listitem"
            >
              <input
                className={styles.numberInput}
                type="number"
                min={0}
                max={99}
                value={row.number}
                onChange={(e) => updateRow(row.lnpId, { number: Number(e.target.value) || 0 })}
                aria-label={`Numer ${row.firstName} ${row.lastName}`}
                disabled={isSaving}
              />
              <div className={styles.nameBlock}>
                <div className={styles.name}>
                  {row.firstName} {row.lastName}
                </div>
                {row.duplicateName ? (
                  <div className={styles.duplicateHint}>Już w bazie — pomijany przy zatwierdzeniu</div>
                ) : null}
              </div>
              <select
                className={styles.positionSelect}
                value={row.position}
                onChange={(e) => updateRow(row.lnpId, { position: e.target.value })}
                aria-label={`Pozycja ${row.firstName} ${row.lastName}`}
                disabled={isSaving}
              >
                <option value="">Pozycja</option>
                {POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
              <input
                className={styles.yearInput}
                type="number"
                min={1980}
                max={2020}
                placeholder="Rok"
                value={row.birthYear ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateRow(row.lnpId, {
                    birthYear: Number.isFinite(n) && e.target.value ? n : undefined,
                  });
                }}
                aria-label={`Rok urodzenia ${row.firstName} ${row.lastName}`}
                disabled={isSaving}
              />
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeRow(row.lnpId)}
                aria-label={`Usuń ${row.firstName} ${row.lastName} z listy`}
                title="Usuń z listy"
                disabled={isSaving}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
            Anuluj
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={() => void handleConfirm()}
            disabled={isSaving || isFetching || includedCount === 0}
          >
            {isSaving ? "Zapisuję…" : `Zatwierdź (${includedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportLnpPlayersModal;
