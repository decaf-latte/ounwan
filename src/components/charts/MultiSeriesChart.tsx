// src/components/charts/MultiSeriesChart.tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = {
  data: Array<{ date: string; oneRepMax: number; volume: number }>;
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function MultiSeriesChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: formatDateShort(d.date),
  }));

  return (
    <div className="h-64 lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formatted}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--color-border)"
            strokeDasharray="2 2"
            vertical={false}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="left"
            dataKey="oneRepMax"
            stroke="var(--color-accent)"
            strokeWidth={2}
            name="1RM (kg)"
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="right"
            dataKey="volume"
            stroke="var(--color-accent-strong)"
            strokeWidth={2}
            strokeDasharray="4 2"
            name="볼륨 (kg)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
