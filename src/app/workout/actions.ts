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
