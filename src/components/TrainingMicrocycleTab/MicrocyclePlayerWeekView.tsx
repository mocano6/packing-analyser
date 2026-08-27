"use client";

import React from "react";
import type { PlayerDayCard } from "@/utils/microcyclePlayerView";
import { playerDayKindLabel } from "@/utils/microcyclePlayerView";
import styles from "./TrainingMicrocycleTab.module.css";

export default function MicrocyclePlayerWeekView({
  teamName,
  weekLabel,
  microcycleNumber,
  cards,
}: {
  teamName: string;
  weekLabel: string;
  microcycleNumber: number | null;
  cards: PlayerDayCard[];
}) {
  return (
    <div className={styles.playerWeek} aria-label="Harmonogram tygodnia dla zawodników">
      <header className={styles.playerWeekHead}>
        <p className={styles.playerWeekTeam}>{teamName}</p>
        <p className={styles.playerWeekMeta}>
          {microcycleNumber != null ? `Mikrocykl ${microcycleNumber}` : "Mikrocykl"}
          {" · "}
          {weekLabel}
        </p>
      </header>
      <div className={styles.playerWeekGrid} role="grid" aria-label="Dni tygodnia — widok zawodnika">
        {cards.map((card) => (
          <article
            key={card.dayIndex}
            className={styles.playerDay}
            data-kind={card.kind}
            role="gridcell"
          >
            <header className={styles.playerDayHead}>
              <div className={styles.playerDayHeadTop}>
                <span className={styles.playerDayName}>{card.weekday}</span>
                {card.mdLabel ? (
                  <span className={styles.playerDayMd}>{card.mdLabel}</span>
                ) : null}
                <span className={styles.playerDayDate}>{card.dateLabel}</span>
              </div>
              <span className={styles.playerDayKind} data-kind={card.kind}>
                {playerDayKindLabel(card.kind)}
              </span>
            </header>

            {card.kind === "rest" && (
              <p className={styles.playerDayRest}>Dzień wolny</p>
            )}

            {card.kind === "training" && (
              <div className={styles.playerDayBody}>
                {card.startTime || card.durationMinutes > 0 ? (
                  <p className={styles.playerDayTime}>
                    {card.startTime ?? "—"}
                    {card.endTime ? `–${card.endTime}` : ""}
                    {card.durationMinutes > 0 ? ` · ${card.durationMinutes}′` : ""}
                  </p>
                ) : (
                  <p className={styles.playerDayEmpty}>Godzina do ustalenia</p>
                )}
              </div>
            )}

            {card.kind === "match" && (
              <div className={styles.playerDayBody}>
                {card.matches.length === 0 ? (
                  <p className={styles.playerDayEmpty}>Mecz</p>
                ) : (
                  card.matches.map((m, i) => (
                    <div key={`${card.dayIndex}-m-${i}`} className={styles.playerMatch}>
                      <p className={styles.playerMatchKickoff}>{m.kickoffTime || "—"}</p>
                      <p className={styles.playerMatchOpp}>
                        {m.venueLabel}
                        {m.opponent ? ` · ${m.opponent}` : ""}
                      </p>
                      {m.departureTime ? (
                        <p className={styles.playerMatchRow}>Wyjazd {m.departureTime}</p>
                      ) : null}
                      {m.address ? <p className={styles.playerMatchRow}>{m.address}</p> : null}
                      {m.surface ? <p className={styles.playerMatchRow}>{m.surface}</p> : null}
                      {m.weather ? <p className={styles.playerMatchRow}>{m.weather}</p> : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
