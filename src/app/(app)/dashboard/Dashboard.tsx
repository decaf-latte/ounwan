"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Check,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SessionDetailDialog } from "@/components/workout/SessionDetailDialog";
import { signOut } from "@/app/(app)/dashboard/actions";
import { WeightFab } from "@/components/weight/WeightEntryDialog";
import type { TodaySession } from "@/lib/queries/sessions";
import type { RecentExercise } from "@/lib/queries/sets";
import type { BodyWeightRow } from "@/lib/queries/body-weights";
import type { ChallengeProgress } from "@/lib/queries/challenges";

const EXERCISE_GOAL = 8;

type Props = {
  todaySession: TodaySession | null;
  year: number;
  /** 1-indexed */
  month: number;
  dotsByDate: Record<number, DayEntry>;
  weightByDate: Record<number, { morning?: number; evening?: number }>;
  todayWeights: BodyWeightRow[];
  todayDateIso: string;
  recentExercises: RecentExercise[];
  catalog: Array<{ id: string; name: string }>;
  activeChallenges: ChallengeProgress[];
  /** 현재 보고 있는 달이 오늘이 속한 달일 때만 설정 */
  todayDayOfMonth?: number;
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
  catalog,
  activeChallenges,
  todayDayOfMonth,
  todayDayLabel,
  todayFormatted,
}: Props) {
  const router = useRouter();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const handleDateClick = (_day: number, entry?: DayEntry) => {
    if (entry && entry.sessionIds[0]) {
      setSelectedSessionId(entry.sessionIds[0]);
    } else {
      router.push("/workout/new");
    }
  };

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
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard?vy=${month === 1 ? year - 1 : year}&vm=${month === 1 ? 12 : month - 1}`}
              aria-label="이전 달"
              className="p-1 -ml-1 text-text-muted hover:text-text"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <MonoLabel>
              {year} / {String(month).padStart(2, "0")}
            </MonoLabel>
            <Link
              href={`/dashboard?vy=${month === 12 ? year + 1 : year}&vm=${month === 12 ? 1 : month + 1}`}
              aria-label="다음 달"
              className="p-1 text-text-muted hover:text-text"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
            {todayDayOfMonth === undefined && (
              <Link
                href="/dashboard"
                className="ml-1 text-caption text-accent hover:underline"
              >
                오늘로
              </Link>
            )}
          </div>
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
          onDateClick={handleDateClick}
        />
      </section>

      {/* ── 진행 중 챌린지 ── */}
      {activeChallenges.length > 0 && (
        <>
          <div className="mt-5">
            <Rule />
          </div>
          <section className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <MonoLabel>진행 중 챌린지</MonoLabel>
              <Link
                href="/challenges"
                className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>전체 관리</span>
              </Link>
            </div>
            <ul className="space-y-2">
              {activeChallenges.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/challenges/${c.id}`}
                    className="block rounded-lg border border-border bg-surface p-3 hover:bg-accent-soft transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-body font-semibold text-text truncate">
                        {c.name}
                      </span>
                      <span className="text-caption font-mono text-text-muted shrink-0">
                        {c.completedDays}/{c.target_days}일
                        {c.doneToday && (
                          <span className="ml-1 text-accent">✓</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-line2 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-[width]"
                        style={{
                          width: `${Math.min(100, (c.completedDays / c.target_days) * 100)}%`,
                          background: c.onTrack
                            ? "var(--accent)"
                            : "var(--danger)",
                        }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

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

      <SessionDetailDialog
        sessionId={selectedSessionId}
        catalog={catalog}
        onClose={() => setSelectedSessionId(null)}
      />

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
