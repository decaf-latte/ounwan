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
    console.error("dashboard error", error);
  }, [error]);

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto space-y-4">
      <h2 className="text-h2 font-extrabold text-text">
        대시보드를 불러올 수 없어요
      </h2>
      <p className="text-body text-text-muted">
        {error.message ?? "다시 한번 시도해보세요"}
      </p>
      <Button onClick={reset}>다시 해볼게요</Button>
    </main>
  );
}
