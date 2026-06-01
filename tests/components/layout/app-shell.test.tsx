// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/app/(app)/dashboard/actions", () => ({
  signOut: async () => {},
}));

describe("AppShell", () => {
  it("Sidebar와 BottomTab을 모두 렌더하고 반응형 클래스로 토글한다", () => {
    const { container } = render(
      <AppShell>
        <main>content</main>
      </AppShell>,
    );
    const nav = container.querySelectorAll("nav");
    expect(nav.length).toBe(2); // sidebar + bottom tab
    expect(nav[0].className).toContain("hidden");
    expect(nav[0].className).toContain("lg:flex");
    expect(nav[1].className).toContain("lg:hidden");
  });
});
