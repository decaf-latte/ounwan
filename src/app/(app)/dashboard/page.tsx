import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  fetchTodaySession,
  fetchWeeklySessionDates,
} from "@/lib/queries/sessions";
import { fetchRecentExerciseHistory } from "@/lib/queries/sets";
import { Dashboard } from "./Dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [todaySession, weeklyDates, recentExercises] = await Promise.all([
    fetchTodaySession(user.id),
    fetchWeeklySessionDates(user.id),
    fetchRecentExerciseHistory(user.id, 2),
  ]);

  const now = new Date();
  const todayDayIndex = (now.getDay() + 6) % 7; // 월=0

  return (
    <Dashboard
      todaySession={todaySession}
      weeklyDates={Array.from(weeklyDates)}
      recentExercises={recentExercises}
      todayDayIndex={todayDayIndex}
    />
  );
}
