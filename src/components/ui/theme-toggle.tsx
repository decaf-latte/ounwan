"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

/** 서버=false, 클라(hydration 후)=true — effect setState 없이 마운트 감지 */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Light/Dark/System 순환 토글.
 * Hydration 안전 — mounted 가드.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <Button size="icon" variant="ghost" disabled aria-label="테마 전환" />;
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`현재 ${theme} 테마, 클릭해서 ${next}로 변경`}
      onClick={() => setTheme(next)}
    >
      <Icon className="w-5 h-5" />
    </Button>
  );
}
