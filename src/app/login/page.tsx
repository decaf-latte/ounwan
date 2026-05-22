// Server Component — `<form action={...}>`로 Server Action 직접 호출, 'use client' 불필요
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>오운완 로그인</CardTitle>
          <CardDescription>Google 계정으로 시작하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">
              Google로 로그인
            </Button>
          </form>
          {error && (
            <p className="text-sm text-destructive">로그인 실패: {error}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
