"use client";

import { ChevronLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthSessionEntry } from "@/lib/queries/sessions";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

type DaySummary = {
  dayOfMonth: number;
  dayLabel: string;
  isToday: boolean;
  isFuture: boolean;
  exercises: Array<{ id: string; name: string }>;
  weight?: { morning?: number; evening?: number };
  challengeCount: number;
  sessionIds: string[];
};

type Props = {
  year: number;
  /** 1-indexed */
  month: number;
  /** 이 날짜가 속한 주(월~일)를 표시 */
  anchorDay: number;
  todayDayOfMonth?: number;
  monthSessions: MonthSessionEntry[];
  weightByDate: Record<number, { morning?: number; evening?: number }>;
  challengeByDate: Record<number, number>;
  onBack: () => void;
  onSelectSession: (sessionId: string) => void;
  onEmptyDateClick: () => void;
};

/** 월요일 시작 주의 월요일 date-of-month 계산 (해당 월 내로 클램프하지 않음) */
function weekStartMonday(
  year: number,
  monthOneIndexed: number,
  anchorDay: number,
): Date {
  const anchor = new Date(Date.UTC(year, monthOneIndexed - 1, anchorDay));
  const dayOfWeek = (anchor.getUTCDay() + 6) % 7; // 월=0
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - dayOfWeek);
  return monday;
}

export function WeekView({
  year,
  month,
  anchorDay,
  todayDayOfMonth,
  monthSessions,
  weightByDate,
  challengeByDate,
  onBack,
  onSelectSession,
  onEmptyDateClick,
}: Props) {
  const monday = weekStartMonday(year, month, anchorDay);
  const monthMap = new Map(
    monthSessions.map((s) => [s.dayOfMonth, s]),
  );

  const days: DaySummary[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    // 이 주가 현재 표시 중인 월과 다른 월로 넘어가는 날은 데이터 없음 처리
    const sameMonth = y === year && m === month;
    const session = sameMonth ? monthMap.get(day) : undefined;
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const cellIso = d.toISOString().slice(0, 10);
    return {
      dayOfMonth: day,
      dayLabel: DAY_LABELS[i],
      isToday:
        sameMonth && todayDayOfMonth !== undefined && day === todayDayOfMonth,
      isFuture: cellIso > todayIso,
      exercises: session?.exercises ?? [],
      weight: sameMonth ? weightByDate[day] : undefined,
      challengeCount: sameMonth ? (challengeByDate[day] ?? 0) : 0,
      sessionIds: session?.sessionIds ?? [],
    };
  });

  const mondayLabel = `${monday.getUTCMonth() + 1}/${monday.getUTCDate()}`;
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const sundayLabel = `${sunday.getUTCMonth() + 1}/${sunday.getUTCDate()}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text"
        >
          <ChevronLeft className="w-4 h-4" />
          월간으로
        </button>
        <span className="text-caption font-mono text-text-muted">
          {mondayLabel} – {sundayLabel}
        </span>
      </div>

      <ul className="space-y-2">
        {days.map((d) => {
          const hasContent = d.exercises.length > 0 || !!d.weight;
          const handleClick = () => {
            if (d.sessionIds[0]) onSelectSession(d.sessionIds[0]);
            else if (!d.isFuture) onEmptyDateClick();
          };
          return (
            <li key={d.dayOfMonth}>
              <button
                type="button"
                onClick={handleClick}
                disabled={d.isFuture}
                className={cn(
                  "w-full text-left rounded-lg border border-border bg-surface p-3",
                  "flex gap-3 items-start",
                  "hover:bg-accent-soft transition-colors",
                  d.isToday && "border-accent",
                  d.isFuture && "opacity-50 cursor-default",
                )}
              >
                <div
                  className={cn(
                    "shrink-0 flex flex-col items-center justify-center rounded-md w-11 h-11",
                    d.isToday
                      ? "bg-accent text-surface"
                      : "bg-accent-soft text-text",
                  )}
                >
                  <span className="text-[10px] font-semibold leading-none">
                    {d.dayLabel}
                  </span>
                  <span className="text-body font-extrabold leading-none mt-1">
                    {d.dayOfMonth}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {d.exercises.length > 0 ? (
                    <div className="text-body text-text truncate">
                      {d.exercises.map((e) => e.name).join(", ")}
                    </div>
                  ) : (
                    <div className="text-body text-text-muted">
                      {d.isFuture ? "예정" : hasContent ? "" : "기록 없음"}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-caption text-text-muted">
                    {d.weight?.morning !== undefined && (
                      <span
                        className="font-mono tabular-nums px-1.5 py-px rounded"
                        style={{
                          background: "rgba(77, 196, 255, 0.18)",
                          color: "#4dc4ff",
                        }}
                      >
                        {d.weight.morning.toFixed(1)}
                      </span>
                    )}
                    {d.weight?.evening !== undefined && (
                      <span
                        className="font-mono tabular-nums px-1.5 py-px rounded"
                        style={{
                          background: "rgba(255, 77, 122, 0.18)",
                          color: "#ff4d7a",
                        }}
                      >
                        {d.weight.evening.toFixed(1)}
                      </span>
                    )}
                    {d.challengeCount > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5"
                        style={{ color: "#facc15" }}
                      >
                        <Trophy className="w-3 h-3" strokeWidth={2.5} />
                        {d.challengeCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
