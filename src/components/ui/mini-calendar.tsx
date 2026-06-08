// src/components/ui/mini-calendar.tsx
"use client";
import { cn } from "@/lib/utils";

export type DayEntry = {
  /** 운영용으로 유지 — 추후 정리 가능 */
  bodyPartColors: string[];
  sessionIds: string[];
  /** 상체/하체 카테고리 (둘 다면 둘 다 포함) */
  categories?: Array<"upper" | "lower">;
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

const UPPER_FILL = "rgba(239, 68, 68, 0.22)"; // red
const LOWER_FILL = "rgba(59, 130, 246, 0.22)"; // blue

function categoryFillStyle(
  categories: ReadonlyArray<"upper" | "lower">,
): React.CSSProperties | undefined {
  const hasUpper = categories.includes("upper");
  const hasLower = categories.includes("lower");
  if (hasUpper && hasLower) {
    return {
      background: `linear-gradient(135deg, ${UPPER_FILL} 0%, ${UPPER_FILL} 50%, ${LOWER_FILL} 50%, ${LOWER_FILL} 100%)`,
    };
  }
  if (hasUpper) return { background: UPPER_FILL };
  if (hasLower) return { background: LOWER_FILL };
  return undefined;
}

export function MiniCalendar({
  year,
  month,
  todayDayOfMonth,
  dotsByDate,
  weightByDate,
  onDateClick,
  size = "md",
}: Props) {
  const firstDayMonOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const isSm = size === "sm";

  return (
    <div
      role="grid"
      aria-label={`${year}년 ${month}월 운동 캘린더`}
      className={cn(
        "grid grid-cols-7 gap-1",
        isSm ? "text-xs" : "text-sm",
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
        const categories = entry?.categories ?? [];

        const fillStyle = categoryFillStyle(categories);

        const cellContent = (
          <>
            <span className={cn(isSm ? "text-sm" : "text-base", "font-semibold")}>
              {inMonth ? dayNum : ""}
            </span>
            {weightKg !== undefined && (
              <div className="mt-1 text-[10px] font-mono text-accent leading-none">
                {weightKg}kg
              </div>
            )}
          </>
        );

        const cellCls = cn(
          "rounded-md text-center flex flex-col items-center justify-center",
          isSm ? "min-h-14 p-1.5" : "min-h-16 p-2",
          isToday && "border-2 border-accent",
          !inMonth && "text-text-ghost",
        );

        if (clickable) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick(entry.sessionIds[0])}
              className={cn(cellCls, !fillStyle && "hover:bg-accent-soft transition-colors")}
              style={fillStyle}
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
            className={cellCls}
            style={fillStyle}
            aria-label={inMonth ? `${month}월 ${dayNum}일` : undefined}
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
