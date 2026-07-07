// src/lib/queries/sessions.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { getCategoryByCode } from "@/lib/workout/body-part-category";
import {
  seoulTodayParts,
  seoulMidnightUtcIso,
  seoulDayOfMonth,
} from "@/lib/seoul-date";
import { mapSessionDetailRow } from "./session-detail-mapper";

export type WorkoutSession = Tables<"workout_sessions">;

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

  const { year, month, day } = seoulTodayParts();
  const todayStart = seoulMidnightUtcIso(year, month, day);
  const tomorrowStart = seoulMidnightUtcIso(year, month, day + 1);

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

export type RecentSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  /** unique 한국어 부위 이름 */
  bodyParts: string[];
  /** unique exercise_id 수 */
  exerciseCount: number;
  /** main set만 (parent_set_id IS NULL) */
  setCount: number;
  /** ended_at 있으면 분 단위, 없으면 null */
  durationMin: number | null;
};

/**
 * 최근 N주 세션 목록 — /history 페이지용.
 * workout_sets!inner 사용으로 세트 0개 세션은 의도적으로 제외.
 */
export async function fetchRecentSessions(
  userId: string,
  weeksBack: number = 4,
): Promise<RecentSession[]> {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - weeksBack * 7 * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      ended_at,
      workout_sets!inner (
        exercise_id,
        parent_set_id,
        exercises!inner (
          exercise_body_parts (
            body_parts ( name_ko )
          )
        )
      )
    `,
    )
    .eq("user_id", userId)
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false });

  if (error) throw error;

  type RecentSetRow = {
    exercise_id: string;
    parent_set_id: string | null;
    exercises: {
      exercise_body_parts: {
        body_parts: { name_ko: string } | null;
      }[];
    } | null;
  };

  return (data ?? []).map((row) => {
    const sets = (row.workout_sets ?? []) as RecentSetRow[];

    const exerciseIds = new Set<string>();
    const bodyPartNames = new Set<string>();
    let mainSetCount = 0;

    for (const s of sets) {
      exerciseIds.add(s.exercise_id);
      if (s.parent_set_id === null) mainSetCount += 1;
      for (const ebp of s.exercises?.exercise_body_parts ?? []) {
        if (ebp.body_parts?.name_ko) {
          bodyPartNames.add(ebp.body_parts.name_ko);
        }
      }
    }

    const durationMin =
      row.ended_at && row.started_at
        ? Math.round(
            (new Date(row.ended_at).getTime() -
              new Date(row.started_at).getTime()) /
              60_000,
          )
        : null;

    return {
      id: row.id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      bodyParts: Array.from(bodyPartNames),
      exerciseCount: exerciseIds.size,
      setCount: mainSetCount,
      durationMin,
    };
  });
}

export type MonthSessionEntry = {
  dayOfMonth: number;
  sessionIds: string[];
  bodyPartColors: string[];
  /** 상체/하체 카테고리. 한 세션이 둘 다 포함 시 둘 다 들어감. */
  categories: Array<"upper" | "lower">;
  /** 그날 수행한 unique 운동 (이름 오름차순) */
  exercises: Array<{ id: string; name: string }>;
};

/**
 * 특정 월의 세션 목록 — 캘린더 도트 + 리스트용.
 * @param month 1-indexed (1=Jan, 12=Dec). JS Date는 0-indexed라 내부에서 변환.
 * workout_sets!inner: 세트 0개 세션 제외 (Phase 3.6과 일관).
 * is_primary === true 만 도트로 표시.
 */
export async function fetchSessionsInMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthSessionEntry[]> {
  const supabase = await createClient();
  const start = seoulMidnightUtcIso(year, month, 1);
  const end = seoulMidnightUtcIso(year, month + 1, 1);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      workout_sets!inner (
        exercises!inner (
          id,
          name,
          exercise_body_parts (
            is_primary,
            body_parts ( code, color )
          )
        )
      )
    `,
    )
    .eq("user_id", userId)
    .gte("started_at", start)
    .lt("started_at", end);

  if (error) throw error;

  type Row = {
    id: string;
    started_at: string;
    workout_sets: Array<{
      exercises: {
        id: string;
        name: string;
        exercise_body_parts: Array<{
          is_primary: boolean | null;
          body_parts: { code: string | null; color: string | null } | null;
        }>;
      };
    }>;
  };

  const byDay = new Map<
    number,
    MonthSessionEntry & { exerciseMap: Map<string, string> }
  >();
  for (const row of (data ?? []) as unknown as Row[]) {
    const day = seoulDayOfMonth(row.started_at);
    if (!byDay.has(day)) {
      byDay.set(day, {
        dayOfMonth: day,
        sessionIds: [],
        bodyPartColors: [],
        categories: [],
        exercises: [],
        exerciseMap: new Map(),
      });
    }
    const entry = byDay.get(day)!;
    if (!entry.sessionIds.includes(row.id)) {
      entry.sessionIds.push(row.id);
    }
    for (const ws of row.workout_sets) {
      const ex = ws.exercises;
      if (ex && !entry.exerciseMap.has(ex.id)) {
        entry.exerciseMap.set(ex.id, ex.name);
      }
      for (const ebp of ex?.exercise_body_parts ?? []) {
        if (ebp.is_primary !== true || !ebp.body_parts) continue;
        const { code, color } = ebp.body_parts;
        if (color && !entry.bodyPartColors.includes(color)) {
          entry.bodyPartColors.push(color);
        }
        if (code) {
          const category = getCategoryByCode(code);
          if (!entry.categories.includes(category)) {
            entry.categories.push(category);
          }
        }
      }
    }
  }
  return Array.from(byDay.values())
    .map(({ exerciseMap, ...rest }) => ({
      ...rest,
      exercises: [...exerciseMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    }))
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);
}

