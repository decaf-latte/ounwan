import type { BodyPart } from "@/lib/queries/body-parts";

export type BodyPartCategory = "upper" | "lower";

export const BODY_PART_CATEGORY_LABEL: Record<BodyPartCategory, string> = {
  upper: "상체",
  lower: "하체",
};

const UPPER_CODES = new Set(["chest", "back", "shoulder", "trap", "arm", "core"]);
const LOWER_CODES = new Set(["leg", "glute"]);

export function getCategoryByCode(code: string): BodyPartCategory {
  if (LOWER_CODES.has(code)) return "lower";
  return "upper";
}

export function filterByCategory(
  bodyParts: BodyPart[],
  category: BodyPartCategory,
): BodyPart[] {
  return bodyParts.filter((bp) => getCategoryByCode(bp.code) === category);
}

export function categoryForSelectedIds(
  bodyParts: BodyPart[],
  ids: number[],
  fallback: BodyPartCategory = "upper",
): BodyPartCategory {
  if (ids.length === 0) return fallback;
  const byId = new Map(bodyParts.map((bp) => [bp.id, bp]));
  let upper = 0;
  let lower = 0;
  for (const id of ids) {
    const bp = byId.get(id);
    if (!bp) continue;
    if (getCategoryByCode(bp.code) === "upper") upper++;
    else lower++;
  }
  return lower > upper ? "lower" : "upper";
}
