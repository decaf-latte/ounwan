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
      // 계획된 운동 목록을 DB에 저장 → 세트 입력 전이라도 복귀 시 복원
      planned_exercise_ids: input.recommendedExerciseIds,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("startSession failed", error);
    return { ok: false, error: "세션 생성 실패" };
  }

  redirect(`/workout/${data.id}`);
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
  revalidatePath("/history");
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

  // 계획 목록도 동기화 (세트 0개여도 복원되던 운동이 다시 안 뜨도록)
  await supabase
    .from("workout_sessions")
    .update({ planned_exercise_ids: input.remainingExerciseIds })
    .eq("id", input.sessionId)
    .eq("user_id", user.id);

  if (input.remainingExerciseIds.length === 0) {
    // 더 이상 운동 없음 → 대시보드로
    redirect("/dashboard");
  }

  redirect(`/workout/${input.sessionId}`);
}

/**
 * 진행 중 세션에 한쪽씩(왼쪽/오른쪽) 변형 운동 카드 추가.
 * 1. exercises에 동일 user_id × parent_exercise_id × "X (왼쪽/오른쪽)" 이미 있으면 재사용
 * 2. 없으면 새로 생성 (parent의 default_sets/reps 복사)
 * 3. 세션 planned_exercise_ids 에 append (이미 들어있으면 no-op)
 */
export async function addSidedVariantToSession(input: {
  sessionId: string;
  parentExerciseId: string;
  side: "left" | "right";
}): Promise<
  { ok: true; variantId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const { data: parent, error: pErr } = await supabase
    .from("exercises")
    .select(
      "id, name, default_sets, default_reps_min, default_reps_max, equipment, is_unilateral, notes",
    )
    .eq("id", input.parentExerciseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr || !parent) {
    return { ok: false, error: "원본 운동을 찾을 수 없습니다" };
  }

  const sideLabel = input.side === "left" ? "왼쪽" : "오른쪽";
  const variantName = `${parent.name} (${sideLabel})`;

  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", user.id)
    .eq("parent_exercise_id", input.parentExerciseId)
    .eq("name", variantName)
    .maybeSingle();

  let variantId: string;
  if (existing) {
    variantId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("exercises")
      .insert({
        user_id: user.id,
        name: variantName,
        parent_exercise_id: input.parentExerciseId,
        default_sets: parent.default_sets,
        default_reps_min: parent.default_reps_min,
        default_reps_max: parent.default_reps_max,
        equipment: parent.equipment,
        is_unilateral: true,
        notes: parent.notes,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("create variant failed", error);
      return { ok: false, error: "변형 운동 생성 실패" };
    }
    variantId = created.id;
  }

  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .select("planned_exercise_ids")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sErr || !session) {
    return { ok: false, error: "세션을 찾을 수 없습니다" };
  }

  const planned = session.planned_exercise_ids ?? [];
  if (!planned.includes(variantId)) {
    const { error: upErr } = await supabase
      .from("workout_sessions")
      .update({ planned_exercise_ids: [...planned, variantId] })
      .eq("id", input.sessionId)
      .eq("user_id", user.id);
    if (upErr) {
      console.error("planned append failed", upErr);
      return { ok: false, error: "세션에 추가 실패" };
    }
  }

  return { ok: true, variantId };
}

/**
 * 진행 중 세션에 운동 1개 추가 — planned_exercise_ids 에 append.
 * 이미 들어있으면 no-op.
 */
export async function addExerciseToSession(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .select("planned_exercise_ids")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sErr || !session) return { ok: false, error: "세션을 찾을 수 없습니다" };

  const planned = session.planned_exercise_ids ?? [];
  if (planned.includes(input.exerciseId)) return { ok: true };

  const { error } = await supabase
    .from("workout_sessions")
    .update({ planned_exercise_ids: [...planned, input.exerciseId] })
    .eq("id", input.sessionId)
    .eq("user_id", user.id);

  if (error) {
    console.error("addExerciseToSession failed", error);
    return { ok: false, error: "운동 추가 실패" };
  }
  return { ok: true };
}

// ── 기록 삭제 (종료된 세션 — /history 세션 상세 모달용) ───────────────
// redirect 없음. 모달에서 결과 받아 캐시 무효화 + router.refresh.

export type DeleteResult = { ok: true } | { ok: false; error: string };

/** 세션 전체 삭제 — workout_sets는 FK CASCADE로 함께 삭제됨. */
export async function deleteSession(sessionId: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id); // RLS도 막지만 명시 안전장치

  if (error) {
    console.error("deleteSession failed", error);
    return { ok: false, error: "세션 삭제 실패" };
  }

  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 종료된 세션에서 운동 1개 삭제 (해당 운동의 모든 세트). */
export async function deleteSessionExercise(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  // 본인 세션인지 확인 (RLS도 막지만 명시)
  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sErr || !session) {
    return { ok: false, error: "세션을 찾을 수 없습니다" };
  }

  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId);

  if (error) {
    console.error("deleteSessionExercise failed", error);
    return { ok: false, error: "운동 삭제 실패" };
  }

  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * 종료된 세션에 세트 1개 추가.
 * - 세트 추가: 기존 운동에 set_number = 현재 max + 1
 * - 운동 추가: 세션에 없던 exerciseId면 자연히 set_number = 1 (첫 세트)
 */
export async function addSetToSession(input: {
  sessionId: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
}): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  if (
    !Number.isFinite(input.weightKg) ||
    !Number.isFinite(input.reps) ||
    input.weightKg < 0 ||
    input.reps <= 0
  ) {
    return { ok: false, error: "무게(0 이상)와 회수(1 이상)를 확인하세요" };
  }

  // 본인 세션 확인
  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return { ok: false, error: "세션을 찾을 수 없습니다" };

  // 현재 max set_number (메인 세트만)
  const { data: maxRow } = await supabase
    .from("workout_sets")
    .select("set_number")
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId)
    .is("parent_set_id", null)
    .order("set_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSetNumber = (maxRow?.set_number ?? 0) + 1;

  const { error } = await supabase.from("workout_sets").insert({
    session_id: input.sessionId,
    exercise_id: input.exerciseId,
    set_number: nextSetNumber,
    weight_kg: input.weightKg,
    reps: input.reps,
    side: "both",
    drop_order: 0,
    parent_set_id: null,
  });

  if (error) {
    console.error("addSetToSession failed", error);
    return { ok: false, error: "세트 추가 실패" };
  }

  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** 세트 1개 삭제 (set id 기준). RLS가 본인 세트만 허용. */
export async function deleteSet(setId: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("id", setId);

  if (error) {
    console.error("deleteSet failed", error);
    return { ok: false, error: "세트 삭제 실패" };
  }

  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true };
}
