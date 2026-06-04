// src/app/(app)/history/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchSessionsInMonth,
  fetchTopExercises,
} from "@/lib/queries/sessions";
import { fetchUserExercises } from "@/lib/queries/exercises";
import { HistoryView } from "./HistoryView";

type PageProps = {
  searchParams: Promise<{ y?: string; m?: string }>;
};

export default async function HistoryPage({ searchParams }: PageProps) {
  const { y, m } = await searchParams;
  const today = new Date();

  const yearInput = y ? Number(y) : today.getFullYear();
  const monthInput = m !== undefined ? Number(m) : today.getMonth() + 1;

  // 범위 검증 — 잘못된 값은 오늘 달로 fallback
  const safeYear =
    Number.isFinite(yearInput) && yearInput >= 2000 && yearInput <= 2100
      ? yearInput
      : today.getFullYear();
  const safeMonth =
    Number.isFinite(monthInput) && monthInput >= 1 && monthInput <= 12
      ? monthInput
      : today.getMonth() + 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [monthSessions, topExercises, allExercises] = await Promise.all([
    fetchSessionsInMonth(user.id, safeYear, safeMonth),
    fetchTopExercises(user.id, 8),
    fetchUserExercises(user.id),
  ]);

  // 운동 추가 select용 경량 카탈로그 (이름순)
  const catalog = allExercises
    .map((e) => ({ id: e.id, name: e.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const isCurrentMonth =
    today.getMonth() + 1 === safeMonth && today.getFullYear() === safeYear;

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <HistoryView
        year={safeYear}
        month={safeMonth}
        todayDayOfMonth={isCurrentMonth ? today.getDate() : undefined}
        monthSessions={monthSessions}
        topExercises={topExercises}
        catalog={catalog}
      />
    </main>
  );
}
