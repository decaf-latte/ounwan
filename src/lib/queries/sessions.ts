// src/lib/queries/sessions.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type WorkoutSession = Tables<"workout_sessions">;

export const sessionQueryKey = (sessionId: string) =>
  ["session", sessionId] as const;

export async function fetchSession(
  sessionId: string,
): Promise<WorkoutSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type TodaySession = WorkoutSession & {
  /** 오늘 한 운동 부위 (예: ["가슴", "어깨"]) — 중복 제거 */
  bodyParts: string[];
  /** 오늘 한 운동 수 */
  exerciseCount: number;
  /** 오늘 완료한 메인 세트 수 */
  mainSetCount: number;
};

/**
 * 오늘 (로컬 자정~자정) 시작된 사용자의 세션을 가져옴.
 * 없으면 null. 있으면 부위/운동수/세트수 요약 동봉.
 */
export async function fetchTodaySession(
  userId: string,
): Promise<TodaySession | null> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .select(
      "*, workout_sets(exercise_id, parent_set_id, exercises(exercise_body_parts(body_parts(name_ko))))",
    )
    .eq("user_id", userId)
    .gte("started_at", todayStart)
    .lt("started_at", tomorrowStart)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessErr) throw sessErr;
  if (!session) return null;

  const bodyPartSet = new Set<string>();
  const exerciseIds = new Set<string>();
  let mainSetCount = 0;

  type SetRow = {
    exercise_id: string;
    parent_set_id: string | null;
    exercises: {
      exercise_body_parts: { body_parts: { name_ko: string } | null }[];
    } | null;
  };

  for (const s of (session.workout_sets ?? []) as SetRow[]) {
    if (s.parent_set_id === null) mainSetCount += 1;
    exerciseIds.add(s.exercise_id);
    for (const m of s.exercises?.exercise_body_parts ?? []) {
      if (m.body_parts?.name_ko) bodyPartSet.add(m.body_parts.name_ko);
    }
  }

  return {
    ...session,
    bodyParts: [...bodyPartSet],
    exerciseCount: exerciseIds.size,
    mainSetCount,
  };
}

/**
 * 이번 주 (월 시작) 사용자가 운동한 요일 Set.
 * 0=월, 1=화, ..., 6=일.
 */
export async function fetchWeeklySessionDates(
  userId: string,
): Promise<Set<number>> {
  const supabase = await createClient();

  const now = new Date();
  // 월요일 시작 (한국 기본). JS getDay(): 0=일 6=토 → 월=1
  const dayOfWeek = (now.getDay() + 6) % 7; // 월=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .gte("started_at", monday.toISOString())
    .lt("started_at", nextMonday.toISOString());

  if (error) throw error;

  const set = new Set<number>();
  for (const row of data ?? []) {
    const d = new Date(row.started_at);
    set.add((d.getDay() + 6) % 7);
  }
  return set;
}
