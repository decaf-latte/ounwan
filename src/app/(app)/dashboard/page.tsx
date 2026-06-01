import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  fetchTodaySession,
  fetchSessionsInMonth,
} from "@/lib/queries/sessions";
import { fetchRecentExerciseHistory } from "@/lib/queries/sets";
import { Dashboard } from "./Dashboard";
import type { DayEntry } from "@/components/ui/mini-calendar";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-indexed

  const [todaySession, monthSessions, recentExercises] = await Promise.all([
    fetchTodaySession(user.id),
    fetchSessionsInMonth(user.id, year, month),
    fetchRecentExerciseHistory(user.id, 2),
  ]);

  const dotsByDate: Record<number, DayEntry> = Object.fromEntries(
    monthSessions.map((e) => [
      e.dayOfMonth,
      { bodyPartColors: e.bodyPartColors, sessionIds: e.sessionIds },
    ]),
  );

  const todayDayIdx = (today.getDay() + 6) % 7; // 월=0...일=6
  const todayDayLabel = DAY_LABELS[todayDayIdx];
  const todayFormatted = `${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <Dashboard
      todaySession={todaySession}
      year={year}
      month={month}
      todayDayOfMonth={today.getDate()}
      dotsByDate={dotsByDate}
      recentExercises={recentExercises}
      todayDayLabel={todayDayLabel}
      todayFormatted={todayFormatted}
    />
  );
}
