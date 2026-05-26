// src/lib/queries/sessions.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

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
