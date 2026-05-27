// src/lib/queries/exercises.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Exercise = Tables<"exercises">;
export type ExerciseBodyPart = Tables<"exercise_body_parts">;
export type ExerciseWithBodyParts = Exercise & {
  exercise_body_parts: ExerciseBodyPart[];
};

export const exercisesQueryKey = (userId: string) =>
  ["exercises", userId] as const;

/** RSC fetch — 본인 운동 + body_part 매핑 일괄 */
export async function fetchUserExercises(
  userId: string,
): Promise<ExerciseWithBodyParts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*, exercise_body_parts(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExerciseWithBodyParts[];
}
