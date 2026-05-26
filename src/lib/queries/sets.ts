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
