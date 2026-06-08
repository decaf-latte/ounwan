// src/components/ui/mini-calendar.tsx
"use client";
import { cn } from "@/lib/utils";
import { bodyPartStyle } from "@/lib/workout/body-part-color";

export type DayEntry = {
  bodyPartColors: string[];
  sessionIds: string[];
};

type Props = {
  year: number;
  /** 1-indexed (1=Jan, 12=Dec) — URL 표기와 일치 */
  month: number;
  todayDayOfMonth?: number;
  dotsByDate: Record<number, DayEntry>;
  /** 날짜별 대표 몸무게 (kg). 셀 아래 배지로 노출. */
  weightByDate?: Record<number, number>;
  /** 미지정 시 비활성 (대시보드용). 클릭 시 첫 sessionId 전달. */
  onDateClick?: (sessionId: string) => void;
  size?: "sm" | "md";
};

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function MiniCalendar({
  year,
  month,
  todayDayOfMonth,
  dotsByDate,
  weightByDate,
  onDateClick,
  size = "md",
}: Props) {
  // 첫 날의 요일 (월요일=0 ... 일요일=6)
  // JS Date: month 0-indexed, getDay()는 일=0...토=6
  // 월요일 시작으로 보정: (getDay() + 6) % 7
  const firstDayMonOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  // 해당 월 마지막 일
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div
      role="grid"
      aria-label={`${year}년 ${month}월 운동 캘린더`}
      className={cn(
        "grid grid-cols-7 gap-1",
        size === "sm" ? "text-[10px]" : "text-xs",
      )}
    >
      {DAY_LABELS.map((d) => (
        <div
          key={d}
          role="columnheader"
          className="text-center text-text-muted py-1 font-semibold"
        >
          {d}
        </div>
      ))}

      {Array.from({ length: 42 }).map((_, i) => {
        const dayNum = i - firstDayMonOffset + 1;
        const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
        const entry = inMonth ? dotsByDate[dayNum] : undefined;
        const weightKg = inMonth ? weightByDate?.[dayNum] : undefined;
        const isToday = inMonth && dayNum === todayDayOfMonth;
        const clickable = !!entry && !!onDateClick;

        const cellContent = (
          <>
            <span>{inMonth ? dayNum : ""}</span>
            {entry && (
              <div className="flex justify-center gap-0.5 mt-0.5">
                {entry.bodyPartColors.slice(0, 4).map((c, j) => (
                  <span
                    key={j}
                    className="w-1 h-1 rounded-full inline-block dark:saturate-90 dark:brightness-95"
                    style={bodyPartStyle(c)}
                  />
                ))}
                {entry.bodyPartColors.length > 4 && (
                  <span className="text-[8px] text-text-muted">
                    +{entry.bodyPartColors.length - 4}
                  </span>
                )}
              </div>
            )}
            {weightKg !== undefined && (
              <div className="mt-0.5 text-[9px] font-mono text-accent leading-none">
                {weightKg}kg
              </div>
            )}
          </>
        );

        if (clickable) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick(entry.sessionIds[0])}
              className={cn(
                "text-center rounded p-1 hover:bg-accent-soft transition-colors",
                isToday && "border-2 border-accent",
              )}
              aria-label={`${month}월 ${dayNum}일, 세션 ${entry.sessionIds.length}개`}
            >
              {cellContent}
            </button>
          );
        }
        return (
          <div
            key={i}
            role="gridcell"
            className={cn(
              "text-center rounded p-1",
              isToday && "border-2 border-accent",
              !inMonth && "text-text-ghost",
            )}
            aria-label={inMonth ? `${month}월 ${dayNum}일` : undefined}
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
