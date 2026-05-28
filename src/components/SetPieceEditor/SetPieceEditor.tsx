"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Player } from "@/types";
import type {
  SetPieceFrame,
  SetPieceMatchDocument,
  SetPieceSetup,
  SetPieceTypeId,
  SetPieceVariantId,
  SetPieceZoneKind,
} from "@/types/setPieces";
import SetPieceAnimationPlayer from "@/components/SetPieceAnimationPlayer/SetPieceAnimationPlayer";
import {
  createEmptyFrame,
  createInitialFrames,
  duplicateFrame,
  setupHasSavedLayout,
} from "@/utils/setPieceFrames";
import {
  buildSetupStorageKey,
  DEFAULT_SET_PIECE_VARIANT,
  generateOpponentPlayerId,
  getVariantsForSetPieceType,
  SET_PIECE_TYPE_OPTIONS,
  SET_PIECE_VARIANT_IDS,
} from "@/lib/setPiecePresets";
import SetPiecePitch, { type SetPiecePitchPlayerView, type SetPiecePitchTool } from "@/components/SetPiecePitch/SetPiecePitch";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { compressSetPiecePlayerImage } from "@/utils/setPieceImage";
import {
  applyPlayerOverride,
  loadSetPieceMatchDocument,
  saveSetPieceMatchDocument,
  syncSetupPlayers,
  syncSetupRoster,
  upsertSetup,
} from "@/utils/setPiecesStorage";
import styles from "./SetPieceEditor.module.css";

interface SetPieceEditorProps {
  matchId: string;
  teamId: string;
  squadPlayers: Player[];
}

