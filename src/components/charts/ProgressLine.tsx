// src/components/charts/ProgressLine.tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type Props = {
  exerciseId: string;
  exerciseName: string;
  data: Array<{ date: string; oneRepMax: number }>;
  onClick?: (exerciseId: string) => void;
};

export function ProgressLine({
  exerciseId,
  exerciseName,
  data,
  onClick,
}: Props) {
  if (data.length < 2) {
    return (
      <div className="p-3 rounded-lg border border-border bg-surface">
        <div className="text-h3 font-bold text-text">{exerciseName}</div>
        <div className="text-caption text-text-muted mt-1">
          기록 부족 — 2회 이상 기록 후 추이가 나타나요
        </div>
      </div>
    );
  }

  const latest = data[data.length - 1].oneRepMax;
  const earliest = data[0].oneRepMax;
  const delta = Math.round((latest - earliest) * 10) / 10;
  const deltaSign = delta >= 0 ? "+" : "";

  return (
    <button
      type="button"
      onClick={() => onClick?.(exerciseId)}
      className="w-full text-left p-3 rounded-lg border border-border bg-surface hover:bg-accent-soft transition-colors"
    >
      <span className="block text-h3 font-bold text-text">{exerciseName}</span>
      <span className="block text-caption text-text-muted">1RM 추이 (12주)</span>
      <span className="block h-16 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              dataKey="oneRepMax"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </span>
      <span className="block text-caption mt-1 text-text">
        {latest}kg · {deltaSign}
        {delta}kg
      </span>
    </button>
  );
}
