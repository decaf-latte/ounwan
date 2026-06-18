// 챌린지 — N일 도전. 운동 세션과 독립적으로 매일 수동 로그.
// 연속(streak) 우선 + 누적 휴식일 허용.

import { createClient } from "@/lib/supabase/server";
import { seoulTodayIso } from "@/lib/seoul-date";

export type Challenge = {
  id: string;
  name: string;
  target_days: number;
  rest_days_allowed: number;
  start_date: string;
  ended_at: string | null;
  created_at: string;
};

export type ChallengeProgress = Challenge & {
  /** 로그된 날짜들 (YYYY-MM-DD, 오름차순) */
  logDates: string[];
  /** 시작일 이후 완료 일수 */
  completedDays: number;
  /** 시작일~오늘 사이 경과 일수 (오늘 포함) */
  elapsedDays: number;
  /** 빠진 날 수 = elapsedDays - completedDays */
  missedDays: number;
  /** missed가 허용 휴식일을 넘었으면 false */
  onTrack: boolean;
  /** 오늘 로그 체크됐는가 */
  doneToday: boolean;
  /** 현재 streak (오늘 또는 어제부터 거꾸로 연속 일수, 휴식일 허용 고려 X — pure consecutive) */
  currentStreak: number;
};

function daysBetween(startIso: string, endIso: string): number {
  // YYYY-MM-DD 끼리만 받음. UTC로 파싱해도 결과 동일 (둘 다 같은 KST 자정 매핑).
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  return Math.floor((e.getTime() - s.getTime()) / 86_400_000);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeStreak(logDates: Set<string>, today: string): number {
  // 오늘이 있으면 오늘부터, 없으면 어제부터 거꾸로 연속 일수
  let cursor = logDates.has(today) ? today : addDays(today, -1);
  if (!logDates.has(cursor)) return 0;
  let streak = 0;
  while (logDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function fetchActiveChallenges(
  userId: string,
): Promise<ChallengeProgress[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("challenges")
    .select("*, challenge_logs(log_date)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = Challenge & {
    challenge_logs: Array<{ log_date: string }>;
  };

  const today = seoulTodayIso();
  return ((rows ?? []) as unknown as Row[]).map((r) => {
    const logDates = (r.challenge_logs ?? [])
      .map((l) => l.log_date)
      .sort();
    const logSet = new Set(logDates);
    const completedDays = logDates.filter((d) => d >= r.start_date).length;
    const elapsedDays = Math.max(0, daysBetween(r.start_date, today) + 1);
    const missedDays = Math.max(0, elapsedDays - completedDays);
    const onTrack = missedDays <= r.rest_days_allowed;
    return {
      id: r.id,
      name: r.name,
      target_days: r.target_days,
      rest_days_allowed: r.rest_days_allowed,
      start_date: r.start_date,
      ended_at: r.ended_at,
      created_at: r.created_at,
      logDates,
      completedDays,
      elapsedDays,
      missedDays,
      onTrack,
      doneToday: logSet.has(today),
      currentStreak: computeStreak(logSet, today),
    };
  });
}

export async function fetchChallengeById(
  userId: string,
  challengeId: string,
): Promise<ChallengeProgress | null> {
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("challenges")
    .select("*, challenge_logs(log_date)")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!r) return null;

  type Row = Challenge & { challenge_logs: Array<{ log_date: string }> };
  const row = r as unknown as Row;
  const logDates = (row.challenge_logs ?? []).map((l) => l.log_date).sort();
  const logSet = new Set(logDates);
  const today = seoulTodayIso();
  const completedDays = logDates.filter((d) => d >= row.start_date).length;
  const elapsedDays = Math.max(0, daysBetween(row.start_date, today) + 1);
  const missedDays = Math.max(0, elapsedDays - completedDays);
  return {
    id: row.id,
    name: row.name,
    target_days: row.target_days,
    rest_days_allowed: row.rest_days_allowed,
    start_date: row.start_date,
    ended_at: row.ended_at,
    created_at: row.created_at,
    logDates,
    completedDays,
    elapsedDays,
    missedDays,
    onTrack: missedDays <= row.rest_days_allowed,
    doneToday: logSet.has(today),
    currentStreak: computeStreak(logSet, today),
  };
}
