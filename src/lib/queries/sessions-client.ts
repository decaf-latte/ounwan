// src/lib/queries/sessions-client.ts
"use client";
import { createClient } from "@/lib/supabase/client";
import type { SessionDetail, ProgressionPoint } from "./sessions";
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";
import { mapSessionDetailRow } from "./session-detail-mapper";

/**
 * SessionDetailDialog용 — 브라우저 supabase client로 lazy fetch.
 * 본인 세션만 RLS로 노출. 서버 fetchSessionWithDetails와 같은 결과 shape.
 */
export async function fetchSessionWithDetailsClient(
  sessionId: string,
): Promise<SessionDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      ended_at,
      workout_sets (
        id,
        set_number,
        weight_kg,
        reps,
        parent_set_id,
        exercise_id,
        exercises (
          id,
          name,
          exercise_body_parts (
            body_parts ( id, name_ko, color )
          )
        )
      )
    `,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapSessionDetailRow(data);
}

export async function fetchExerciseProgressionClient(
  exerciseId: string,
  weeksBack: number = 12,
): Promise<ProgressionPoint[]> {
  const supabase = createClient();
  const cutoff = new Date(
    Date.now() - weeksBack * 7 * 86_400_000,
  ).toISOString();
  // 본인 user_id는 RLS가 자동 필터 (browser client + auth.uid())

  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      `
      weight_kg,
      reps,
      workout_sessions!inner ( id, started_at )
    `,
    )
    .eq("exercise_id", exerciseId)
    .is("parent_set_id", null)
    .not("weight_kg", "is", null)
    .not("reps", "is", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    weight_kg: number | null;
    reps: number | null;
    workout_sessions: { id: string; started_at: string };
  };

  const bySession = new Map<
    string,
    { date: string; sets: Array<{ w: number; r: number }> }
  >();
  for (const r of (data ?? []) as unknown as Row[]) {
    const sid = r.workout_sessions.id;
    if (!bySession.has(sid)) {
      bySession.set(sid, {
        date: r.workout_sessions.started_at,
        sets: [],
      });
    }
    if (r.weight_kg != null && r.reps != null) {
      bySession.get(sid)!.sets.push({ w: r.weight_kg, r: r.reps });
    }
  }

  return Array.from(bySession.values())
    .map((sess) => ({
      date: sess.date,
      oneRepMax: Math.max(0, ...sess.sets.map((s) => estimateOneRepMax(s.w, s.r))),
      volume: sess.sets.reduce((sum, s) => sum + calcSetVolume(s.w, s.r), 0),
      maxWeight: Math.max(0, ...sess.sets.map((s) => s.w)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
