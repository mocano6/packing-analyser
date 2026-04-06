'use client';

import React, { useMemo, useState } from 'react';
import type { TeamInfo } from '@/types';
import {
  buildWiedzaPackingFlowFromMatches,
  edgeKey,
  metricFromBucket,
  metricFromEdge,
  type PackingFlowMetric,
} from '@/utils/wiedzaPackingZoneFlow';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from '@/app/admin/wiedza/wiedza.module.css';

type ContactChartMode = 'count' | 'sum' | 'avg';
type ZoneStackMode = 'count' | 'share';

const METRIC_LABELS: Record<PackingFlowMetric, string> = {
  pxt: 'PxT (Σ ΔxT×pkt)',
  xtDelta: 'Σ ΔxT',
  packPts: 'Σ pkt packing',
};

const CONTACT_COLORS = {
  c1: '#3b82f6',
  c2: '#10b981',
  c3: '#f59e0b',
  unknown: '#94a3b8',
};

function formatMetricValue(val: number, m: PackingFlowMetric): string {
  if (m === 'packPts') return val.toFixed(2);
  return val.toFixed(3);
}

type Props = {
  matches: TeamInfo[];
};

export default function WiedzaPackingFlowTab({ matches }: Props) {
  const [metric, setMetric] = useState<PackingFlowMetric>('pxt');
  const [contactMode, setContactMode] = useState<ContactChartMode>('count');
  const [zoneStackMode, setZoneStackMode] = useState<ZoneStackMode>('count');

  const flow = useMemo(() => buildWiedzaPackingFlowFromMatches(matches), [matches]);

  const maxMatrixVal = useMemo(() => {
    let max = 0;
    for (const start of flow.zoneKeys) {
      for (const end of flow.zoneKeys) {
        const e = flow.edgeByKey.get(edgeKey(start, end));
        if (!e) continue;
        const v = Math.abs(metricFromEdge(e, metric));
        if (v > max) max = v;
      }
    }
    return max;
  }, [flow.zoneKeys, flow.edgeByKey, metric]);

  const contactBarData = useMemo(() => {
    const rows = [
      { key: 'c1' as const, label: '1 kontakt' },
      { key: 'c2' as const, label: '2 kontakty' },
      { key: 'c3' as const, label: '3+ kontaktów' },
      { key: 'unknown' as const, label: 'Nieznane' },
    ];
    return rows.map(({ key, label }) => {
      const b = flow.contactBuckets[key];
      let value: number;
      if (contactMode === 'count') value = b.n;
      else if (contactMode === 'sum') value = metricFromBucket(b, metric);
      else value = b.n > 0 ? metricFromBucket(b, metric) / b.n : 0;
      return { name: label, value, n: b.n };
    });
  }, [flow.contactBuckets, contactMode, metric]);

  const zoneChartRows = useMemo(() => {
    const rows = [...flow.zoneContactCounts.entries()].map(([zone, m]) => {
      const c1 = m.get('c1') ?? 0;
      const c2 = m.get('c2') ?? 0;
      const c3 = m.get('c3') ?? 0;
      const unknown = m.get('unknown') ?? 0;
      const total = c1 + c2 + c3 + unknown;
      return {
        zone,
        c1,
        c2,
        c3,
        unknown,
        total,
        c1s: total ? (c1 / total) * 100 : 0,
        c2s: total ? (c2 / total) * 100 : 0,
        c3s: total ? (c3 / total) * 100 : 0,
        uks: total ? (unknown / total) * 100 : 0,
      };
    });
    rows.sort((a, b) => b.total - a.total);
    return rows.slice(0, 28);
  }, [flow.zoneContactCounts]);

  const zoneChartHeight = Math.min(620, 56 + zoneChartRows.length * 34);

  const contactYLabel =
    contactMode === 'count'
      ? 'Liczba akcji'
      : contactMode === 'sum'
        ? `Suma: ${METRIC_LABELS[metric]}`
        : `Średnia na akcję: ${METRIC_LABELS[metric]}`;

  if (matches.length === 0) {
    return (
      <div className={styles.correlationMergedPanel}>
        <h2 className={styles.correlationTabTitle}>Strefy PxT i kontakty</h2>
        <p className={styles.correlationTabLead}>
          Macierz <strong>start → koniec</strong> strefy na akcjach packing (atak), wykres kontaktów (1T / 2T / 3T+) oraz rozkład
          kontaktów po <strong>strefie startu</strong>.
        </p>
        <div className={styles.emptyState} role="status">
          Wybierz zespoły, ustaw zakres dat i kliknij „Analizuj”, aby załadować mecze.
        </div>
      </div>
    );
  }

  if (flow.totalActions === 0) {
    return (
      <div className={styles.correlationMergedPanel}>
        <h2 className={styles.correlationTabTitle}>Strefy PxT i kontakty</h2>
        <p className={styles.correlationTabLead}>
          Brak akcji <code className={styles.inlineCode}>actions_packing</code> w próbie (atak).
        </p>
        <div className={styles.emptyState} role="status">
          Brak danych packing w załadowanych meczach.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.correlationMergedPanel}>
      <h2 className={styles.correlationTabTitle}>Strefy PxT i kontakty</h2>
      <p className={styles.correlationTabLead}>
        Tylko <strong>atak</strong> (<code className={styles.inlineCode}>actions_packing</code>, wykluczone{' '}
        <code className={styles.inlineCode}>mode: defense</code>). Jedna akcja = jeden wiersz. PxT = Σ(ΔxT×pkt) jak w reszcie Wiedzy.
        Macierz wymaga obu stref (start i koniec); rozkład po strefach używa{' '}
        <strong>strefy startu</strong> (także „(brak strefy)” gdy brak pola).
      </p>

      <p className={styles.packingFlowSummaryLine}>
        Akcji ataku w próbie: <strong>{flow.totalActions}</strong>, z parą stref (macierz):{' '}
        <strong>{flow.actionsWithZonePair}</strong>, unikalnych stref w macierzy: <strong>{flow.zoneKeys.length}</strong>.
      </p>

      <div className={styles.packingFlowControls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Metryka (macierz + suma na wykresie kontaktów)</span>
          <div className={styles.toggleGroup}>
            {( ['pxt', 'xtDelta', 'packPts'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.toggleButton} ${metric === m ? styles.active : ''}`}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={styles.packingFlowSubsection} aria-labelledby="packing-matrix-heading">
        <h3 id="packing-matrix-heading" className={styles.packingFlowSubTitle}>
          Macierz stref (start → koniec)
        </h3>
        <p className={styles.packingFlowSubLead}>
          Komórka = suma wybranej metryki dla wszystkich akcji z tą parą stref. Kolor = siła względem maksimum w macierzy (dla
          aktualnej metryki). Komórki z małym <strong>n</strong> są przyciemnione (n &lt; 5). Najedź na komórkę, aby zobaczyć n.
        </p>
        {flow.zoneKeys.length === 0 ? (
          <p className={styles.shapeBucketEmpty} role="status">
            Brak akcji z uzupełnionymi strefami start i koniec — macierz jest pusta.
          </p>
        ) : (
          <div className={styles.packingFlowMatrixWrap} role="region" aria-label="Macierz stref packing">
            <table className={styles.packingFlowMatrix}>
              <thead>
                <tr>
                  <th className={styles.packingFlowMatrixCorner} scope="col">
                    Start → Koniec
                  </th>
                  {flow.zoneKeys.map((z) => (
                    <th key={z} scope="col">
                      {z}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flow.zoneKeys.map((row) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {flow.zoneKeys.map((col) => {
                      const e = flow.edgeByKey.get(edgeKey(row, col));
                      const v = e ? metricFromEdge(e, metric) : 0;
                      const n = e?.n ?? 0;
                      const intensity = maxMatrixVal > 0 && e ? Math.min(1, Math.abs(v) / maxMatrixVal) : 0;
                      const bg = `rgba(59, 130, 246, ${0.08 + intensity * 0.82})`;
                      const dim = n > 0 && n < 5;
                      return (
                        <td
                          key={col}
                          className={`${styles.packingFlowHeatCell} ${dim ? styles.packingFlowHeatCellDim : ''}`}
                          style={{ backgroundColor: e ? bg : undefined }}
                          title={e ? `n=${n}, ${METRIC_LABELS[metric]}=${formatMetricValue(v, metric)}` : undefined}
                        >
                          {e ? formatMetricValue(v, metric) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.packingFlowSubsection} aria-labelledby="packing-contact-chart-heading">
        <h3 id="packing-contact-chart-heading" className={styles.packingFlowSubTitle}>
          Kontakty: 1T / 2T / 3T+
        </h3>
        <p className={styles.packingFlowSubLead}>
          Łączna liczba akcji, łączna wartość metryki w grupie lub wartość na jedno podanie — przełącz poniżej.
        </p>
        <div className={styles.controlGroup} style={{ marginBottom: 12 }}>
          <span className={styles.controlLabel}>Wykres kontaktów</span>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggleButton} ${contactMode === 'count' ? styles.active : ''}`}
              onClick={() => setContactMode('count')}
            >
              Liczba akcji
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${contactMode === 'sum' ? styles.active : ''}`}
              onClick={() => setContactMode('sum')}
            >
              Suma wartości
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${contactMode === 'avg' ? styles.active : ''}`}
              onClick={() => setContactMode('avg')}
            >
              Wartość / podanie
            </button>
          </div>
        </div>
        <div className={styles.packingFlowChartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={contactBarData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                label={{ value: contactYLabel, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(x) =>
                  contactMode === 'count' ? String(x) : typeof x === 'number' ? x.toFixed(contactMode === 'avg' ? 4 : 3) : x
                }
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { name: string; value: number; n: number };
                  return (
                    <div className={styles.tooltipCustom}>
                      <div className={styles.tooltipLabel}>{p.name}</div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDesc}>Wartość:</span>
                        <span className={styles.tooltipVal}>
                          {contactMode === 'count'
                            ? p.value
                            : contactMode === 'sum'
                              ? formatMetricValue(p.value, metric)
                              : formatMetricValue(p.value, metric)}
                        </span>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span className={styles.tooltipDesc}>n w grupie:</span>
                        <span className={styles.tooltipVal}>{p.n}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" name={contactYLabel} radius={[4, 4, 0, 0]} maxBarSize={56}>
                {contactBarData.map((_, i) => (
                  <Cell key={i} fill={['#3b82f6', '#10b981', '#f59e0b', '#94a3b8'][i] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.packingFlowSubsection} aria-labelledby="packing-zone-contact-heading">
        <h3 id="packing-zone-contact-heading" className={styles.packingFlowSubTitle}>
          Kontakty według strefy startu
        </h3>
        <p className={styles.packingFlowSubLead}>
          Do <strong>28</strong> stref z największą liczbą akcji. Skumulowany wykres: albo liczba akcji w typie kontaktu, albo udział
          procentowy w obrębie strefy.
        </p>
        <div className={styles.controlGroup} style={{ marginBottom: 12 }}>
          <span className={styles.controlLabel}>Skumulowane segmenty</span>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggleButton} ${zoneStackMode === 'count' ? styles.active : ''}`}
              onClick={() => setZoneStackMode('count')}
            >
              Liczba (stack)
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${zoneStackMode === 'share' ? styles.active : ''}`}
              onClick={() => setZoneStackMode('share')}
            >
              Udział % w strefie
            </button>
          </div>
        </div>
        {zoneChartRows.length === 0 ? (
          <p className={styles.shapeBucketEmpty} role="status">
            Brak danych stref startu.
          </p>
        ) : (
          <div className={styles.packingFlowZoneChartWrap} style={{ height: zoneChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={zoneChartRows}
                margin={{ top: 8, right: 24, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(v) => (zoneStackMode === 'share' ? `${v}%` : String(v))}
                  domain={zoneStackMode === 'share' ? [0, 100] : undefined}
                />
                <YAxis type="category" dataKey="zone" width={88} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof zoneChartRows)[0];
                    return (
                      <div className={styles.tooltipCustom}>
                        <div className={styles.tooltipLabel}>{row.zone}</div>
                        <div className={styles.tooltipRow}>
                          <span className={styles.tooltipDesc}>Łącznie akcji:</span>
                          <span className={styles.tooltipVal}>{row.total}</span>
                        </div>
                        {payload.map((pl) => (
                          <div key={pl.name} className={styles.tooltipRow}>
                            <span className={styles.tooltipDesc}>{pl.name}:</span>
                            <span className={styles.tooltipVal}>
                              {zoneStackMode === 'share'
                                ? `${typeof pl.value === 'number' ? pl.value.toFixed(1) : pl.value}%`
                                : pl.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 8 }} />
                {zoneStackMode === 'count' ? (
                  <>
                    <Bar dataKey="c1" stackId="z" name="1 kontakt" fill={CONTACT_COLORS.c1} maxBarSize={28} />
                    <Bar dataKey="c2" stackId="z" name="2 kontakty" fill={CONTACT_COLORS.c2} maxBarSize={28} />
                    <Bar dataKey="c3" stackId="z" name="3+ kontaktów" fill={CONTACT_COLORS.c3} maxBarSize={28} />
                    <Bar dataKey="unknown" stackId="z" name="Nieznane" fill={CONTACT_COLORS.unknown} maxBarSize={28} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="c1s" stackId="zs" name="1 kontakt" fill={CONTACT_COLORS.c1} maxBarSize={28} />
                    <Bar dataKey="c2s" stackId="zs" name="2 kontakty" fill={CONTACT_COLORS.c2} maxBarSize={28} />
                    <Bar dataKey="c3s" stackId="zs" name="3+ kontaktów" fill={CONTACT_COLORS.c3} maxBarSize={28} />
                    <Bar dataKey="uks" stackId="zs" name="Nieznane" fill={CONTACT_COLORS.unknown} maxBarSize={28} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
