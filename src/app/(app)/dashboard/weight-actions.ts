"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WeightSlot } from "@/lib/queries/body-weights";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type UpsertWeightInput = {
  logDate: string; // YYYY-MM-DD
  slot: WeightSlot;
  weightKg: number;
};

export async function upsertBodyWeight(
  input: UpsertWeightInput,
): Promise<ActionResult> {
  if (input.weightKg <= 0 || input.weightKg >= 500) {
    return { ok: false, error: "무게 값이 올바르지 않습니다" };
  }
  if (input.slot !== "morning" && input.slot !== "evening") {
    return { ok: false, error: "슬롯 값이 올바르지 않습니다" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("body_weights")
    .upsert(
      {
        user_id: user.id,
        log_date: input.logDate,
        slot: input.slot,
        weight_kg: input.weightKg,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "user_id,log_date,slot" },
    );

  if (error) {
    console.error("upsertBodyWeight failed", error);
    return { ok: false, error: "저장 실패" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/weight");
  return { ok: true };
}

export async function deleteBodyWeight(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("body_weights")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteBodyWeight failed", error);
    return { ok: false, error: "삭제 실패" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/weight");
  return { ok: true };
}
