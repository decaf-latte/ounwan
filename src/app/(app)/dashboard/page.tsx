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
import { Dashboard } from "./Dashboard";
import type { DayEntry } from "@/components/ui/mini-calendar";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { year, month, day: todayDay, dayOfWeek } = seoulTodayParts();

  const [
    todaySession,
    monthSessions,
    recentExercises,
    monthWeights,
    allExercises,
  ] = await Promise.all([
    fetchTodaySession(user.id),
    fetchSessionsInMonth(user.id, year, month),
    fetchRecentExerciseHistory(user.id, 2),
    fetchWeightsInMonth(user.id, year, month),
    fetchUserExercises(user.id),
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
  const todayWeights = monthWeights.filter((w) => w.log_date === todayDateIso);

  const todayDayLabel = DAY_LABELS[dayOfWeek];
  const todayFormatted = `${month}월 ${todayDay}일`;

  return (
    <Dashboard
      todaySession={todaySession}
      year={year}
      month={month}
      todayDayOfMonth={todayDay}
      dotsByDate={dotsByDate}
      weightByDate={weightByDate}
      todayWeights={todayWeights}
      todayDateIso={todayDateIso}
      recentExercises={recentExercises}
      catalog={catalog}
      todayDayLabel={todayDayLabel}
      todayFormatted={todayFormatted}
    />
  );
}
