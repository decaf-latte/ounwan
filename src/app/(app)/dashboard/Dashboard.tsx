"use client";

import Link from "next/link";
import { LogOut, Check, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/(app)/dashboard/actions";
import { WeightFab } from "@/components/weight/WeightEntryDialog";
import type { TodaySession } from "@/lib/queries/sessions";
import type { RecentExercise } from "@/lib/queries/sets";
import type { BodyWeightRow } from "@/lib/queries/body-weights";

const EXERCISE_GOAL = 8;

type Props = {
  todaySession: TodaySession | null;
  year: number;
  /** 1-indexed */
  month: number;
  dotsByDate: Record<number, DayEntry>;
  weightByDate: Record<number, number>;
  todayWeights: BodyWeightRow[];
  todayDateIso: string;
  recentExercises: RecentExercise[];
  todayDayOfMonth: number;
  /** "월" / "화" / ... */
  todayDayLabel: string;
  /** "6월 1일" */
  todayFormatted: string;
};

function Rule() {
  return <div className="h-px bg-border -mx-5" />;
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] tracking-[1.4px] uppercase"
      style={{ color: "var(--text-ghost)" }}
    >
      {children}
    </span>
  );
}

export function Dashboard({
  todaySession,
  year,
  month,
  dotsByDate,
  weightByDate,
  todayWeights,
  todayDateIso,
  recentExercises,
  todayDayOfMonth,
  todayDayLabel,
  todayFormatted,
}: Props) {
  const completed = todaySession !== null;
  const exerciseCount = todaySession?.exerciseCount ?? 0;
  const setCount = todaySession?.mainSetCount ?? 0;
  const subline = completed
    ? `오늘 ${todaySession.bodyParts.join("·")} 잘 끝냈어요`
    : "아직 운동 전이에요";

  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto pb-32 lg:pb-10">

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[1px] text-accent">
            {todayFormatted}{" "}
            <span style={{ color: "var(--text-ghost)" }}>{todayDayLabel}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="text-display font-extrabold tracking-tight leading-none">
              오운완
            </h1>
            {completed && (
              <span
                className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                style={{
                  background: "var(--accent)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <Check
                  className="w-[17px] h-[17px]"
                  style={{ color: "var(--accent-text)" }}
                  strokeWidth={2.6}
                />
              </span>
            )}
          </div>
          <p className="text-body text-text-muted mt-2">{subline}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 lg:hidden">
          <ThemeToggle />
          <form action={signOut}>
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              aria-label="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* ── 룰 ── */}
      <div className="mt-5">
        <Rule />
      </div>

      {/* ── 오늘 운동량 ── */}
      <section className="mt-4">
        <div className="flex justify-between items-end mb-3">
          <MonoLabel>오늘 운동량</MonoLabel>
          <span className="font-mono text-text-muted text-[13px] leading-none">
            <span
              className="font-bold leading-none"
              style={{ color: "var(--accent)", fontSize: 26 }}
            >
              {String(exerciseCount).padStart(2, "0")}
            </span>{" "}
            / {String(EXERCISE_GOAL).padStart(2, "0")}
          </span>
        </div>

        {/* 세그먼트 바 */}
        <div className="flex gap-1">
          {Array.from({ length: EXERCISE_GOAL }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[9px] transition-colors"
              style={{
                borderRadius: "var(--radius-sm)",
                background: i < exerciseCount ? "var(--accent)" : "var(--line2)",
                boxShadow:
                  i < exerciseCount
                    ? "0 0 8px var(--accent-soft)"
                    : "none",
              }}
            />
          ))}
        </div>

        <div
          className="flex gap-4 mt-2.5 font-mono text-[11px] tracking-[0.4px]"
          style={{ color: "var(--text-ghost)" }}
        >
          <span>
            <span className="text-text font-bold" style={{ fontSize: 13 }}>
              {setCount}
            </span>{" "}
            SETS
          </span>
          {completed && todaySession.bodyParts.length > 0 && (
            <span className="text-text-muted">
              {todaySession.bodyParts.join(" · ")}
            </span>
          )}
        </div>
      </section>

      {/* ── 룰 ── */}
      <div className="mt-5">
        <Rule />
      </div>

      {/* ── 이번 달 캘린더 ── */}
      <section className="mt-4">
        <div className="flex justify-between items-center mb-3">
          <MonoLabel>
            {year} / {String(month).padStart(2, "0")}
          </MonoLabel>
          <Link
            href="/weight"
            className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>몸무게 추이</span>
          </Link>
        </div>
        <MiniCalendar
          year={year}
          month={month}
          todayDayOfMonth={todayDayOfMonth}
          dotsByDate={dotsByDate}
          weightByDate={weightByDate}
        />
      </section>

      {/* ── 최근 운동 ── */}
      {recentExercises.length > 0 && (
        <>
          <div className="mt-5">
            <Rule />
          </div>
          <section className="mt-4">
            <MonoLabel>최근 운동</MonoLabel>
            <div className="mt-2">
              {recentExercises.map((ex, i) => (
                <div
                  key={ex.exerciseId}
                  className="flex justify-between items-center py-2"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span className="text-body font-semibold text-text truncate mr-3">
                    {ex.exerciseName}
                  </span>
                  <span
                    className="font-mono text-[13px] flex-shrink-0 whitespace-nowrap"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span className="text-text">{ex.lastWeightKg ?? "–"}</span>
                    kg ×{" "}
                    <span className="text-text">{ex.lastReps ?? "–"}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <WeightFab todayWeights={todayWeights} defaultDate={todayDateIso} />

      {/* ── CTA ── */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] left-5 right-5 max-w-md mx-auto lg:static lg:bottom-auto lg:mt-8 lg:max-w-xs lg:mx-0">
        <Link href="/workout/new" className="block">
          <Button
            size="lg"
            className="w-full h-[52px] text-[15.5px] font-extrabold tracking-tight"
          >
            + 운동 시작
          </Button>
        </Link>
      </div>
    </main>
  );
}
