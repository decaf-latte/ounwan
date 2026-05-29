// src/lib/queries/sets.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/types/database.types";

export type WorkoutSet = Tables<"workout_sets">;
export type WorkoutSetInsert = TablesInsert<"workout_sets">;

/** 추천 알고리즘이 쓰는 최소 형태 */
export type RecentSetSummary = {
  exercise_id: string;
  created_at: string;
};

export const setsQueryKey = (sessionId: string) =>
  ["sets", sessionId] as const;

export async function fetchSessionSets(
  sessionId: string,
): Promise<WorkoutSet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("exercise_id", { ascending: true })
    .order("set_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * 본인의 최근 N일 메인 세트만 (드롭 제외, 추천 알고리즘용).
 * workout_sessions!inner JOIN으로 user_id 필터 + RLS 격리.
 */
export async function fetchRecentSets(
  userId: string,
  daysBack: number,
): Promise<RecentSetSummary[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("exercise_id, created_at, workout_sessions!inner(user_id)")
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .gte("created_at", cutoff);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    exercise_id: r.exercise_id,
    created_at: r.created_at ?? new Date(0).toISOString(),
  }));
}

export type RecentExercise = {
  exerciseId: string;
  exerciseName: string;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastDoneAt: string;
};

/**
 * 사용자가 최근에 한 N개 운동의 가장 최근 메인 세트.
 * 운동별로 1개씩 (중복 운동은 가장 최근 1개만).
 */
export async function fetchRecentExerciseHistory(
  userId: string,
  limit: number,
): Promise<RecentExercise[]> {
  const supabase = await createClient();

  // 최근 100개 메인 세트 (over-fetch 후 클라 dedupe)
  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id, weight_kg, reps, created_at, exercises!inner(name, user_id)",
    )
    .eq("exercises.user_id", userId)
    .is("parent_set_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const seen = new Set<string>();
  const out: RecentExercise[] = [];

  type Row = {
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    created_at: string | null;
    exercises: { name: string; user_id: string } | null;
  };

  for (const r of (data ?? []) as Row[]) {
    if (seen.has(r.exercise_id)) continue;
    if (!r.exercises) continue;
    seen.add(r.exercise_id);
    out.push({
      exerciseId: r.exercise_id,
      exerciseName: r.exercises.name,
      lastWeightKg: r.weight_kg,
      lastReps: r.reps,
      lastDoneAt: r.created_at ?? new Date(0).toISOString(),
    });
    if (out.length >= limit) break;
  }

  return out;
}

export type LastMainSet = {
  weightKg: number | null;
  reps: number | null;
};

/**
 * 주어진 exerciseIds 각각에 대해 가장 최근 메인 세트(parent_set_id IS NULL)를 가져옴.
 * 결과는 exerciseId → { weightKg, reps } 매핑. 기록 없으면 매핑에 키 자체 없음.
 *
 * 사용처: 운동 진행 화면 진입 시 SetRow의 input default 값.
 */
export async function fetchLastMainSetsByExercise(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, LastMainSet>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();

  // 한 번의 query로 over-fetch 후 클라에서 운동별 dedupe (최신 1개만)
  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id, weight_kg, reps, created_at, workout_sessions!inner(user_id)",
    )
    .eq("workout_sessions.user_id", userId)
    .in("exercise_id", exerciseIds)
    .is("parent_set_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  type Row = {
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    created_at: string | null;
  };

  const out: Record<string, LastMainSet> = {};
  for (const r of (data ?? []) as Row[]) {
    if (out[r.exercise_id]) continue; // 이미 더 최신 (order DESC)
    out[r.exercise_id] = { weightKg: r.weight_kg, reps: r.reps };
  }
  return out;
}
