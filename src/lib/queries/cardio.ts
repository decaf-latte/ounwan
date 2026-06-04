// src/lib/queries/cardio.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type CardioLog = Tables<"cardio_logs">;

/** 유산소 머신 (UI 3택1). text 컬럼이라 값 자유지만 표준 3종. */
export const CARDIO_MACHINES = ["천국의계단", "인클라인", "러닝머신"] as const;
export type CardioMachine = (typeof CARDIO_MACHINES)[number];

/** RSC — 세션의 유산소 기록 */
export async function fetchSessionCardio(
  sessionId: string,
): Promise<CardioLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cardio_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
