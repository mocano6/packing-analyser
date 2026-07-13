'use client';

import React, { useMemo } from 'react';
import { computeAttackDefenseTilt } from '@/utils/attackDefenseTilt';
import styles from './AttackDefenseTilt.module.css';

type Props = {
  attackCount: number;
  defenseCount: number;
  attackXt: number;
  defenseXt: number;
  /**
   * split — liczba akcji w ataku vs obronie (straty).
   * dualXt — każda akcja ma obie wartości xT (przechwyty); pokazujemy tylko sumy xT.
   */
  variant?: 'split' | 'dualXt';
  /** Liczba akcji przy variant=dualXt. */
  totalActions?: number;
  /** Krótki opis kontekstu pod wizualizacją. */
  hint?: string;
  /** Etykiety stron (domyślnie „W ataku” / „W obronie”). */
  attackLabel?: string;
  defenseLabel?: string;
};

function fmt3(v: number) { return Number(v).toFixed(3); }

export default function AttackDefenseTilt({
  attackCount,
  defenseCount,
  attackXt,
  defenseXt,
  variant = 'split',
  totalActions,
  hint,
  attackLabel = 'W ataku',
  defenseLabel = 'W obronie',
}: Props) {
  const tilt = useMemo(() => computeAttackDefenseTilt(attackXt, defenseXt), [attackXt, defenseXt]);
  const isDualXt = variant === 'dualXt';
  const actionTotal = totalActions ?? Math.max(attackCount, defenseCount);
  const totalCount = attackCount + defenseCount;
  const attackCountPct = totalCount > 0 ? (attackCount / totalCount) * 100 : 50;
  const defenseCountPct = 100 - attackCountPct;

  const diffAbs = Math.abs(tilt.diff);
  const directionLabel =
    tilt.direction === 'attack'
      ? `Przewaga w ataku · ${tilt.attackShare.toFixed(0)}% · +${fmt3(diffAbs)} xT`
      : tilt.direction === 'defense'
        ? `Przewaga w obronie · ${tilt.defenseShare.toFixed(0)}% · +${fmt3(diffAbs)} xT`
        : `Równowaga · ${tilt.attackShare.toFixed(0)}% / ${tilt.defenseShare.toFixed(0)}%`;

  return (
    <div className={styles.tilt} role="group" aria-label="Przechylenie atak / obrona">
      {isDualXt ? (
        <p className={styles.dualXtLead}>
          <strong>{actionTotal}</strong> akcji — każda z xT atak i xT obrona
        </p>
      ) : (
        <>
          <div className={styles.countRow}>
            <div className={`${styles.countSide} ${styles.countSideDefense}`}>
              <span className={styles.countValue}>{defenseCount}</span>
              <span className={styles.countLabel}>{defenseLabel}</span>
              <span className={styles.countPct}>{defenseCountPct.toFixed(0)}%</span>
            </div>
            <div className={styles.countDivider} aria-hidden>vs</div>
            <div className={`${styles.countSide} ${styles.countSideAttack}`}>
              <span className={styles.countValue}>{attackCount}</span>
              <span className={styles.countLabel}>{attackLabel}</span>
              <span className={styles.countPct}>{attackCountPct.toFixed(0)}%</span>
            </div>
          </div>

          <div
            className={styles.shareBar}
            role="img"
            aria-label={`Liczba akcji: w ataku ${attackCountPct.toFixed(0)}%, w obronie ${defenseCountPct.toFixed(0)}%`}
          >
            <span className={styles.shareBarDefense} style={{ width: `${defenseCountPct}%` }} />
            <span className={styles.shareBarAttack} style={{ width: `${attackCountPct}%` }} />
          </div>
        </>
      )}

      {/* Waga / szala przechylenia wg xT */}
      <div className={styles.scaleBlock}>
        <div className={styles.scaleHeader}>
          <span className={styles.scaleTitle}>Waga xT</span>
          <span
            className={`${styles.scaleVerdict} ${
              tilt.direction === 'attack'
                ? styles.scaleVerdictAttack
                : tilt.direction === 'defense'
                  ? styles.scaleVerdictDefense
                  : styles.scaleVerdictBalanced
            }`}
          >
            {directionLabel}
          </span>
        </div>

        <div className={styles.scaleValues}>
          <span className={styles.scaleValueDefense}>
            {fmt3(tilt.defenseXt)} xT obrona <span className={styles.scaleShare}>({tilt.defenseShare.toFixed(0)}%)</span>
          </span>
          <span className={styles.scaleValueAttack}>
            {fmt3(tilt.attackXt)} xT atak <span className={styles.scaleShare}>({tilt.attackShare.toFixed(0)}%)</span>
          </span>
        </div>

        <div
          className={styles.scaleTrack}
          role="img"
          aria-label={`Przechylenie xT: obrona ${tilt.defenseShare.toFixed(0)}%, atak ${tilt.attackShare.toFixed(0)}%${
            tilt.direction === 'balanced'
              ? ''
              : `, przewaga ${tilt.direction === 'attack' ? tilt.attackShare.toFixed(0) : tilt.defenseShare.toFixed(0)}%`
          }`}
        >
          <span className={styles.scaleHalfDefense} aria-hidden />
          <span className={styles.scaleHalfAttack} aria-hidden />
          <span className={styles.scaleCenter} aria-hidden />
          {tilt.direction !== 'balanced' ? (
            <span
              className={`${styles.scaleFill} ${
                tilt.direction === 'attack' ? styles.scaleFillAttack : styles.scaleFillDefense
              }`}
              style={
                tilt.direction === 'attack'
                  ? { left: '50%', width: `${tilt.magnitudePct / 2}%` }
                  : { right: '50%', width: `${tilt.magnitudePct / 2}%` }
              }
              aria-hidden
            />
          ) : null}
          <span
            className={styles.scaleNeedle}
            style={{ left: `${50 + tilt.tiltPct}%` }}
            aria-hidden
          />
        </div>

        <div className={styles.scaleAxis} aria-hidden>
          <span>obrona</span>
          <span>równowaga</span>
          <span>atak</span>
        </div>
      </div>

      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
