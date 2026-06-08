import { createClient } from "@/lib/supabase/server";

export type WeightSlot = "morning" | "evening";

export type BodyWeightRow = {
  id: string;
  log_date: string; // YYYY-MM-DD
  slot: WeightSlot;
  weight_kg: number;
  recorded_at: string;
};

/** 캘린더 배지용 — 한달 치 가져옴 */
export async function fetchWeightsInMonth(
  userId: string,
  year: number,
  month: number,
): Promise<BodyWeightRow[]> {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  // 다음달 1일 (배타)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstOfNext = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_weights")
    .select("id, log_date, slot, weight_kg, recorded_at")
    .eq("user_id", userId)
    .gte("log_date", first)
    .lt("log_date", firstOfNext)
    .order("log_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BodyWeightRow[];
}

/** 추이 그래프용 — 최근 N일 (오늘 포함) */
export async function fetchRecentWeights(
  userId: string,
  days: number,
): Promise<BodyWeightRow[]> {
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_weights")
    .select("id, log_date, slot, weight_kg, recorded_at")
    .eq("user_id", userId)
    .gte("log_date", sinceStr)
    .order("log_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BodyWeightRow[];
}

/** 캘린더 셀에 표시할 대표 무게 (아침 우선, 없으면 저녁) */
export function pickRepresentativeWeight(
  rows: BodyWeightRow[],
): number | null {
  if (rows.length === 0) return null;
  const morning = rows.find((r) => r.slot === "morning");
  return (morning ?? rows[0]).weight_kg;
}