function generateZoneId(): string {
  return `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const SetPieceEditor: React.FC<SetPieceEditorProps> = ({ matchId, teamId, squadPlayers }) => {
  const [doc, setDoc] = useState<SetPieceMatchDocument>(() => loadSetPieceMatchDocument(matchId, teamId));
  const [activeType, setActiveType] = useState<SetPieceTypeId>("corner_attack");
  const [activeVariant, setActiveVariant] = useState<SetPieceVariantId>(DEFAULT_SET_PIECE_VARIANT);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<SetPiecePitchTool>("move");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draftZone, setDraftZone] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [newZoneKind, setNewZoneKind] = useState<SetPieceZoneKind>("movement");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const playersIndex = useMemo(() => buildPlayersIndex(squadPlayers), [squadPlayers]);

  useEffect(() => {
    setDoc(loadSetPieceMatchDocument(matchId, teamId));
    setSelectedPlayerId(null);
    setActiveVariant(DEFAULT_SET_PIECE_VARIANT);
    setActiveFrameIndex(0);
  }, [matchId, teamId]);

  useEffect(() => {
    if (SET_PIECE_VARIANT_IDS.includes(activeVariant)) return;
    setActiveVariant(DEFAULT_SET_PIECE_VARIANT);
  }, [activeVariant]);

  const setupStorageKey = buildSetupStorageKey(activeType, activeVariant);

  const selectTypeAndVariant = (type: SetPieceTypeId, variant: SetPieceVariantId) => {
    setActiveType(type);
    setActiveVariant(variant);
    setActiveFrameIndex(0);
  };

  useEffect(() => {
    saveSetPieceMatchDocument(doc);
    setSavedAt(new Date().toLocaleTimeString("pl-PL"));
  }, [doc]);

  const setup: SetPieceSetup = useMemo(() => {
    const existing = doc.setups[setupStorageKey];
    if (existing) {
      return {
        ...existing,
        opponentPlayers: existing.opponentPlayers ?? [],
        selectedOpponentIds: existing.selectedOpponentIds ?? [],
      };
    }
    return {
      type: activeType,
      variant: activeVariant,
      matchId,
      teamId,
      updatedAt: new Date().toISOString(),
      selectedPlayerIds: [],
      opponentPlayers: [],
      selectedOpponentIds: [],
      frames: createInitialFrames([], activeType, activeVariant),
    };
  }, [activeType, activeVariant, doc.setups, matchId, setupStorageKey, teamId]);

  const updateSetup = useCallback(
    (updater: (prev: SetPieceSetup) => SetPieceSetup) => {
      setDoc((prev) => {
        const current = prev.setups[setupStorageKey] ?? setup;
        return upsertSetup(prev, updater(current));
      });
    },
    [setup, setupStorageKey],
  );

  const safeFrameIndex = Math.min(activeFrameIndex, Math.max(0, setup.frames.length - 1));
  const currentFrame: SetPieceFrame =
    setup.frames[safeFrameIndex] ?? setup.frames[0] ?? createEmptyFrame(0);

  const updateCurrentFrame = useCallback(
    (updater: (frame: SetPieceFrame) => SetPieceFrame) => {
      updateSetup((prev) => ({
        ...prev,
        frames: prev.frames.map((frame, index) => (index === safeFrameIndex ? updater(frame) : frame)),
      }));
    },
    [safeFrameIndex, updateSetup],
  );

  const playersById = useMemo(() => {
    const map: Record<string, SetPiecePitchPlayerView> = {};
    for (const player of squadPlayers) {
      const override = doc.playerOverrides[player.id];
      map[player.id] = {
        playerId: player.id,
        number: player.number,
        label: override?.displayName?.trim() || getPlayerLabel(player.id, playersIndex),
        imageUrl: override?.imageUrl || player.imageUrl,
        side: "own",
      };
    }
    for (const opponent of setup.opponentPlayers ?? []) {
      map[opponent.id] = {
        playerId: opponent.id,
        number: opponent.number,
        label: opponent.label,
        side: "opponent",
      };
    }
    return map;
  }, [doc.playerOverrides, playersIndex, setup.opponentPlayers, squadPlayers]);

  const activePitchPlayerIds = useMemo(
    () => [...setup.selectedPlayerIds, ...(setup.selectedOpponentIds ?? [])],
    [setup.selectedOpponentIds, setup.selectedPlayerIds],
  );

  const hasAnyoneOnPitch = activePitchPlayerIds.length > 0;

  const togglePlayerIncluded = (playerId: string) => {
    const selected = new Set(setup.selectedPlayerIds);
    if (selected.has(playerId)) {
      selected.delete(playerId);
    } else {
      selected.add(playerId);
    }
    const nextIds = Array.from(selected);
    updateSetup((prev) => syncSetupPlayers({ ...prev, selectedPlayerIds: nextIds }, nextIds));
    if (!nextIds.includes(selectedPlayerId ?? "")) {
      setSelectedPlayerId(null);
    }
  };

  const updatePlayerOverride = (playerId: string, patch: { displayName?: string; imageUrl?: string }) => {
    setDoc((prev) => applyPlayerOverride(prev, playerId, patch));
  };

  const handleMoveMarker = (playerId: string, x: number, y: number) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      markers: frame.markers.map((marker) =>
        marker.playerId === playerId ? { ...marker, x, y } : marker,
      ),
    }));
  };

  const handleZoneDrawComplete = (rect: { x: number; y: number; width: number; height: number }) => {
    const label =
      newZoneKind === "target" ? `Cel ${currentFrame.zones.length + 1}` : `Strefa ${currentFrame.zones.length + 1}`;
    updateCurrentFrame((frame) => ({
      ...frame,
      zones: [
        ...frame.zones,
        {
          id: generateZoneId(),
          ...rect,
          label,
          kind: newZoneKind,
          task: "",
        },
      ],
    }));
    setActiveTool("move");
  };

  const removeZone = (zoneId: string) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      zones: frame.zones.filter((zone) => zone.id !== zoneId),
    }));
  };

  const updateZoneLabel = (zoneId: string, label: string) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      zones: frame.zones.map((zone) => (zone.id === zoneId ? { ...zone, label } : zone)),
    }));
  };

  const updateZoneTask = (zoneId: string, task: string) => {
    updateCurrentFrame((frame) => ({
      ...frame,
      zones: frame.zones.map((zone) => (zone.id === zoneId ? { ...zone, task } : zone)),
    }));
  };

  const addFrame = () => {
    updateSetup((prev) => {
      const source = prev.frames[safeFrameIndex] ?? prev.frames[0];
      const newFrame = duplicateFrame(source, prev.frames.length);
      setActiveFrameIndex(prev.frames.length);
      return { ...prev, frames: [...prev.frames, newFrame] };
    });
  };

  const removeCurrentFrame = () => {
    if (setup.frames.length <= 1) return;
    updateSetup((prev) => {
      const frames = prev.frames.filter((_, index) => index !== safeFrameIndex);
      setActiveFrameIndex((index) => Math.min(index, frames.length - 1));
      return { ...prev, frames };
    });
  };

  const selectedAssignment = currentFrame.assignments.find((item) => item.playerId === selectedPlayerId);
  const selectedPlayer = squadPlayers.find((player) => player.id === selectedPlayerId);
  const selectedOpponent = setup.opponentPlayers.find((player) => player.id === selectedPlayerId);

  const toggleOpponentIncluded = (opponentId: string) => {
    const selected = new Set(setup.selectedOpponentIds ?? []);
    if (selected.has(opponentId)) {
      selected.delete(opponentId);
    } else {
      selected.add(opponentId);
    }
    const nextIds = Array.from(selected);
    updateSetup((prev) => syncSetupRoster(prev, prev.selectedPlayerIds, nextIds));
    if (!nextIds.includes(selectedPlayerId ?? "")) {
      setSelectedPlayerId(null);
    }
  };

  const addOpponentPlayer = () => {
    const id = generateOpponentPlayerId();
    const label = `Przeciwnik ${setup.opponentPlayers.length + 1}`;
    const number = setup.opponentPlayers.length + 1;
    const nextOpponents = [...setup.opponentPlayers, { id, label, number }];
    const nextSelected = [...(setup.selectedOpponentIds ?? []), id];
    updateSetup((prev) =>
      syncSetupRoster({ ...prev, opponentPlayers: nextOpponents }, prev.selectedPlayerIds, nextSelected),
    );
    setSelectedPlayerId(id);
  };

  const removeOpponentPlayer = (opponentId: string) => {
    const nextOpponents = setup.opponentPlayers.filter((player) => player.id !== opponentId);
    const nextSelected = (setup.selectedOpponentIds ?? []).filter((id) => id !== opponentId);
    updateSetup((prev) => syncSetupRoster({ ...prev, opponentPlayers: nextOpponents }, prev.selectedPlayerIds, nextSelected));
    if (selectedPlayerId === opponentId) {
      setSelectedPlayerId(null);
    }
  };

  const updateOpponentPlayer = (opponentId: string, patch: { label?: string; number?: number }) => {
    updateSetup((prev) => ({
      ...prev,
      opponentPlayers: prev.opponentPlayers.map((player) =>
        player.id === opponentId ? { ...player, ...patch } : player,
      ),
    }));
  };

  const handlePhotoFile = async (file: File | null) => {
    if (!file || !selectedPlayerId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") return;
      const compressed = await compressSetPiecePlayerImage(result);
      updatePlayerOverride(selectedPlayerId, { imageUrl: compressed });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.typeTabs} role="tablist" aria-label="Typ stałego fragmentu">
        {SET_PIECE_TYPE_OPTIONS.map((option) => {
          const isTypeActive = activeType === option.id;
          const variants = getVariantsForSetPieceType(option.id);
          return (
            <div
              key={option.id}
              role="tab"
              aria-selected={isTypeActive}
              className={`${styles.typeTab} ${isTypeActive ? styles.typeTabActive : ""}`}
            >
              <button
                type="button"
                className={styles.typeTabHeader}
                onClick={() =>
                  selectTypeAndVariant(
                    option.id,
                    activeType === option.id ? activeVariant : DEFAULT_SET_PIECE_VARIANT,
                  )
                }
              >
                <span className={styles.typeTabLabel}>{option.label}</span>
                <span className={styles.typeTabDesc}>{option.description}</span>
              </button>
              <div className={styles.typeTabVariants} role="group" aria-label={`Warianty — ${option.label}`}>
                {variants.map((variant) => {
                  const isVariantActive = isTypeActive && activeVariant === variant.id;
                  const hasSaved = setupHasSavedLayout(doc.setups[buildSetupStorageKey(option.id, variant.id)]);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={`${styles.variantChip} ${isVariantActive ? styles.variantChipActive : ""}`}
                      onClick={() => selectTypeAndVariant(option.id, variant.id)}
                      aria-pressed={isVariantActive}
                      title={variant.title}
                    >
                      <span className={styles.variantIcon} aria-hidden="true">
                        {variant.label}
                      </span>
                      {hasSaved && <span className={styles.variantSavedDot} title="Zapisany układ" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === "move" ? styles.toolButtonActive : ""}`}
          onClick={() => setActiveTool("move")}
        >
          Przesuwaj zawodników
        </button>
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === "drawZone" ? styles.toolButtonActive : ""}`}
          onClick={() => setActiveTool("drawZone")}
        >
          Rysuj strefę
        </button>
        <label className={styles.fieldLabel} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span>Typ strefy</span>
          <select
            className={styles.selectInput}
            style={{ width: "auto", minWidth: 140 }}
            value={newZoneKind}
            onChange={(event) => setNewZoneKind(event.target.value as SetPieceZoneKind)}
          >
            <option value="movement">Ruch / obszar</option>
            <option value="target">Cel</option>
          </select>
        </label>
        {savedAt && <p className={styles.savedHint}>Zapis lokalny: {savedAt}</p>}
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <h3 className={styles.sectionTitle}>Skład meczu</h3>
          <p className={styles.helpText}>
            Zaznacz zawodników biorących udział w tym stałym fragmencie. Zmiany zdjęcia i nazwiska synchronizują się
            między wszystkimi typami SF tego meczu.
          </p>
          <div className={styles.playerList}>
            {squadPlayers.map((player) => {
              const included = setup.selectedPlayerIds.includes(player.id);
              const isSelected = selectedPlayerId === player.id;
              return (
                <div
                  key={player.id}
                  className={`${styles.playerRow} ${included ? styles.playerRowIncluded : ""} ${
                    isSelected ? styles.playerRowSelected : ""
                  }`}
                  onClick={() => setSelectedPlayerId(player.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedPlayerId(player.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    type="checkbox"
                    className={styles.playerCheckbox}
                    checked={included}
                    onChange={() => togglePlayerIncluded(player.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Uwzględnij ${getPlayerLabel(player.id, playersIndex)}`}
                  />
                  <div className={styles.playerMeta}>
                    <span className={styles.playerName}>{getPlayerLabel(player.id, playersIndex)}</span>
                    <span className={styles.playerPosition}>{player.position || "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.opponentSection}>
            <h3 className={styles.sectionTitle}>Przeciwnik</h3>
            <p className={styles.helpText}>
              Dodaj zawodników rywali i ustaw ich pozycje na boisku (czerwone markery).
            </p>
            <div className={styles.opponentActions}>
              <button type="button" className={styles.secondaryButton} onClick={addOpponentPlayer}>
                + Dodaj przeciwnika
              </button>
            </div>
            <div className={styles.playerList}>
              {setup.opponentPlayers.map((opponent) => {
                const included = (setup.selectedOpponentIds ?? []).includes(opponent.id);
                const isSelected = selectedPlayerId === opponent.id;
                return (
                  <div
                    key={opponent.id}
                    className={`${styles.playerRow} ${styles.playerRowOpponent} ${included ? styles.playerRowIncluded : ""} ${
                      isSelected ? styles.playerRowSelected : ""
                    }`}
                    onClick={() => setSelectedPlayerId(opponent.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedPlayerId(opponent.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <input
                      type="checkbox"
                      className={styles.playerCheckbox}
                      checked={included}
                      onChange={() => toggleOpponentIncluded(opponent.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Uwzględnij ${opponent.label}`}
                    />
                    <div className={styles.playerMeta}>
                      <span className={styles.playerName}>{opponent.label}</span>
                      <span className={styles.playerPosition}>nr {opponent.number}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedOpponent && !selectedPlayer && (
            <div className={styles.detailPanel}>
              <h3 className={styles.sectionTitle}>Przeciwnik</h3>
              <label className={styles.fieldLabel}>
                Nazwisko / etykieta
                <input
                  type="text"
                  className={styles.textInput}
                  value={selectedOpponent.label}
                  onChange={(event) => updateOpponentPlayer(selectedOpponent.id, { label: event.target.value })}
                />
              </label>
              <label className={styles.fieldLabel}>
                Numer
                <input
                  type="number"
                  min={0}
                  max={99}
                  className={styles.textInput}
                  value={selectedOpponent.number}
                  onChange={(event) =>
                    updateOpponentPlayer(selectedOpponent.id, {
                      number: Number(event.target.value) || 0,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => removeOpponentPlayer(selectedOpponent.id)}
              >
                Usuń przeciwnika
              </button>
            </div>
          )}

          {selectedPlayer && (
            <div className={styles.detailPanel}>
              <h3 className={styles.sectionTitle}>Zawodnik</h3>
              <label className={styles.fieldLabel}>
                Nazwisko na boisku
                <input
                  type="text"
                  className={styles.textInput}
                  value={doc.playerOverrides[selectedPlayer.id]?.displayName ?? ""}
                  placeholder={getPlayerLabel(selectedPlayer.id, playersIndex)}
                  onChange={(event) =>
                    updatePlayerOverride(selectedPlayer.id, { displayName: event.target.value })
                  }
                />
              </label>
              <label className={styles.fieldLabel}>
                Zadanie
                <textarea
                  className={styles.textArea}
                  value={selectedAssignment?.task ?? ""}
                  placeholder="np. blokada, wybieg na pierwszy słupek..."
                  onChange={(event) => {
                    const task = event.target.value;
                    updateCurrentFrame((frame) => ({
                      ...frame,
                      assignments: frame.assignments.map((item) =>
                        item.playerId === selectedPlayer.id ? { ...item, task } : item,
                      ),
                    }));
                  }}
                />
              </label>
              <div className={styles.photoActions}>
                <label className={styles.secondaryButton}>
                  Wgraj zdjęcie
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => handlePhotoFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {doc.playerOverrides[selectedPlayer.id]?.imageUrl && (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => updatePlayerOverride(selectedPlayer.id, { imageUrl: "" })}
                  >
                    Usuń zdjęcie
                  </button>
                )}
              </div>
            </div>
          )}

          {currentFrame.zones.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle}>Strefy i zadania (klatka)</h3>
              <div className={styles.zonesList}>
                {currentFrame.zones.map((zone) => (
                  <div key={zone.id} className={styles.zoneCard}>
                    <div className={styles.zoneCardHeader}>
                      <span className={styles.zoneKindBadge}>
                        {zone.kind === "target" ? "Cel" : "Ruch / obszar"}
                      </span>
                      <button type="button" className={styles.dangerButton} onClick={() => removeZone(zone.id)}>
                        Usuń
                      </button>
                    </div>
                    <label className={styles.zoneFieldLabel}>
                      Nazwa strefy
                      <input
                        type="text"
                        className={styles.zoneTextInput}
                        value={zone.label}
                        placeholder="np. Bliski słupek, Drugi rząd..."
                        onChange={(event) => updateZoneLabel(zone.id, event.target.value)}
                      />
                    </label>
                    <label className={styles.zoneFieldLabel}>
                      Zadanie
                      <textarea
                        className={styles.zoneTaskInput}
                        value={zone.task ?? ""}
                        placeholder="np. wybieg na bliższy słupek, zagranie na daleki..."
                        rows={2}
                        onChange={(event) => updateZoneTask(zone.id, event.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className={styles.pitchColumn}>
          <div className={styles.framesBar}>
            <h3 className={styles.sectionTitle}>Klatki animacji</h3>
            <div className={styles.framesActions}>
              <button type="button" className={styles.secondaryButton} onClick={addFrame}>
                + Klatka
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={removeCurrentFrame}
                disabled={setup.frames.length <= 1}
              >
                Usuń klatkę
              </button>
            </div>
          </div>
          <div className={styles.frameTabs} role="tablist" aria-label="Klatki animacji">
            {setup.frames.map((frame, index) => (
              <button
                key={frame.id}
                type="button"
                role="tab"
                aria-selected={safeFrameIndex === index}
                className={`${styles.frameTab} ${safeFrameIndex === index ? styles.frameTabActive : ""}`}
                onClick={() => setActiveFrameIndex(index)}
              >
                {frame.label}
              </button>
            ))}
          </div>
          <div className={styles.pitchColumnHeader}>
            <h3 className={styles.sectionTitle}>Edycja: {currentFrame.label}</h3>
            {setup.selectedPlayerIds.length === 0 && (
              <button
                type="button"
                className={styles.selectAllButton}
                onClick={() => {
                  const allIds = squadPlayers.map((player) => player.id);
                  updateSetup((prev) => syncSetupPlayers({ ...prev, selectedPlayerIds: allIds }, allIds));
                }}
              >
                Dodaj cały skład
              </button>
            )}
          </div>
          <div className={styles.pitchFrame}>
            <div className={styles.pitchSurface}>
              <SetPiecePitch
              markers={currentFrame.markers}
              zones={currentFrame.zones}
              playersById={playersById}
              selectedPlayerId={selectedPlayerId}
              activeTool={activeTool}
              draftZone={draftZone}
              onSelectPlayer={setSelectedPlayerId}
              onMoveMarker={handleMoveMarker}
              onDraftZoneChange={setDraftZone}
              onZoneDrawComplete={handleZoneDrawComplete}
            />
              {!hasAnyoneOnPitch && (
                <div className={styles.pitchOverlay} role="status">
                  <p className={styles.pitchOverlayTitle}>Dodaj zawodników na boisko</p>
                  <p className={styles.pitchOverlayText}>
                    Zaznacz naszych piłkarzy lub dodaj przeciwników po lewej, aby rozpocząć układanie stałego
                    fragmentu.
                  </p>
                <button
                  type="button"
                  className={styles.selectAllButton}
                  onClick={() => {
                    const allIds = squadPlayers.map((player) => player.id);
                    updateSetup((prev) => syncSetupPlayers({ ...prev, selectedPlayerIds: allIds }, allIds));
                  }}
                >
                  Dodaj cały skład na boisko
                </button>
              </div>
              )}
            </div>
          </div>

          <SetPieceAnimationPlayer
            frames={setup.frames}
            playersById={playersById}
            activePlayerIds={activePitchPlayerIds}
          />
        </div>
      </div>
    </div>
  );
};

export default SetPieceEditor;
