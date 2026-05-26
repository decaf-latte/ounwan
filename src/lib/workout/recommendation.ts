// src/lib/workout/recommendation.ts
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { RecentSetSummary } from "@/lib/queries/sets";

export type Recommendation = {
  exerciseId: string;
  primaryBodyPartId: number;
  lastUsedAt: string | null;
  recentUsageCount: number;
};

export type RecommendInput = {
  bodyPartIds: number[];
  exercises: ExerciseWithBodyParts[];
  recentSets: RecentSetSummary[];
  perBodyPart?: number;
};

export function recommendExercises({
  bodyPartIds,
  exercises,
  recentSets,
  perBodyPart = 3,
}: RecommendInput): Recommendation[] {
  // 1) 후보 필터: 선택 부위 중 하나라도 primary로 매칭되는 운동
  const candidates = exercises
    .map((ex) => {
      const primaryBP = ex.exercise_body_parts.find(
        (m) => m.is_primary && bodyPartIds.includes(m.body_part_id),
      );
      return primaryBP ? { ex, primaryBP: primaryBP.body_part_id } : null;
    })
    .filter((x): x is { ex: ExerciseWithBodyParts; primaryBP: number } => !!x);

  // 2) 운동별 사용 통계 (최근 30일)
  const THIRTY_DAYS_AGO = Date.now() - 30 * 86_400_000;
  const stats = new Map<
    string,
    { recentCount: number; lastUsedAt: string | null }
  >();
  for (const s of recentSets) {
    const ts = new Date(s.created_at).getTime();
    if (ts < THIRTY_DAYS_AGO) continue;
    const prev = stats.get(s.exercise_id) ?? {
      recentCount: 0,
      lastUsedAt: null,
    };
    prev.recentCount += 1;
    if (!prev.lastUsedAt || s.created_at > prev.lastUsedAt) {
      prev.lastUsedAt = s.created_at;
    }
    stats.set(s.exercise_id, prev);
  }

  // 3) 부위별 그룹핑 + 정렬
  const grouped = new Map<number, typeof candidates>();
  for (const c of candidates) {
    const arr = grouped.get(c.primaryBP) ?? [];
    arr.push(c);
    grouped.set(c.primaryBP, arr);
  }

  const out: Recommendation[] = [];
  for (const bpId of bodyPartIds) {
    const arr = grouped.get(bpId) ?? [];
    arr.sort((a, b) => {
      const sa = stats.get(a.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      const sb = stats.get(b.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      // 1순위 desc
      if (sa.recentCount !== sb.recentCount) {
        return sb.recentCount - sa.recentCount;
      }
      // 2순위 asc (오래된 것이 위로) — null은 가장 오래된 것으로 간주
      const la = sa.lastUsedAt ?? "0";
      const lb = sb.lastUsedAt ?? "0";
      if (la !== lb) return la < lb ? -1 : 1;
      // 3순위 (deterministic)
      const ca = a.ex.created_at ?? "0";
      const cb = b.ex.created_at ?? "0";
      return ca < cb ? -1 : 1;
    });
    for (const c of arr.slice(0, perBodyPart)) {
      const s = stats.get(c.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      out.push({
        exerciseId: c.ex.id,
        primaryBodyPartId: c.primaryBP,
        lastUsedAt: s.lastUsedAt,
        recentUsageCount: s.recentCount,
      });
    }
  }
  return out;
}
