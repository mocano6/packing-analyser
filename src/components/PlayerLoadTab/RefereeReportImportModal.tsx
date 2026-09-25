"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LnpCachedMatchMinutes } from "@/types/lnpPlayerLoad";
import {
  pickRefereeReportSide,
  refereeReportToCachedMatch,
  type RefereeReportMatch,
  type RefereeReportSide,
} from "@/utils/refereeReportPdf";
import styles from "./PlayerLoadTab.module.css";

type Props = {
  report: RefereeReportMatch;
  ourTeamNames: string[];
  existingMatch: LnpCachedMatchMinutes | null;
  onConfirm: (match: LnpCachedMatchMinutes, side: RefereeReportSide) => void;
  onClose: () => void;
};

export default function RefereeReportImportModal({
  report,
  ourTeamNames,
  existingMatch,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<RefereeReportSide>(() => pickRefereeReportSide(report, ourTeamNames));

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ours = side === "host" ? report.host : report.guest;
  const opponent = side === "host" ? report.guestName : report.hostName;
  const played = useMemo(
    () => ours.players.filter((p) => p.minutesPlayed > 0).sort((a, b) => b.minutesPlayed - a.minutesPlayed),
    [ours.players]
  );

  const handleConfirm = () => {
    const match = refereeReportToCachedMatch(report, side, new Date().toISOString());
    onConfirm(match, side);
  };

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className={styles.modalTitle}>
          Minuty ze sprawozdania
        </h3>
        <p className={styles.modalMeta}>
          {report.date} {report.kickoffTime} · {report.hostName} – {report.guestName}
          {report.scoreFinal ? ` · ${report.scoreFinal}` : ""}
        </p>
        <p className={styles.modalComp}>{report.competition}</p>

        <fieldset className={styles.sidePick}>
          <legend>Nasza drużyna w tym meczu</legend>
          <label>
            <input
              type="radio"
              name="pdf-side"
              value="host"
              checked={side === "host"}
              onChange={() => setSide("host")}
            />
            {report.hostName} ({report.host.players.filter((p) => p.minutesPlayed > 0).length} z minutami)
          </label>
          <label>
            <input
              type="radio"
              name="pdf-side"
              value="guest"
              checked={side === "guest"}
              onChange={() => setSide("guest")}
            />
            {report.guestName} ({report.guest.players.filter((p) => p.minutesPlayed > 0).length} z minutami)
          </label>
        </fieldset>

        <p className={styles.modalHint}>
          {side === "host" ? "Dom" : "Wyjazd"} vs {opponent}.{" "}
          {existingMatch
            ? "Ten mecz jest już w cache — zapis zastąpi poprzednie minuty."
            : "Zapis doda mecz do okien 3 i 7 dni."}
        </p>

        <div className={styles.previewWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Minuty odczytane z PDF</caption>
            <thead>
              <tr>
                <th scope="col">Nr</th>
                <th scope="col">Zawodnik</th>
                <th scope="col" className={styles.num}>
                  Minuty
                </th>
              </tr>
            </thead>
            <tbody>
              {played.map((p) => (
                <tr key={`${p.number}-${p.lastName}`}>
                  <td className={styles.num}>{p.number}</td>
                  <td>
                    {p.lastName} {p.firstName}
                    {p.isStarter ? "" : <span className={styles.sub}> rezerwa</span>}
                  </td>
                  <td className={styles.num}>{p.minutesPlayed}′</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className={styles.fetchBtn} onClick={handleConfirm} disabled={played.length === 0}>
            {existingMatch ? "Zastąp minuty" : "Dodaj minuty"}
          </button>
        </div>
      </div>
    </div>
  );
}
