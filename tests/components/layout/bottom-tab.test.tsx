// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomTab } from "@/components/layout/BottomTab";

vi.mock("next/navigation", () => ({
  usePathname: () => "/history",
}));

describe("BottomTab", () => {
  it("/history 경로에서 기록 탭을 활성으로 표시한다", () => {
    render(<BottomTab />);
    const historyTab = screen.getByRole("link", { name: /기록/ });
    expect(historyTab).toHaveAttribute("aria-current", "page");
  });
});
