"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StaffPlannerCoach } from "@/types/staffPlanner";
import type { MicrocycleMatch, MicrocycleMatchProtocol } from "@/types/trainingMicrocycle";
import { toIsoDateLocal, weekdayShortPl } from "@/utils/matchDayLabels";
import {
  MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
  MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX,
  minutesFromKickoffHhMm,
  minutesOfDayFromDate,
  nowLineTopPx,
  protocolEventLayouts,
  protocolEventTopPx,
  protocolHourHeightForWrap,
  protocolItemIsPast,
  protocolTimelineHours,
  protocolTimelineItems,
} from "@/utils/matchProtocol";
import styles from "./MatchProtocol.module.css";

type Props = {
  protocol: MicrocycleMatchProtocol;
  match: MicrocycleMatch;
  matchDateIso: string;
  matchDateLabel: string;
  coaches: StaffPlannerCoach[];
  onToggleSubtask: (subtaskId: string) => void;
  onClose: () => void;
};

function formatNowClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MatchProtocolTimelineModal({
  protocol,
  match,
  matchDateIso,
  matchDateLabel,
  coaches,
  onToggleSubtask,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const didScrollToNow = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [slotHeight, setSlotHeight] = useState(0);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const tick = window.setInterval(() => setNow(new Date()), 10_000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(tick);
    };
  }, [onClose]);

  useEffect(() => {
    const el = slotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setSlotHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    });
    ro.observe(el);
    setSlotHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const kickoff = match.kickoffTime || "18:00";
  const items = useMemo(() => protocolTimelineItems(protocol, kickoff), [protocol, kickoff]);
  const prevDay = items.filter((i) => i.dayDelta < 0);
  const sameDay = items.filter((i) => i.dayDelta === 0);
  const nextDay = items.filter((i) => i.dayDelta > 0);
  const isMatchDay = toIsoDateLocal(now) === matchDateIso;
  const nowMinutes = isMatchDay ? minutesOfDayFromDate(now) : null;
  const hours = useMemo(
    () => protocolTimelineHours(sameDay, kickoff, nowMinutes),
    [sameDay, kickoff, nowMinutes]
  );
  const hourCount = Math.max(1, hours.endHour - hours.startHour);
  const hourHeight = protocolHourHeightForWrap(
    slotHeight,
    hourCount,
    MATCH_PROTOCOL_MIN_HOUR_HEIGHT_PX
  );
  const totalHeight = hourCount * hourHeight;
  const nowTop = nowLineTopPx(matchDateIso, hours.startHour, hours.endHour, hourHeight, now);
  const kickMinutes = minutesFromKickoffHhMm(kickoff);
  const kickTop = protocolEventTopPx(kickMinutes, hours.startHour, hourHeight);
  const eventLayouts = useMemo(
    () => protocolEventLayouts(sameDay, hours.startHour, hours.endHour, hourHeight),
    [sameDay, hours.startHour, hours.endHour, hourHeight]
  );
  const contentHeight = Math.max(
    totalHeight,
    eventLayouts.reduce((max, l) => Math.max(max, l.top + l.height + 8), 0)
  );

  useEffect(() => {
    if (didScrollToNow.current || nowTop == null || !bodyRef.current) return;
    didScrollToNow.current = true;
    const box = bodyRef.current;
    const y = nowTop - box.clientHeight * 0.35;
    box.scrollTop = Math.max(0, y);
  }, [nowTop]);

  const hourLabels: number[] = [];
  for (let h = hours.startHour; h < hours.endHour; h += 1) hourLabels.push(h);

  const opponent = match.opponent.trim() || "Mecz";
  const venue = match.venue === "home" ? "Dom" : "Wyjazd";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles.dialogTimeline}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {protocol.title}
            </h2>
            <p className={styles.subtitle}>
              {weekdayShortPl(match.dayIndex)} {matchDateLabel} · {venue} {kickoff} · {opponent}
              {isMatchDay ? ` · teraz ${formatNowClock(now)}` : ""}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        </div>
        <div ref={bodyRef} className={`${styles.body} ${styles.bodyTimeline}`}>
          {prevDay.length > 0 && (
            <div className={styles.prevDay}>
              <p className={styles.prevDayTitle}>Dzień wcześniej</p>
              {prevDay.map((item) => {
                const coach = item.subtask.coachId
                  ? coaches.find((c) => c.id === item.subtask.coachId)
                  : undefined;
                const past = protocolItemIsPast(
                  matchDateIso,
                  item.dayDelta,
                  item.minutesOfDay,
                  now
                );
                return (
                  <label
                    key={item.subtask.id}
                    className={`${styles.prevDayItem} ${past ? styles.prevDayItemPast : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.subtask.done}
                      onChange={() => onToggleSubtask(item.subtask.id)}
                    />
                    <span>
                      <strong>{item.clock}</strong> {item.subtask.title}
                      {coach ? ` · ${coach.name}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div ref={slotRef} className={styles.timelineSlot}>
          <div
            className={styles.timelineWrap}
            style={
              {
                ["--hour-h" as string]: `${hourHeight}px`,
                minHeight: contentHeight,
              } as React.CSSProperties
            }
          >
            {hourLabels.map((h) => (
              <div key={h} className={styles.hourRow}>
                <span className={styles.hourLabel}>{String(h).padStart(2, "0")}:00</span>
                <span className={styles.hourTrack} />
              </div>
            ))}
            <div className={styles.kickoffLine} style={{ top: kickTop }} aria-hidden />
            {nowTop != null && nowTop > 0 && (
              <div className={styles.nowShade} style={{ height: nowTop }} aria-hidden />
            )}
            <div className={styles.eventsLayer}>
              {sameDay.map((item, i) => {
                const coach = item.subtask.coachId
                  ? coaches.find((c) => c.id === item.subtask.coachId)
                  : undefined;
                const isKickoff = item.subtask.minutesBeforeKickoff === 0;
                const past = protocolItemIsPast(
                  matchDateIso,
                  item.dayDelta,
                  item.minutesOfDay,
                  now
                );
                const layout = eventLayouts[i] ?? {
                  top: protocolEventTopPx(item.minutesOfDay, hours.startHour, hourHeight),
                  height: MATCH_PROTOCOL_EVENT_MIN_HEIGHT_PX,
                };
                return (
                  <label
                    key={item.subtask.id}
                    className={[
                      styles.event,
                      item.subtask.done ? styles.eventDone : "",
                      isKickoff ? styles.eventKickoff : "",
                      past ? styles.eventPast : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      top: layout.top,
                      height: layout.height,
                      borderLeftColor: past ? "#dc2626" : coach?.color,
                    }}
                  >
                    <input
                      className={styles.eventCheck}
                      type="checkbox"
                      checked={item.subtask.done}
                      onChange={() => onToggleSubtask(item.subtask.id)}
                      aria-label={`${item.clock} ${item.subtask.title}${past ? ", po czasie" : ""}`}
                    />
                    <span className={styles.eventText}>
                      <span className={styles.eventTime}>{item.clock}</span>
                      <span className={styles.eventTitle}>{item.subtask.title}</span>
                      {coach ? <p className={styles.eventCoach}>{coach.name}</p> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {nowTop != null && (
              <div
                className={styles.nowLine}
                style={{ top: nowTop }}
                aria-label={`Teraz ${formatNowClock(now)}`}
              >
                <span className={styles.nowDot} aria-hidden />
                <span className={styles.nowLabel}>{formatNowClock(now)}</span>
              </div>
            )}
          </div>
          </div>
          {nextDay.length > 0 && (
            <div className={styles.nextDay}>
              <p className={styles.nextDayTitle}>Dzień później</p>
              {nextDay.map((item) => {
                const coach = item.subtask.coachId
                  ? coaches.find((c) => c.id === item.subtask.coachId)
                  : undefined;
                const past = protocolItemIsPast(
                  matchDateIso,
                  item.dayDelta,
                  item.minutesOfDay,
                  now
                );
                return (
                  <label
                    key={item.subtask.id}
                    className={`${styles.prevDayItem} ${past ? styles.prevDayItemPast : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.subtask.done}
                      onChange={() => onToggleSubtask(item.subtask.id)}
                    />
                    <span>
                      <strong>{item.clock}</strong> {item.subtask.title}
                      {coach ? ` · ${coach.name}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
