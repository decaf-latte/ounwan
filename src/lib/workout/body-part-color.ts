// src/lib/workout/body-part-color.ts
/**
 * body_parts.color hex 문자열 → React inline style.
 * MiniCalendar 도트, BodyPartTag 등에서 공통 사용.
 * 추후 다크모드 톤다운 / 알파 채널 / fallback 등을 여기 한 곳에 추가.
 */
import type { CSSProperties } from "react";

export function bodyPartStyle(color: string | null | undefined): CSSProperties {
  return { backgroundColor: color ?? "#B2BEC3" };
}
