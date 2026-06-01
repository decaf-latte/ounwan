import { describe, it, expect } from "vitest";
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";

describe("estimateOneRepMax (Epley)", () => {
  it("1회 무게는 입력 무게 그대로 반환", () => {
    expect(estimateOneRepMax(80, 1)).toBe(80);
  });

  it("일반 케이스 — 60kg × 10회 → 80kg (Epley)", () => {
    // 60 × (1 + 10/30) = 60 × 1.333 = 80
    expect(estimateOneRepMax(60, 10)).toBe(80);
  });

  it("null / undefined / 0 / 음수 → 0", () => {
    expect(estimateOneRepMax(null, 10)).toBe(0);
    expect(estimateOneRepMax(60, null)).toBe(0);
    expect(estimateOneRepMax(undefined, undefined)).toBe(0);
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(50, 0)).toBe(0);
    expect(estimateOneRepMax(50, -3)).toBe(0);
  });

  it("소수 1자리 반올림", () => {
    // 70 × (1 + 8/30) = 70 × 1.2667 = 88.6666... → 88.7
    expect(estimateOneRepMax(70, 8)).toBe(88.7);
  });
});

describe("calcSetVolume", () => {
  it("정상 케이스 60kg × 10회 = 600", () => {
    expect(calcSetVolume(60, 10)).toBe(600);
  });

  it("null / undefined / 0 / 음수 → 0", () => {
    expect(calcSetVolume(null, 10)).toBe(0);
    expect(calcSetVolume(60, null)).toBe(0);
    expect(calcSetVolume(0, 10)).toBe(0);
    expect(calcSetVolume(50, -1)).toBe(0);
  });
});
