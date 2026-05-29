import { describe, it, expect } from "vitest";
import { computeDashOffset } from "@/components/ui/progress-ring";

describe("computeDashOffset", () => {
  it("0 progress → full offset (no fill)", () => {
    // circumference = 2 * PI * 26 ≈ 163.36
    expect(computeDashOffset(0, 100, 26)).toBeCloseTo(163.36, 1);
  });

  it("50% progress → half offset", () => {
    expect(computeDashOffset(50, 100, 26)).toBeCloseTo(81.68, 1);
  });

  it("100% progress → 0 offset (fully filled)", () => {
    expect(computeDashOffset(100, 100, 26)).toBeCloseTo(0, 1);
  });

  it("clamps progress above max to 0", () => {
    expect(computeDashOffset(150, 100, 26)).toBeCloseTo(0, 1);
  });

  it("clamps negative progress to full offset", () => {
    expect(computeDashOffset(-10, 100, 26)).toBeCloseTo(163.36, 1);
  });
});
