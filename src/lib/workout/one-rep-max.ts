// src/lib/workout/one-rep-max.ts
/**
 * Epley 1RM 추정. weight 또는 reps가 null/0/음수면 0 반환.
 * weight_kg / reps 컬럼이 nullable이므로 null 가드 필수.
 */
export function estimateOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number {
  if (weight == null || reps == null) return 0;
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley: weight × (1 + reps/30)
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calcSetVolume(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number {
  if (weight == null || reps == null) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}
