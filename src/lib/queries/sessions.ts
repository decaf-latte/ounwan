// src/lib/queries/sessions.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";
import { getCategoryByCode } from "@/lib/workout/body-part-category";
import { mapSessionDetailRow } from "./session-detail-mapper";

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
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      workout_sets!inner (
        exercises!inner (
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
        exercise_body_parts: Array<{
          is_primary: boolean | null;
          body_parts: { code: string | null; color: string | null } | null;
        }>;
      };
    }>;
  };

  const byDay = new Map<number, MonthSessionEntry>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const day = new Date(row.started_at).getDate();
    if (!byDay.has(day)) {
      byDay.set(day, {
        dayOfMonth: day,
        sessionIds: [],
        bodyPartColors: [],
        categories: [],
      });
    }
    const entry = byDay.get(day)!;
    if (!entry.sessionIds.includes(row.id)) {
      entry.sessionIds.push(row.id);
    }
    for (const ws of row.workout_sets) {
      for (const ebp of ws.exercises.exercise_body_parts) {
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
  return Array.from(byDay.values()).sort(
    (a, b) => a.dayOfMonth - b.dayOfMonth,
  );
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

/**
 * 운동별 N주 진척 — ExerciseProgressDialog 차트용.
 * 세션 단위로 group: max 1RM, sum volume, max weight.
 * SQL not-null 필터로 NaN 차단.
 */
export async function fetchExerciseProgression(
  userId: string,
  exerciseId: string,
  weeksBack: number = 12,
): Promise<ProgressionPoint[]> {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - weeksBack * 7 * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      `
      weight_kg,
      reps,
      workout_sessions!inner ( id, user_id, started_at )
    `,
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .not("weight_kg", "is", null)
    .not("reps", "is", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    weight_kg: number | null;
    reps: number | null;
    workout_sessions: { id: string; user_id: string; started_at: string };
  };

  // 세션 단위 group
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
    // not-null 필터로 이미 걸렀지만 TS narrowing
    if (r.weight_kg != null && r.reps != null) {
      bySession.get(sid)!.sets.push({ w: r.weight_kg, r: r.reps });
    }
  }

  const points: ProgressionPoint[] = Array.from(bySession.values()).map(
    (sess) => {
      const oneRepMaxValues = sess.sets.map((s) => estimateOneRepMax(s.w, s.r));
      const volumes = sess.sets.map((s) => calcSetVolume(s.w, s.r));
      const weights = sess.sets.map((s) => s.w);
      return {
        date: sess.date,
        oneRepMax: Math.max(0, ...oneRepMaxValues),
        volume: volumes.reduce((sum, v) => sum + v, 0),
        maxWeight: Math.max(0, ...weights),
      };
    },
  );

  return points.sort((a, b) => (a.date < b.date ? -1 : 1));
}
