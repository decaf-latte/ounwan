// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workout/abc-123",
}));

vi.mock("@/app/(app)/dashboard/actions", () => ({
  signOut: async () => {},
}));

describe("Sidebar", () => {
  it("'/workout/<id>'에서 운동 시작 nav를 활성으로 표시한다", () => {
    render(<Sidebar />);
    const workoutLink = screen.getByRole("link", { name: /운동 시작/ });
    expect(workoutLink).toHaveAttribute("aria-current", "page");
  });
});
