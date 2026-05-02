"use client";

import React, { useState, useRef, useCallback, useId, useEffect } from "react";
import { Player, Action, TeamInfo } from "@/types";
import styles from "./ImportButton.module.css";
import { getAuthClient, getDB } from "@/lib/firebase";
import { doc, writeBatch, getDoc } from "@/lib/firestoreWithMetrics";
import { resolveImportedActionsByField, type MatchDocumentActionFieldKey } from "@/lib/inferActionMatchField";
import { isFirebasePermissionDenied } from "@/utils/isFirebasePermissionDenied";

interface ImportButtonProps {
  onImportSuccess: (data: { players: Player[]; actions: Action[]; matchInfo: TeamInfo }) => void | Promise<void>;
  onImportError: (error: string) => void;
}

const ACTION_FIELDS: MatchDocumentActionFieldKey[] = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
];

const ACTION_LABELS: Record<MatchDocumentActionFieldKey, string> = {
  actions_packing: "Packing (atak)",
  actions_unpacking: "Unpacking (obrona)",
  actions_regain: "Przechwyty",
  actions_loses: "Straty",
};

type ParsedImportFile = {
  matchInfo: TeamInfo;
  players: Player[];
  actions?: Action[];
  actionsByField?: Record<string, unknown>;
  formatVersion?: string;
  exportDate?: string;
};

type PreviewState = {
  fileName: string;
  data: ParsedImportFile;
  counts: Record<MatchDocumentActionFieldKey, number>;
  playerCount: number;
};

function removeUndefinedFields<T extends object>(obj: T): T {
  const result = { ...obj };
  Object.keys(result).forEach((key) => {
    if (result[key as keyof T] === undefined) {
      delete result[key as keyof T];
    }
  });
  return result;
}

function stripPIIFromAction(action: Action): Action {
  const {
    senderName,
    senderNumber,
    receiverName,
    receiverNumber,
    ...rest
  } = action as Action & {
    senderName?: string;
    senderNumber?: number;
    receiverName?: string;
    receiverNumber?: number;
  };
  return rest as Action;
}

function cleanActionForFirestore(action: Action): Action {
  return removeUndefinedFields(stripPIIFromAction(action)) as Action;
}

function cleanPlayerPayload(player: Player, teams: string[]): Record<string, unknown> {
  const base = removeUndefinedFields({ ...player, teams } as unknown as object);
  return base as Record<string, unknown>;
}