export type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: Array<{ id: number; name_ko: string; color: string }>;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{
      id: string;
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      parent_set_id: string | null;
    }>;
  }>;
};

export async function fetchSessionWithDetails(
  sessionId: string,
): Promise<SessionDetail | null> {
  const supabase = await createClient();
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

export type TopExercise = {
  exerciseId: string;
  exerciseName: string;
  lastUsedAt: string;
  recentSetCount: number;
};

/**
 * 최근 12주 메인 세트 기준 자주 한 운동 N개 — ProgressLine 카드용.
 */
export async function fetchTopExercises(
  userId: string,
  limit: number = 8,
): Promise<TopExercise[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 12 * 7 * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      `
      exercise_id,
      created_at,
      exercises!inner ( id, name ),
      workout_sessions!inner ( user_id, started_at )
    `,
    )
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    exercise_id: string;
    created_at: string | null;
    exercises: { id: string; name: string };
    workout_sessions: { user_id: string; started_at: string };
  };

  const map = new Map<
    string,
    { name: string; count: number; lastUsedAt: string }
  >();
  for (const r of (data ?? []) as unknown as Row[]) {
    const cur = map.get(r.exercise_id);
    const ts = r.workout_sessions.started_at;
    if (!cur) {
      map.set(r.exercise_id, {
        name: r.exercises.name,
        count: 1,
        lastUsedAt: ts,
      });
    } else {
      cur.count += 1;
      if (ts > cur.lastUsedAt) cur.lastUsedAt = ts;
    }
  }

  return Array.from(map.entries())
    .map(([exerciseId, v]) => ({
      exerciseId,
      exerciseName: v.name,
      lastUsedAt: v.lastUsedAt,
      recentSetCount: v.count,
    }))
    .sort((a, b) => b.recentSetCount - a.recentSetCount)
    .slice(0, limit);
}

export type ProgressionPoint = {
  date: string; // ISO date string (그 날 첫 세션의 started_at)
  oneRepMax: number;
  volume: number;
  maxWeight: number;
};
