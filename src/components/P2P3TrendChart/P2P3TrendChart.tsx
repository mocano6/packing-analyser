"use client";

import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export type P2P3TrendPoint = {
  label: string;
  p2: number;
  p3: number;
};

type Props = {
  data: P2P3TrendPoint[];
};

export const P2P3TrendChart: React.FC<Props> = ({ data }) => {
  if (!data.length) {
    return (
      <div style={{ color: "#64748b", fontSize: 13, padding: "8px 0" }}>
        Brak danych trendu dla wybranych meczów.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis width={32} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const label = name === "p2" ? "Liczba akcji P2" : "Liczba akcji P3";
              return [value.toFixed(0), label];
            }}
            labelFormatter={(label) => String(label)}
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
          />
          <Legend />
          <Line type="monotone" dataKey="p2" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} name="P2" />
          <Line type="monotone" dataKey="p3" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} name="P3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default P2P3TrendChart;

