"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { seoulTodayIso } from "@/lib/seoul-date";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateChallengeInput = {
  name: string;
  targetDays: number;
  restDaysAllowed: number;
};

export async function createChallenge(
  input: CreateChallengeInput,
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "이름을 입력하세요" };
  if (name.length > 60) return { ok: false, error: "이름이 너무 길어요 (60자 이하)" };
  if (!Number.isInteger(input.targetDays) || input.targetDays < 1 || input.targetDays > 365) {
    return { ok: false, error: "목표일은 1~365 사이" };
  }
  if (!Number.isInteger(input.restDaysAllowed) || input.restDaysAllowed < 0 || input.restDaysAllowed >= input.targetDays) {
    return { ok: false, error: "허용 휴식일은 0~목표일-1 사이" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("challenges").insert({
    user_id: user.id,
    name,
    target_days: input.targetDays,
    rest_days_allowed: input.restDaysAllowed,
    start_date: seoulTodayIso(),
  });
  if (error) {
    console.error("createChallenge failed", error);
    return { ok: false, error: "챌린지 생성 실패" };
  }

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 오늘 로그 토글 — 이미 있으면 삭제, 없으면 추가 */
export async function toggleChallengeToday(
  challengeId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 본인 챌린지 확인
  const { data: ch } = await supabase
    .from("challenges")
    .select("id")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ch) return { ok: false, error: "챌린지를 찾을 수 없어요" };

  const today = seoulTodayIso();
  const { data: existing } = await supabase
    .from("challenge_logs")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("log_date", today)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("challenge_logs")
      .delete()
      .eq("id", existing.id);
    if (error) {
      console.error("unmark failed", error);
      return { ok: false, error: "취소 실패" };
    }
  } else {
    const { error } = await supabase.from("challenge_logs").insert({
      challenge_id: challengeId,
      log_date: today,
    });
    if (error) {
      console.error("mark failed", error);
      return { ok: false, error: "체크 실패" };
    }
  }

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function endChallenge(
  challengeId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("challenges")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", challengeId)
    .eq("user_id", user.id);
  if (error) {
    console.error("endChallenge failed", error);
    return { ok: false, error: "종료 실패" };
  }
  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteChallenge(
  challengeId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("challenges")
    .delete()
    .eq("id", challengeId)
    .eq("user_id", user.id);
  if (error) {
    console.error("deleteChallenge failed", error);
    return { ok: false, error: "삭제 실패" };
  }
  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  return { ok: true };
}
