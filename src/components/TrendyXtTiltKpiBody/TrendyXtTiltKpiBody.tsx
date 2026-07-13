'use client';

import React from 'react';
import AttackDefenseTilt from '@/components/AttackDefenseTilt/AttackDefenseTilt';
import type { TrendyRegainLosesTiltSummary } from '@/utils/trendyRegainLosesTilt';
import styles from './TrendyXtTiltKpiBody.module.css';

type Props = {
  side: 'regains' | 'loses';
  summary: TrendyRegainLosesTiltSummary;
};

const HINTS = {
  regains:
    'Całe boisko — każdy przechwyt ma xT atak i xT obrona. Waga pokazuje, która suma xT jest większa.',
  loses:
    'Całe boisko — każda strata ma xT atak i xT obrona. Waga pokazuje, która suma xT jest większa.',
} as const;

export default function TrendyXtTiltKpiBody({ side, summary }: Props) {
  const data = side === 'regains' ? summary.regains : summary.loses;
  const label = side === 'regains' ? 'przechwytów' : 'strat';

  if (data.total === 0) {
    return (
      <div className={styles.body} role="region" aria-label={`Profil xT — ${label}`}>
        <p className={styles.empty}>Brak {label} w wybranych meczach.</p>
      </div>
    );
  }

  return (
    <div className={styles.body} role="region" aria-label={`Profil xT — ${label}`}>
      <p className={styles.lead}>
        <strong>{data.total}</strong> {label} na całym boisku w wybranym zakresie meczów
      </p>
      <AttackDefenseTilt
        variant="dualXt"
        totalActions={data.total}
        attackCount={data.attackCount}
        defenseCount={data.defenseCount}
        attackXt={data.attackXt}
        defenseXt={data.defenseXt}
        hint={HINTS[side]}
      />
    </div>
  );
}