const ImportButton: React.FC<ImportButtonProps> = ({ onImportSuccess, onImportError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [importPlayers, setImportPlayers] = useState(false);
  const [actionToggles, setActionToggles] = useState<Record<MatchDocumentActionFieldKey, boolean>>({
    actions_packing: true,
    actions_unpacking: true,
    actions_regain: true,
    actions_loses: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const resetToggles = useCallback(() => {
    setImportPlayers(false);
    setActionToggles({
      actions_packing: true,
      actions_unpacking: true,
      actions_regain: true,
      actions_loses: true,
    });
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error("Nie udało się odczytać pliku"));
        }
      };
      reader.onerror = () => reject(new Error("Błąd podczas odczytu pliku"));
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) return;

    setIsLoading(true);
    try {
      const fileContent = await readFileAsText(file);
      const raw = JSON.parse(fileContent) as Partial<ParsedImportFile>;

      if (!raw.matchInfo) {
        throw new Error("Nieprawidłowy format pliku. Brak matchInfo.");
      }

      const data: ParsedImportFile = {
        matchInfo: raw.matchInfo,
        players: Array.isArray(raw.players) ? raw.players : [],
        actions: raw.actions,
        actionsByField: raw.actionsByField as ParsedImportFile["actionsByField"],
        formatVersion: raw.formatVersion,
        exportDate: raw.exportDate,
      };

      const byField = resolveImportedActionsByField(data);
      const counts = {
        actions_packing: byField.actions_packing.length,
        actions_unpacking: byField.actions_unpacking.length,
        actions_regain: byField.actions_regain.length,
        actions_loses: byField.actions_loses.length,
      };

      resetToggles();
      setPreview({
        fileName: file.name,
        data,
        counts,
        playerCount: data.players.length,
      });
    } catch (error) {
      console.error("Błąd wczytywania pliku:", error);
      onImportError(`Błąd: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setPreview(null);
  };

  const anyActionSelected =
    !!preview && ACTION_FIELDS.some((f) => actionToggles[f] && preview.counts[f] > 0);
  const playersSelected = !!preview && importPlayers && preview.playerCount > 0;
  const canConfirm = !!preview && (playersSelected || anyActionSelected);

  const handleConfirmImport = async () => {
    if (!preview) return;
    if (!canConfirm) {
      onImportError("Zaznacz co najmniej jedną kategorię danych do importu.");
      return;
    }

    setIsLoading(true);
    try {
      const fieldEnabled: Record<MatchDocumentActionFieldKey, boolean> = {
        actions_packing: actionToggles.actions_packing && preview.counts.actions_packing > 0,
        actions_unpacking: actionToggles.actions_unpacking && preview.counts.actions_unpacking > 0,
        actions_regain: actionToggles.actions_regain && preview.counts.actions_regain > 0,
        actions_loses: actionToggles.actions_loses && preview.counts.actions_loses > 0,
      };

      await importDataToDatabase(preview.data, {
        importPlayers: importPlayers && preview.playerCount > 0,
        actionFields: fieldEnabled,
      });

      const byField = resolveImportedActionsByField(preview.data);
      const actionsFlat: Action[] = ACTION_FIELDS.filter((f) => fieldEnabled[f]).flatMap((f) => byField[f]);

      await onImportSuccess({
        players: importPlayers ? preview.data.players : [],
        actions: actionsFlat,
        matchInfo: preview.data.matchInfo,
      });

      closeModal();
    } catch (error) {
      console.error("Błąd importu:", error);
      onImportError(`Błąd importu: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const importDataToDatabase = async (
    importedData: ParsedImportFile,
    opts: { importPlayers: boolean; actionFields: Record<MatchDocumentActionFieldKey, boolean> },
  ) => {
    const matchData: TeamInfo = { ...importedData.matchInfo };
    if (!matchData.matchId) {
      matchData.matchId = crypto.randomUUID();
    }
    if (!matchData.time) {
      matchData.time = "";
    }

    const tasks: Promise<unknown>[] = [];
    if (opts.importPlayers && importedData.players.length > 0) {
      tasks.push(importPlayersToFirestore(importedData.players, matchData));
    }
    if (ACTION_FIELDS.some((f) => opts.actionFields[f])) {
      tasks.push(importMatchDocumentActions(importedData, matchData, opts.actionFields));
    }
    await Promise.all(tasks);
  };

  /**
   * Dokument players/{playerId} — id jak w eksporcie / aplikacji; merge: true scala teams bez setek duplikatów dokumentów.
   */
  const importPlayersToFirestore = async (players: Player[], matchInfo: TeamInfo) => {
    const db = getDB();
    const teamTag = String(matchInfo.team ?? matchInfo.teamId ?? "").trim();
    if (!teamTag) {
      throw new Error("Brak identyfikatora zespołu (team) w matchInfo — nie można przypisać zawodników");
    }

    let batch = writeBatch(db);
    let n = 0;

    const commitIfNeeded = async (force = false) => {
      if (n >= 450 || force) {
        if (n > 0) await batch.commit();
        batch = writeBatch(db);
        n = 0;
      }
    };

    for (const player of players) {
      if (!player?.id?.trim()) continue;

      const ref = doc(db, "players", player.id);
      let existingTeams: string[] = [];
      try {
        const snap = await getDoc(ref);
        if (snap.exists() && Array.isArray((snap.data() as Player).teams)) {
          existingTeams = [...((snap.data() as Player).teams as string[])];
        }
      } catch (e) {
        // Stare reguły często zwracają permission-denied przy get na brakującym dokumencie — wtedy merge jak przy nowym zawodniku.
        if (!isFirebasePermissionDenied(e)) throw e;
      }

      const fromExport = Array.isArray(player.teams) ? player.teams : [];
      const teams = [...new Set([...existingTeams, ...fromExport, teamTag].filter(Boolean))];

      const payload = cleanPlayerPayload({ ...player, id: player.id }, teams);
      batch.set(ref, payload, { merge: true });
      n++;
      await commitIfNeeded();
    }
    await commitIfNeeded(true);
  };

  const importMatchDocumentActions = async (
    importedData: Pick<ParsedImportFile, "actions" | "actionsByField">,
    matchData: TeamInfo,
    enabled: Record<MatchDocumentActionFieldKey, boolean>,
  ) => {
    const matchId = matchData.matchId;
    if (!matchId) {
      throw new Error("Brak matchId po normalizacji importu");
    }

    const byField = resolveImportedActionsByField(importedData);
    const hasAny = ACTION_FIELDS.some((f) => enabled[f] && byField[f].length > 0);
    if (!hasAny) {
      return;
    }

    const teamId = String(matchData.teamId ?? matchData.team ?? "").trim();
    if (!teamId) {
      throw new Error("Brak identyfikatora zespołu (team) w matchInfo — wymagany do zapisu meczu w Firestore");
    }

    const incomingByField: Partial<Record<MatchDocumentActionFieldKey, Action[]>> = {};
    for (const field of ACTION_FIELDS) {
      if (!enabled[field]) continue;
      const incoming = byField[field];
      if (incoming.length === 0) continue;
      incomingByField[field] = incoming;
    }
    if (Object.keys(incomingByField).length === 0) {
      return;
    }

    const auth = getAuthClient();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Musisz być zalogowany, aby zaimportować dane meczu.");
    }
    const idToken = await user.getIdToken();
    const res = await fetch("/api/matches/import-merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        matchId,
        matchMeta: matchData,
        incomingByField,
      }),
    });
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const errMsg =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `HTTP ${res.status}`;
    if (!res.ok) {
      throw new Error(errMsg);
    }
  };

  return (
    <>
      <button
        className={`${styles.importButton} import-button`}
        onClick={handleImportClick}
        disabled={isLoading}
        title="Importuj dane z pliku JSON"
        type="button"
      >
        <span className={styles.icon} aria-hidden>
          {isLoading && !preview ? "\u23F3" : "\uD83D\uDCE5"}
        </span>
        {isLoading && !preview ? "Wczytywanie..." : "Importuj dane"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden
      />

      {preview && (
        <div className={styles.modalOverlay} role="presentation" onClick={closeModal}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className={styles.modalTitle}>
              Import danych z pliku
            </h2>
            <p id={descId} className={styles.modalMeta}>
              Plik: <strong>{preview.fileName}</strong>
              {preview.data.formatVersion && (
                <>
                  {" "}
                  · format <strong>{preview.data.formatVersion}</strong>
                </>
              )}
              {preview.data.exportDate && (
                <>
                  {" "}
                  · eksport <strong>{new Date(preview.data.exportDate).toLocaleString("pl-PL")}</strong>
                </>
              )}
            </p>

            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Mecz w pliku</h3>
              <ul className={styles.modalList}>
                <li>
                  <span className={styles.modalLabel}>ID meczu:</span> {preview.data.matchInfo.matchId ?? "—"}
                </li>
                <li>
                  <span className={styles.modalLabel}>Zespół:</span>{" "}
                  {String(preview.data.matchInfo.team ?? preview.data.matchInfo.teamId ?? "—")}
                </li>
                <li>
                  <span className={styles.modalLabel}>Przeciwnik:</span> {preview.data.matchInfo.opponent ?? "—"}
                </li>
                <li>
                  <span className={styles.modalLabel}>Data:</span> {preview.data.matchInfo.date ?? "—"}
                </li>
                <li>
                  <span className={styles.modalLabel}>Rozgrywki:</span> {preview.data.matchInfo.competition ?? "—"}
                </li>
              </ul>
            </div>

            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Co zaimportować?</h3>
              <p className={styles.modalHint}>Odznacz kategorie, których nie chcesz nadpisywać ani dodawać.</p>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={importPlayers}
                  onChange={(e) => setImportPlayers(e.target.checked)}
                  disabled={preview.playerCount === 0}
                />
                <span>
                  Zawodnicy w pliku ({preview.playerCount}
                  {preview.playerCount === 0 ? " — brak na liście" : ""})
                </span>
              </label>

              {ACTION_FIELDS.map((field) => (
                <label key={field} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={actionToggles[field]}
                    onChange={(e) =>
                      setActionToggles((prev) => ({
                        ...prev,
                        [field]: e.target.checked,
                      }))
                    }
                    disabled={preview.counts[field] === 0}
                  />
                  <span>
                    {ACTION_LABELS[field]} ({preview.counts[field]})
                  </span>
                </label>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalBtnSecondary} onClick={closeModal} disabled={isLoading}>
                Anuluj
              </button>
              <button
                type="button"
                className={styles.modalBtnPrimary}
                onClick={() => void handleConfirmImport()}
                disabled={isLoading || !canConfirm}
              >
                {isLoading ? "Importowanie..." : "Importuj zaznaczone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportButton;
