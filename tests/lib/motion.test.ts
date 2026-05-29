import { describe, it, expect, vi, afterEach } from "vitest";
import { prefersReducedMotion } from "@/lib/motion";

describe("prefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when matchMedia reports reduce", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q === "(prefers-reduced-motion: reduce)",
      }),
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when matchMedia reports no-preference", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
