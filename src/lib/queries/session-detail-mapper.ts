// src/lib/queries/session-detail-mapper.ts
// 순수 매핑 함수 — 서버(sessions.ts)와 클라(sessions-client.ts) 양쪽에서 공유.
// createClient 등 환경 종속 import 없음 → "use server"/"use client" 양쪽 안전.
import type { SessionDetail } from "./sessions";

type SessionDetailRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  workout_sets: Array<{
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    parent_set_id: string | null;
    exercise_id: string;
    exercises: {
      id: string;
      name: string;
      exercise_body_parts: Array<{
        body_parts: { id: number; name_ko: string; color: string } | null;
      }>;
    };
  }>;
};

/**
 * workout_sessions + 중첩 join 결과(maybeSingle data)를 SessionDetail로 변환.
 * - 메인 세트만 (parent_set_id IS NULL)
 * - 운동별 group, 세트는 set_number 오름차순
 * - 부위는 id 기준 dedup
 */
export function mapSessionDetailRow(data: unknown): SessionDetail {
  const row = data as SessionDetailRow;
  const mainSets = row.workout_sets.filter((s) => s.parent_set_id === null);

  const exerciseMap = new Map<
    string,
    { id: string; name: string; sets: SessionDetail["exercises"][number]["sets"] }
  >();
  const bodyPartMap = new Map<
    number,
    { id: number; name_ko: string; color: string }
  >();

  for (const s of mainSets) {
    const ex = s.exercises;
    if (!exerciseMap.has(ex.id)) {
      exerciseMap.set(ex.id, { id: ex.id, name: ex.name, sets: [] });
    }
    exerciseMap.get(ex.id)!.sets.push({
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      parent_set_id: s.parent_set_id,
    });
    for (const ebp of ex.exercise_body_parts) {
      if (ebp.body_parts && !bodyPartMap.has(ebp.body_parts.id)) {
        bodyPartMap.set(ebp.body_parts.id, ebp.body_parts);
      }
    }
  }

  for (const ex of exerciseMap.values()) {
    ex.sets.sort((a, b) => a.set_number - b.set_number);
  }

  return {
    id: row.id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    bodyParts: Array.from(bodyPartMap.values()),
    exercises: Array.from(exerciseMap.values()),
  };
}
