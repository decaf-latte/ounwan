import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchBodyParts } from "@/lib/queries/body-parts";
import { fetchUserExercises } from "@/lib/queries/exercises";
import { fetchUserTemplates } from "@/lib/queries/templates";
import { fetchRecentSets } from "@/lib/queries/sets";
import { StartForm } from "./StartForm";

export default async function NewWorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [bodyParts, exercises, templates, recentSets] = await Promise.all([
    fetchBodyParts(),
    fetchUserExercises(user.id),
    fetchUserTemplates(user.id),
    fetchRecentSets(user.id, 30),
  ]);

  // 진행 중(미종료)이면서 세트가 1개 이상 있는 세션 — 이어하기 배너용.
  // workout_sets!inner로 빈 세션 제외 (빈 세션은 /workout/[id]에서 notFound).
  const { data: activeSession } = await supabase
    .from("workout_sessions")
    .select("id, workout_sets!inner(id)")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="p-5 max-w-md mx-auto">
      <div className="text-label text-accent-strong uppercase">새 운동</div>
      <h1 className="text-display font-extrabold mt-1 text-text">
        오늘 뭐 할까요?
      </h1>

      {activeSession && (
        <Link
          href={`/workout/${activeSession.id}`}
          className="mt-4 flex items-center justify-between gap-2 rounded-xl border-2 border-accent bg-accent-soft p-4"
        >
          <div>
            <div className="text-body font-bold text-text">
              진행 중인 운동이 있어요
            </div>
            <div className="text-caption text-text-muted">
              이어서 하기
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-accent shrink-0" />
        </Link>
      )}

      <StartForm
        bodyParts={bodyParts}
        exercises={exercises}
        templates={templates}
        recentSets={recentSets}
      />
    </main>
  );
}
