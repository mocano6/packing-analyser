"use client";

import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { TrendyKpiUnit, formatKpiValue } from "@/utils/trendyKpis";

export type PossessionTrendPoint = {
  label: string;
  team: number;
  opponent: number;
  dead: number;
  teamMinutes?: number;
  opponentMinutes?: number;
  deadMinutes?: number;
};

type Props = {
  data: PossessionTrendPoint[];
  unit?: TrendyKpiUnit;
};

export const PossessionTrendChart: React.FC<Props> = ({ data, unit = "percent" }) => {
  if (!data.length) {
    return (
      <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
        Brak danych trendu dla wybranych meczów.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis width={40} />
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const payload = props && props.payload ? (props.payload as PossessionTrendPoint) : undefined;
              const dataKey = props && typeof props.dataKey === "string" ? (props.dataKey as keyof PossessionTrendPoint) : undefined;

              const labelBase =
                dataKey === "team"
                  ? "Posiadanie naszego zespołu"
                  : dataKey === "opponent"
                  ? "Posiadanie przeciwnika"
                  : "Czas martwy";

              const minutes =
                dataKey === "team"
                  ? payload?.teamMinutes
                  : dataKey === "opponent"
                  ? payload?.opponentMinutes
                  : payload?.deadMinutes;

              const suffix = minutes != null ? ` (${minutes.toFixed(1)} min)` : "";
              return [`${formatKpiValue(value, unit)}${suffix}`, labelBase];
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
          />
          <Legend />
          <Line type="monotone" dataKey="team" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} name="Our possession" />
          <Line type="monotone" dataKey="opponent" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} name="Opponent possession" />
          <Line type="monotone" dataKey="dead" stroke="#64748b" strokeWidth={2} dot={{ r: 2 }} name="Dead time" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PossessionTrendChart;

