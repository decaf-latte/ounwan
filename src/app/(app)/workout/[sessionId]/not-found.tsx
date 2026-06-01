import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="p-5 max-w-md mx-auto space-y-4">
      <h2 className="text-h2 font-extrabold">세션을 찾을 수 없어요</h2>
      <p className="text-body text-text-muted">
        존재하지 않거나 다른 계정의 세션입니다.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">대시보드로 돌아가기</Button>
      </Link>
    </main>
  );
}
