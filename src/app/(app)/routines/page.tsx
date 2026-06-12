import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchRoutines } from "@/lib/queries/routines";
import { RoutinesView } from "./RoutinesView";

export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const routines = await fetchRoutines(user.id);

  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">루틴</h1>
      <p className="text-caption text-text-muted mt-1">
        PT·개인운동 라벨로 묶인 과거 루틴. 탭으로 그대로 시작하기.
      </p>
      <RoutinesView routines={routines} />
    </main>
  );
}
