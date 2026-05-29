"use client";

import Link from "next/link";
import { BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { DayChip } from "@/components/ui/day-chip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/dashboard/actions";
import type { TodaySession } from "@/lib/queries/sessions";
import type { RecentExercise } from "@/lib/queries/sets";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const DEFAULT_EXERCISE_GOAL = 8;

type Props = {
  userEmail: string;
  todaySession: TodaySession | null;
  /** 0=월 ... 6=일. Set이 아닌 number[] — RSC→Client 직렬화 제약 (Set 미지원) */
  weeklyDates: number[];
  recentExercises: RecentExercise[];
  /** 0=월 ... 6=일 */
  todayDayIndex: number;
};

function formatDate(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function Dashboard({
  todaySession,
  weeklyDates,
  recentExercises,
  todayDayIndex,
}: Props) {
  const today = new Date();
  const completed = todaySession !== null;
  const subline = completed
    ? `오늘 ${todaySession.bodyParts.join(", ")} 잘 끝냈어요`
    : "아직 운동 전이에요";

  return (
    <main className="p-5 max-w-md mx-auto pb-32">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-label text-accent-strong uppercase">
            {DAY_LABELS[todayDayIndex]} · {formatDate(today)}
          </div>
          <h1 className="text-display font-extrabold mt-1 text-text">
            {completed ? "오운완 ✓" : "오운완"}
          </h1>
          <p className="text-body text-text-muted mt-1">{subline}</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOut}>
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              aria-label="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* 진행 카드 */}
      <Card className="mt-5 p-4 flex items-center gap-4">
        <ProgressRing
          value={todaySession?.exerciseCount ?? 0}
          max={DEFAULT_EXERCISE_GOAL}
        />
        <div>
          <div className="text-stat-l font-extrabold leading-none">
            {todaySession?.exerciseCount ?? 0}
            <span className="text-body font-medium text-text-muted">
              {" "}
              / {DEFAULT_EXERCISE_GOAL}
            </span>
          </div>
          <div className="text-caption text-text-muted mt-1">
            운동 · {todaySession?.mainSetCount ?? 0}세트 완료
          </div>
        </div>
      </Card>

      {/* 이번 주 */}
      <section className="mt-5">
        <div className="flex justify-between items-center">
          <div className="text-h3 font-extrabold">이번 주</div>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          {DAY_LABELS.map((label, i) => {
            const state: "done" | "missed" | "today" = weeklyDates.includes(i)
              ? "done"
              : i === todayDayIndex
                ? "today"
                : "missed";
            return <DayChip key={label} day={label} state={state} />;
          })}
        </div>
      </section>

      {/* 최근 운동 */}
      {recentExercises.length > 0 && (
        <Card className="mt-4 p-3.5">
          <div className="text-caption text-text-muted font-semibold">
            최근 운동
          </div>
          {recentExercises.map((ex) => (
            <div
              key={ex.exerciseId}
              className="flex justify-between items-center mt-2"
            >
              <div className="text-body font-bold">{ex.exerciseName}</div>
              <div className="text-caption text-text font-semibold">
                {ex.lastWeightKg ?? "-"}kg × {ex.lastReps ?? "-"}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* CTA */}
      <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto flex gap-2">
        <Link href="/workout/new" className="flex-1">
          <Button size="lg" className="w-full">
            + 운동 시작
          </Button>
        </Link>
        <Button size="lg" variant="outline" aria-label="기록 보기">
          <BarChart3 className="w-5 h-5" />
        </Button>
      </div>
    </main>
  );
}
