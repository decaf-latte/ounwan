// src/components/ui/mini-calendar.tsx
"use client";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type DayEntry = {
  /** 운영용으로 유지 — 추후 정리 가능 */
  bodyPartColors: string[];
  sessionIds: string[];
  /** 상체/하체 카테고리 (둘 다면 둘 다 포함) */
  categories?: Array<"upper" | "lower">;
  /** 그날 수행한 운동 수 (unique) */
  exerciseCount?: number;
};

type Props = {
  year: number;
  /** 1-indexed (1=Jan, 12=Dec) — URL 표기와 일치 */
  month: number;
  todayDayOfMonth?: number;
  dotsByDate: Record<number, DayEntry>;
  /** 날짜별 몸무게 — 아침/저녁 각각 셀 아래에 배지로 노출. */
  weightByDate?: Record<number, { morning?: number; evening?: number }>;
  /** 날짜별 챌린지 완료 개수. 1 이상이면 트로피 아이콘 노출. */
  challengeByDate?: Record<number, number>;
  /** 미지정 시 비활성. 클릭 시 (day, 해당 날짜 entry) 전달. entry 없으면 빈 날짜. */
  onDateClick?: (day: number, entry?: DayEntry) => void;
  size?: "sm" | "md";
};

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

// 네온 톤 — 테두리는 진하고 안쪽은 연하게
const UPPER_BORDER = "#ff4d7a"; // neon pink-red
const UPPER_FILL = "rgba(255, 77, 122, 0.12)";
const LOWER_BORDER = "#4dc4ff"; // neon cyan-blue
const LOWER_FILL = "rgba(77, 196, 255, 0.12)";

type CategoryStyle = {
  background?: string;
  borderColor?: string;
  /** 둘 다인 경우 — 보더는 그라데이션으로 별도 처리 */
  borderImage?: string;
};

function categoryStyleFor(
  categories: ReadonlyArray<"upper" | "lower">,
): CategoryStyle | undefined {
  const hasUpper = categories.includes("upper");
  const hasLower = categories.includes("lower");
  if (hasUpper && hasLower) {
    return {
      background: `linear-gradient(135deg, ${UPPER_FILL} 0%, ${UPPER_FILL} 50%, ${LOWER_FILL} 50%, ${LOWER_FILL} 100%)`,
      borderImage: `linear-gradient(135deg, ${UPPER_BORDER}, ${LOWER_BORDER}) 1`,
    };
  }
  if (hasUpper) return { background: UPPER_FILL, borderColor: UPPER_BORDER };
  if (hasLower) return { background: LOWER_FILL, borderColor: LOWER_BORDER };
  return undefined;
}

export function MiniCalendar({
  year,
  month,
  todayDayOfMonth,
  dotsByDate,
  weightByDate,
  challengeByDate,
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
        const weights = inMonth ? weightByDate?.[dayNum] : undefined;
        const challengeCount = inMonth
          ? (challengeByDate?.[dayNum] ?? 0)
          : 0;
        const isToday = inMonth && dayNum === todayDayOfMonth;
        const clickable = inMonth && !!onDateClick;
        const categories = entry?.categories ?? [];
        const exerciseCount = entry?.exerciseCount ?? 0;

        const catStyle = categoryStyleFor(categories);

        const cellContent = (
          <>
            {challengeCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 flex items-center gap-0.5 text-[9px] font-bold leading-none"
                style={{ color: "#facc15" }}
                aria-label={`챌린지 ${challengeCount}개 완료`}
              >
                <Trophy className="w-2.5 h-2.5" strokeWidth={2.5} />
                {challengeCount > 1 && challengeCount}
              </span>
            )}
            <span className={cn(isSm ? "text-sm" : "text-base", "font-semibold")}>
              {inMonth ? dayNum : ""}
            </span>
            {exerciseCount > 0 && (
              <span className="mt-0.5 text-[9px] font-mono leading-none text-text-muted">
                {exerciseCount}운동
              </span>
            )}
            {(weights?.morning !== undefined || weights?.evening !== undefined) && (
              <div className="mt-1 flex flex-col items-center gap-[3px]">
                {weights?.morning !== undefined && (
                  <span
                    className="text-[9px] font-mono leading-tight px-1.5 py-[2px] rounded-md tabular-nums"
                    style={{
                      background: "rgba(77, 196, 255, 0.18)",
                      color: "#4dc4ff",
                    }}
                  >
                    {weights.morning.toFixed(1)}
                  </span>
                )}
                {weights?.evening !== undefined && (
                  <span
                    className="text-[9px] font-mono leading-tight px-1.5 py-[2px] rounded-md tabular-nums"
                    style={{
                      background: "rgba(255, 77, 122, 0.18)",
                      color: "#ff4d7a",
                    }}
                  >
                    {weights.evening.toFixed(1)}
                  </span>
                )}
              </div>
            )}
          </>
        );

        // today가 우선 — accent(초록) 보더로 덮어씀
        const cellStyle: React.CSSProperties | undefined = isToday
          ? catStyle
            ? { background: catStyle.background }
            : undefined
          : catStyle
            ? {
                background: catStyle.background,
                borderColor: catStyle.borderColor,
                borderImage: catStyle.borderImage,
              }
            : undefined;

        const hasCatBorder = !isToday && !!catStyle;
        const cellCls = cn(
          "relative rounded-md text-center flex flex-col items-center justify-center",
          isSm ? "min-h-14 p-1.5" : "min-h-16 p-2",
          isToday && "border-2 border-accent",
          hasCatBorder && "border-2",
          !inMonth && "text-text-ghost",
        );

        if (clickable) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick(dayNum, entry)}
              className={cn(cellCls, !cellStyle && "hover:bg-accent-soft transition-colors")}
              style={cellStyle}
              aria-label={
                entry
                  ? `${month}월 ${dayNum}일, 세션 ${entry.sessionIds.length}개`
                  : `${month}월 ${dayNum}일`
              }
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
            style={cellStyle}
            aria-label={inMonth ? `${month}월 ${dayNum}일` : undefined}
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
