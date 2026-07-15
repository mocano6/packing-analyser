'use client';

import React from 'react';
import { ReferenceDot } from 'recharts';
import type { ChartMarkerPoint } from '@/utils/statystykiZespoluChartEvents';

const GOAL_RING = '#90ee90';
const DOT_FILL = '#111827';
const ICON_SIZE = 8;
const LABEL_SIZE = 9;

export type ScatterMarkerDatum = {
  markerY: number;
  eventSide: ChartMarkerPoint['side'];
  count: number;
  [key: string]: string | number;
};

type Props = {
  points: ChartMarkerPoint[];
  xDataKey?: string;
  xAxisId?: string | number;
  yAxisId?: string | number;
};

function markerGroupWidth(count: number): number {
  if (count <= 1) return ICON_SIZE;
  const digits = String(count).length;
  return ICON_SIZE + 2 + digits * 6 + 2;
}

function GoalIcon() {
  return (
    <circle
      cx={4}
      cy={4}
      r={3.2}
      fill={DOT_FILL}
      stroke={GOAL_RING}
      strokeWidth={1.4}
    />
  );
}

type MarkerShapeProps = {
  cx?: number;
  cy?: number;
  payload?: ChartMarkerPoint;
};

function renderMarkerShape(props: MarkerShapeProps) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <g />;

  const groupWidth = markerGroupWidth(payload.count);
  const placeAbove = payload.y >= 0;
  const baseX = cx - groupWidth / 2;
  const baseY = placeAbove ? cy - ICON_SIZE - 8 : cy + 6;

  return (
    <g transform={`translate(${baseX}, ${baseY})`} pointerEvents="none">
      <svg width={groupWidth} height={ICON_SIZE + 2} viewBox={`0 0 ${groupWidth} ${ICON_SIZE + 2}`} aria-hidden>
        <g transform="translate(0, 1)">
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 8 8" aria-hidden>
            <GoalIcon />
          </svg>
        </g>
        {payload.count > 1 ? (
          <text
            x={ICON_SIZE + 2}
            y={ICON_SIZE}
            fontSize={LABEL_SIZE}
            fontWeight={700}
            fill="#334155"
            dominantBaseline="middle"
          >
            {payload.count}
          </text>
        ) : null}
      </svg>
    </g>
  );
}

export function markerPointsToScatterData(
  points: ChartMarkerPoint[],
  xDataKey = 'minute',
): ScatterMarkerDatum[] {
  return points.map((point) => ({
    [xDataKey]: point.x,
    markerY: point.y,
    eventSide: point.side,
    count: point.count,
  }));
}

export function renderChartMatchEventMarkers({
  points,
  xAxisId,
  yAxisId,
}: Props): React.ReactNode {
  const goalPoints = points.filter((point) => point.type === 'goal');
  if (goalPoints.length === 0) return null;

  return goalPoints.map((point) => (
    <ReferenceDot
      key={point.key}
      x={point.x}
      y={point.y}
      xAxisId={xAxisId}
      yAxisId={yAxisId}
      r={0}
      ifOverflow="visible"
      isFront
      clipDot={false}
      shape={(props) => renderMarkerShape({ ...props, payload: point })}
    />
  ));
}

/** @deprecated Używaj renderChartMatchEventMarkers — Recharts wymaga ReferenceDot jako bezpośrednich dzieci wykresu. */
export default function ChartMatchEventMarkers(props: Props) {
  return <>{renderChartMatchEventMarkers(props)}</>;
}
