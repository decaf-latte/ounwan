import { redirect } from "next/navigation";
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

  return (
    <main className="p-5 max-w-md mx-auto">
      <div className="text-label text-accent-strong uppercase">새 운동</div>
      <h1 className="text-display font-extrabold mt-1 text-text">
        오늘 뭐 할까요?
      </h1>
      <StartForm
        bodyParts={bodyParts}
        exercises={exercises}
        templates={templates}
        recentSets={recentSets}
      />
    </main>
  );
}
