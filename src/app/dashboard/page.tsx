import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">대시보드</h1>
      <p className="mb-4">로그인됨: {user.email}</p>
      <Link href="/workout/new" className="block mb-4">
        <Button className="w-full" size="lg">
          운동 시작
        </Button>
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
      </form>
    </main>
  );
}
