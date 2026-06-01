"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StartSessionInput = {
  bodyPartIds: number[];
  recommendedExerciseIds: string[];
  templateId?: string | null;
};

export type StartSessionResult = { ok: false; error: string };

export async function startSession(
  input: StartSessionInput,
): Promise<StartSessionResult> {
  if (input.recommendedExerciseIds.length === 0) {
    return { ok: false, error: "추천 운동이 비어있습니다" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      routine_template_id: input.templateId ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("startSession failed", error);
    return { ok: false, error: "세션 생성 실패" };
  }

  const exParam = encodeURIComponent(input.recommendedExerciseIds.join(","));
  redirect(`/workout/${data.id}?exercises=${exParam}`);
}

export type SaveTemplateInput = {
  name: string;
  bodyPartIds: number[];
};

export type SaveTemplateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveTemplate(
  input: SaveTemplateInput,
): Promise<SaveTemplateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "템플릿 이름이 비어있습니다" };
  if (input.bodyPartIds.length === 0) {
    return { ok: false, error: "부위를 1개 이상 선택하세요" };
  }

  const { data: tpl, error: tplErr } = await supabase
    .from("routine_templates")
    .insert({
      user_id: user.id,
      name: trimmed,
    })
    .select("id")
    .single();
  if (tplErr || !tpl) {
    console.error("saveTemplate failed", tplErr);
    return { ok: false, error: "템플릿 저장 실패" };
  }

  const mappings = input.bodyPartIds.map((bp) => ({
    routine_template_id: tpl.id,
    body_part_id: bp,
  }));
  const { error: mapErr } = await supabase
    .from("routine_template_body_parts")
    .insert(mappings);
  if (mapErr) {
    console.error("saveTemplate mapping failed", mapErr);
    await supabase.from("routine_templates").delete().eq("id", tpl.id);
    return { ok: false, error: "템플릿 부위 매핑 실패" };
  }

  revalidatePath("/workout/new");
  return { ok: true, id: tpl.id };
}

export type FinishSessionResult = { ok: false; error: string };

export async function finishSession(
  sessionId: string,
): Promise<FinishSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("workout_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    console.error("finishSession failed", error);
    return { ok: false, error: "종료 실패" };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export type RemoveExerciseResult = { ok: false; error: string };

/**
 * 세션에서 운동 1개 제거.
 * 1. 해당 운동의 모든 세트 (drop set 포함) CASCADE 삭제
 * 2. URL의 ?exercises= 파라미터에서 해당 ID 제거 후 같은 페이지로 redirect
 */
export async function removeExerciseFromSession(input: {
  sessionId: string;
  exerciseId: string;
  remainingExerciseIds: string[]; // 클라가 알고 있는 현재 목록 - 삭제된 ID
}): Promise<RemoveExerciseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // session_id + exercise_id 조합으로 모든 세트 삭제
  // RLS는 workout_sets via session 정책으로 본인 데이터만 허용 — exercise_id 조건은 명시 안전장치
  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId);

  if (error) {
    console.error("removeExerciseFromSession failed", error);
    return { ok: false, error: "운동 삭제 실패" };
  }

  if (input.remainingExerciseIds.length === 0) {
    // 더 이상 운동 없음 → 대시보드로
    redirect("/dashboard");
  }

  const exParam = encodeURIComponent(input.remainingExerciseIds.join(","));
  redirect(`/workout/${input.sessionId}?exercises=${exParam}`);
}
