// src/lib/queries/cardio.ts (서버 전용 — next/headers 의존)
import { createClient } from "@/lib/supabase/server";
import type { CardioLog } from "./cardio-types";

// 타입은 SessionRunner가 이 경로로 import (상수/CardioMachine은 cardio-types에서 직수입).
export type { CardioLog } from "./cardio-types";

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
