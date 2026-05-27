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
  }, [error]);

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold">운동 세션을 불러올 수 없습니다</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
