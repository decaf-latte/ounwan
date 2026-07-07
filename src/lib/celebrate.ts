"use client";

/**
 * 운동 종료 시 발동하는 confetti 폭죽.
 * - reduced-motion 사용자에게는 발동 안 함
 * - canvas-confetti는 document를 만지므로 dynamic import (서버 번들에 포함 X)
 * - 1회 발동 — 운동 1개 완료에는 호출하지 말 것 (과함)
 */
export async function celebrate(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { default: confetti } = await import("canvas-confetti");
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.7 },
    colors: ["#E8763D", "#FFEDD9", "#FFFFFF", "#B8704A"],
  });
}
