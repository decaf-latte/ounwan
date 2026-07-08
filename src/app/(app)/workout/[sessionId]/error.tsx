"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("workout/[sessionId] error", error);
    // 콜드스타트/일시적 RSC race 대비 1회 자동 재시도 (digest별 tab 스코프)
    const key = `retry:${error.digest ?? error.message}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const t = setTimeout(reset, 1500);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <main className="p-5 max-w-md mx-auto space-y-4">
      <h2 className="text-h2 font-extrabold">잠시 멈췄어요</h2>
      <p className="text-body text-text-muted">
        {error.message ?? "다시 한번 시도해보세요"}
      </p>
      <Button onClick={reset}>다시 해볼게요</Button>
    </main>
  );
}
