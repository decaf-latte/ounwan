// src/lib/queries/cardio.ts (서버 전용 — next/headers 의존)
import { createClient } from "@/lib/supabase/server";
import type { CardioLog } from "./cardio-types";

// 타입/상수는 cardio-types.ts에 있음 (클라이언트 안전).
export type { CardioLog, CardioMachine } from "./cardio-types";
export { CARDIO_MACHINES } from "./cardio-types";

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
