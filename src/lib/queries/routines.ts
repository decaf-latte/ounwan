// 카톡 임포트 데이터에서 합성된 routine_label (overall_notes의 [...] prefix) 기준으로
// PT/개인운동 루틴을 그룹핑해서 보여주기.
// ADR-004: 라벨은 별도 컬럼 없이 overall_notes 앞부분에 "[라벨] 본문" 형식으로 들어있음.

import { createClient } from "@/lib/supabase/server";

export type RoutineExercise = {
  id: string;
  name: string;
  /** 이 운동이 등장한 세션 수 */
  occurrences: number;
};

export type RoutineSummary = {
  /** "Pt 상체 등", "개인운동 등" 등 */
  label: string;
  sessionCount: number;
  /** YYYY-MM-DD */
  lastDate: string;
  exercises: RoutineExercise[];
};

/** "unresolved" 같은 의미 없는 라벨은 제외 */
const SKIP_LABELS = new Set(["unresolved"]);

export async function fetchRoutines(userId: string): Promise<RoutineSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,
      overall_notes,
      workout_sets (
        exercise_id,
        exercises ( id, name )
      )
    `,
    )
    .eq("user_id", userId)
    .not("overall_notes", "is", null);

  if (error) throw error;

  type Row = {
    id: string;
    started_at: string;
    overall_notes: string | null;
    workout_sets: Array<{
      exercise_id: string;
      exercises: { id: string; name: string } | null;
    }>;
  };

  const byLabel = new Map<
    string,
    {
      sessions: Set<string>;
      lastDate: string;
      exercises: Map<string, { name: string; count: number }>;
    }
  >();

  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.overall_notes) continue;
    const m = row.overall_notes.match(/^\[([^\]]+)\]/);
    if (!m) continue;
    const label = m[1].trim();
    if (SKIP_LABELS.has(label)) continue;

    if (!byLabel.has(label)) {
      byLabel.set(label, {
        sessions: new Set(),
        lastDate: "",
        exercises: new Map(),
      });
    }
    const entry = byLabel.get(label)!;
    entry.sessions.add(row.id);
    if (row.started_at > entry.lastDate) entry.lastDate = row.started_at;

    // 한 세션 안에서 중복 운동은 1회로 카운트
    const seen = new Set<string>();
    for (const ws of row.workout_sets ?? []) {
      if (!ws.exercises) continue;
      if (seen.has(ws.exercise_id)) continue;
      seen.add(ws.exercise_id);
      const existing = entry.exercises.get(ws.exercise_id);
      entry.exercises.set(ws.exercise_id, {
        name: ws.exercises.name,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return [...byLabel.entries()]
    .map(([label, e]) => ({
      label,
      sessionCount: e.sessions.size,
      lastDate: e.lastDate.slice(0, 10),
      exercises: [...e.exercises.entries()]
        .map(([id, x]) => ({ id, name: x.name, occurrences: x.count }))
        .sort((a, b) => b.occurrences - a.occurrences),
    }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}
