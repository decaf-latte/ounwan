/**
 * `prefers-reduced-motion: reduce` 미디어 쿼리 검사.
 * 서버에서는 항상 false (window 없음).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
