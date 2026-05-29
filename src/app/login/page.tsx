// Server Component — `<form action={...}>`로 Server Action 직접 호출, 'use client' 불필요
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="p-8 max-w-md mx-auto flex flex-col items-center justify-center min-h-[80dvh]">
      <h1 className="text-display font-extrabold text-text">오운완</h1>
      <p className="text-body text-text-muted mt-2">오늘도 운동 잘 했어요</p>

      <form action={signInWithGoogle} className="w-full mt-8">
        <Button type="submit" size="lg" className="w-full">
          Google로 시작하기
        </Button>
      </form>

      {error && (
        <p className="text-caption text-danger mt-3">로그인 실패: {error}</p>
      )}
    </main>
  );
}
