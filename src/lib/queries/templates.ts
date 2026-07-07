// src/lib/queries/templates.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type RoutineTemplate = Tables<"routine_templates">;
export type RoutineTemplateBodyPart = Tables<"routine_template_body_parts">;
export type TemplateWithBodyParts = RoutineTemplate & {
  routine_template_body_parts: RoutineTemplateBodyPart[];
};

export async function fetchUserTemplates(
  userId: string,
): Promise<TemplateWithBodyParts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routine_templates")
    .select("*, routine_template_body_parts(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TemplateWithBodyParts[];
}
