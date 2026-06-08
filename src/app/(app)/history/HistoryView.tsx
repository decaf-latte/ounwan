// src/app/(app)/history/HistoryView.tsx
"use client";
import { useState, useMemo, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";

// recharts 청크는 /history에서만, 클라 마운트 시점에 로드
const ProgressLine = dynamic(
  () => import("@/components/charts/ProgressLine").then((m) => m.ProgressLine),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);
import { SessionDetailDialog } from "@/components/workout/SessionDetailDialog";
import { ExerciseProgressDialog } from "@/components/workout/ExerciseProgressDialog";
import { useQuery } from "@tanstack/react-query";
import { fetchExerciseProgressionClient } from "@/lib/queries/sessions-client";
import type { MonthSessionEntry, TopExercise } from "@/lib/queries/sessions";

type Props = {
  year: number;
  month: number; // 1-indexed
  todayDayOfMonth?: number;
  monthSessions: MonthSessionEntry[];
  topExercises: TopExercise[];
  catalog: { id: string; name: string }[];
};

const MONTH_NAMES = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

export function HistoryView({
  year,
  month,
  todayDayOfMonth,
  monthSessions,
  topExercises,
  catalog,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedExercise, setSelectedExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // monthSessions → dotsByDate
  const dotsByDate = useMemo<Record<number, DayEntry>>(
    () =>
      Object.fromEntries(
        monthSessions.map((e) => [
          e.dayOfMonth,
          {
            bodyPartColors: e.bodyPartColors,
            sessionIds: e.sessionIds,
            categories: e.categories,
          },
        ]),
      ),
    [monthSessions],
  );

  const goMonth = (deltaMonths: number) => {
    let y = year;
    let m = month + deltaMonths;
    if (m < 1) {
      m += 12;
      y -= 1;
    } else if (m > 12) {
      m -= 12;
      y += 1;
    }
    startTransition(() => {
      router.push(`/history?y=${y}&m=${m}`, { scroll: false });
    });
  };
  const goToday = () => {
    startTransition(() => {
      router.push("/history", { scroll: false });
    });
  };

  // 리스트 탭: monthSessions를 일자 desc로 정렬해 카드 형태로 표시
  const sortedSessions = useMemo(
    () => [...monthSessions].sort((a, b) => b.dayOfMonth - a.dayOfMonth),
    [monthSessions],
  );

  return (
    <div className="mt-5 space-y-4">
      {/* 월 navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goMonth(-1)}
          aria-label="이전 달"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-h3 font-bold text-text">
          {year}년 {MONTH_NAMES[month - 1]}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            disabled={!!todayDayOfMonth}
          >
            오늘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goMonth(1)}
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={cn(
            "px-3 py-2 text-body flex items-center gap-1",
            viewMode === "calendar"
              ? "border-b-2 border-accent text-accent font-semibold"
              : "text-text-muted",
          )}
        >
          <CalendarDays className="w-4 h-4" /> 캘린더
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "px-3 py-2 text-body flex items-center gap-1",
            viewMode === "list"
              ? "border-b-2 border-accent text-accent font-semibold"
              : "text-text-muted",
          )}
        >
          <List className="w-4 h-4" /> 리스트
        </button>
      </div>

      {/* 캘린더 또는 리스트 */}
      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {viewMode === "calendar" ? (
          monthSessions.length === 0 ? (
            <p className="text-body text-text-muted py-12 text-center">
              이 달엔 기록이 없어요.
            </p>
          ) : (
            <MiniCalendar
              year={year}
              month={month}
              todayDayOfMonth={todayDayOfMonth}
              dotsByDate={dotsByDate}
              onDateClick={(sessionId) => setSelectedSessionId(sessionId)}
              size="md"
            />
          )
        ) : sortedSessions.length === 0 ? (
          <p className="text-body text-text-muted py-12 text-center">
            이 달엔 기록이 없어요.
          </p>
        ) : (
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {sortedSessions.map((s) => (
              <li key={s.sessionIds[0]}>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(s.sessionIds[0])}
                  className="w-full text-left rounded-xl border border-border p-4 bg-surface hover:bg-accent-soft transition-colors"
                >
                  <div className="text-caption text-text-muted">
                    {month}월 {s.dayOfMonth}일
                  </div>
                  <div className="text-body font-bold text-text mt-1">
                    부위 {s.bodyPartColors.length}개 ·
                    {s.sessionIds.length > 1
                      ? ` 세션 ${s.sessionIds.length}개`
                      : " 세션 1개"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ProgressLine 카드 영역 */}
      <section className="mt-8">
        <h2 className="text-h3 font-bold text-text mb-3">운동별 추이</h2>
        {topExercises.length === 0 ? (
          <p className="text-body text-text-muted">
            아직 추이를 보여줄 운동이 없어요. 헬스장에서 더 채워보세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {topExercises.map((ex) => (
              <ExerciseProgressCard
                key={ex.exerciseId}
                exercise={ex}
                onClick={(id) =>
                  setSelectedExercise({ id, name: ex.exerciseName })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* 모달 2개 */}
      <SessionDetailDialog
        sessionId={selectedSessionId}
        catalog={catalog}
        onClose={() => setSelectedSessionId(null)}
      />
      <ExerciseProgressDialog
        exerciseId={selectedExercise?.id ?? null}
        exerciseName={selectedExercise?.name ?? ""}
        onClose={() => setSelectedExercise(null)}
      />
    </div>
  );
}

/**
 * 카드별로 ProgressLine 데이터 fetch — 운동 8개 × 동시 호출.
 * staleTime 5분으로 페이지 재방문 시 캐시 활용.
 */
function ExerciseProgressCard({
  exercise,
  onClick,
}: {
  exercise: TopExercise;
  onClick: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["exercise-progression", exercise.exerciseId, 12],
    queryFn: () => fetchExerciseProgressionClient(exercise.exerciseId, 12),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
  return (
    <ProgressLine
      exerciseId={exercise.exerciseId}
      exerciseName={exercise.exerciseName}
      data={(data ?? []).map((p) => ({
        date: p.date,
        oneRepMax: p.oneRepMax,
      }))}
      onClick={onClick}
    />
  );
}
