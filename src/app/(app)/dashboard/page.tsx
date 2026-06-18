import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  fetchTodaySession,
  fetchSessionsInMonth,
} from "@/lib/queries/sessions";
import { fetchRecentExerciseHistory } from "@/lib/queries/sets";
import { fetchUserExercises } from "@/lib/queries/exercises";
import { seoulTodayParts, seoulTodayIso } from "@/lib/seoul-date";
import { fetchWeightsInMonth } from "@/lib/queries/body-weights";
import { fetchActiveChallenges } from "@/lib/queries/challenges";
import { Dashboard } from "./Dashboard";
import type { DayEntry } from "@/components/ui/mini-calendar";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

type PageProps = {
  searchParams: Promise<{ vy?: string; vm?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { vy, vm } = await searchParams;
  const {
    year: todayYear,
    month: todayMonth,
    day: todayDay,
    dayOfWeek,
  } = seoulTodayParts();

  // 캘린더 표시용 (view) 월. 파라미터 없으면 오늘 달.
  const vyNum = vy ? Number(vy) : todayYear;
  const vmNum = vm ? Number(vm) : todayMonth;
  const viewYear =
    Number.isFinite(vyNum) && vyNum >= 2000 && vyNum <= 2100
      ? vyNum
      : todayYear;
  const viewMonth =
    Number.isFinite(vmNum) && vmNum >= 1 && vmNum <= 12 ? vmNum : todayMonth;
  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;

  const [
    todaySession,
    monthSessions,
    recentExercises,
    monthWeights,
    allExercises,
    activeChallenges,
  ] = await Promise.all([
    fetchTodaySession(user.id),
    fetchSessionsInMonth(user.id, viewYear, viewMonth),
    fetchRecentExerciseHistory(user.id, 2),
    fetchWeightsInMonth(user.id, viewYear, viewMonth),
    fetchUserExercises(user.id),
    fetchActiveChallenges(user.id),
  ]);

  const catalog = allExercises
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const dotsByDate: Record<number, DayEntry> = Object.fromEntries(
    monthSessions.map((e) => [
      e.dayOfMonth,
      {
        bodyPartColors: e.bodyPartColors,
        sessionIds: e.sessionIds,
        categories: e.categories,
      },
    ]),
  );

  const weightByDate: Record<
    number,
    { morning?: number; evening?: number }
  > = {};
  for (const w of monthWeights) {
    const day = Number(w.log_date.slice(8, 10));
    if (!weightByDate[day]) weightByDate[day] = {};
    if (w.slot === "morning") weightByDate[day].morning = w.weight_kg;
    else if (w.slot === "evening") weightByDate[day].evening = w.weight_kg;
  }

  const todayDateIso = seoulTodayIso();
  // 다른 달을 보고 있어도 FAB 다이얼로그에 오늘 기록이 노출되어야 하므로
  // current month 아니면 오늘 달 weights를 별도 조회.
  const todayWeightsSource = isCurrentMonth
    ? monthWeights
    : await fetchWeightsInMonth(user.id, todayYear, todayMonth);
  const todayWeights = todayWeightsSource.filter(
    (w) => w.log_date === todayDateIso,
  );

  const todayDayLabel = DAY_LABELS[dayOfWeek];
  const todayFormatted = `${todayMonth}월 ${todayDay}일`;

  return (
    <Dashboard
      todaySession={todaySession}
      year={viewYear}
      month={viewMonth}
      todayDayOfMonth={isCurrentMonth ? todayDay : undefined}
      dotsByDate={dotsByDate}
      weightByDate={weightByDate}
      todayWeights={todayWeights}
      todayDateIso={todayDateIso}
      recentExercises={recentExercises}
      catalog={catalog}
      activeChallenges={activeChallenges.slice(0, 2)}
      todayDayLabel={todayDayLabel}
      todayFormatted={todayFormatted}
    />
  );
}
