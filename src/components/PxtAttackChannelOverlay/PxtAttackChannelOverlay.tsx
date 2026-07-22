"use client";

import React, { useMemo } from "react";
import type { PxtAttackChannelStats } from "@/utils/statystykiZespoluPxtAttackChannels";
import styles from "./PxtAttackChannelOverlay.module.css";

type Props = {
  channels: PxtAttackChannelStats[];
};

function fmt2(value: number): string {
  return Number(value).toFixed(2);
}

function fmt3(value: number): string {
  return Number(value).toFixed(3);
}

function fmtPct(value: number): string {
  return `${Math.round(value)}%`;
}

function AttackArrows({ strength }: { strength: number }) {
  const count = strength > 0.6 ? 4 : 3;
  const opacity = 0.25 + strength * 0.55;

  return (
    <svg
      className={styles.arrows}
      viewBox={`0 0 ${count * 22} 16`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={{ opacity }}
    >
      {Array.from({ length: count }, (_, i) => {
        const x = i * 22;
        return (
          <path
            key={i}
            d={`M ${x + 1} 8 H ${x + 12} M ${x + 8} 3 L ${x + 15} 8 L ${x + 8} 13`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25 + strength * 0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

export default function PxtAttackChannelOverlay({ channels }: Props) {
  const { maxPxt, maxCount, topChannelId } = useMemo(() => {
    let maxPxtValue = 0;
    let maxCountValue = 0;
    let bestId: string | null = null;
    let bestCount = -1;
    let bestPxt = -1;

    for (const ch of channels) {
      if (ch.pxt > maxPxtValue) maxPxtValue = ch.pxt;
      if (ch.count > maxCountValue) maxCountValue = ch.count;
      if (ch.count > bestCount || (ch.count === bestCount && ch.pxt > bestPxt)) {
        bestCount = ch.count;
        bestPxt = ch.pxt;
        bestId = ch.id;
      }
    }

    return {
      maxPxt: Math.max(maxPxtValue, 0.0001),
      maxCount: Math.max(maxCountValue, 1),
      topChannelId: bestCount > 0 ? bestId : null,
    };
  }, [channels]);

  return (
    <div className={styles.overlay} role="group" aria-label="Kierunek ataku — pasy szerokości boiska">
      {channels.map((channel) => {
        const intensityByPxt = channel.pxt > 0 ? Math.min(channel.pxt / maxPxt, 1) : 0;
        const intensityByCount = channel.count > 0 ? Math.min(channel.count / maxCount, 1) : 0;
        const intensity = Math.max(intensityByPxt, intensityByCount * 0.85);
        const isTop = topChannelId === channel.id;
        const topPct = (channel.rowStart / 8) * 100;
        const heightPct = (channel.rowSpan / 8) * 100;

        return (
          <div
            key={channel.id}
            className={[
              styles.band,
              isTop ? styles.topBand : "",
              channel.count === 0 ? styles.emptyBand : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              top: `${topPct}%`,
              height: `${heightPct}%`,
              ["--band-intensity" as string]: String(intensity),
            }}
            title={`${channel.label} (${channel.letters}): ${channel.count} akcji, PxT ${fmt2(channel.pxt)}, ΔxT ${fmt3(channel.xt)}, ${fmtPct(channel.countSharePct)} akcji, ${fmtPct(channel.pxtSharePct)} PxT`}
          >
            <div className={styles.flowTrack} aria-hidden="true">
              <AttackArrows strength={intensity} />
            </div>

            <div className={styles.bandInner}>
              <div className={styles.labelBlock}>
                <span className={styles.bandLabel}>{channel.label}</span>
                <span className={styles.bandLetters}>{channel.letters}</span>
              </div>

              <div className={styles.metricsBlock}>
                <span className={styles.metricPrimary}>{fmt2(channel.pxt)} PxT</span>
                <span className={styles.metricMuted}>{fmt3(channel.xt)} ΔxT</span>
                <span className={styles.metricMuted}>{fmtPct(channel.countSharePct)} akcji</span>
                <span className={styles.metricMuted}>{fmtPct(channel.pxtSharePct)} PxT</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
