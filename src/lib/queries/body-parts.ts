// src/lib/queries/body-parts.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type BodyPart = Tables<"body_parts">;

/** RSC fetch — 글로벌 부위 8행, 정렬됨 */
export async function fetchBodyParts(): Promise<BodyPart[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_parts")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
