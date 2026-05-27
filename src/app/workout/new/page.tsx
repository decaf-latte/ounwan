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
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">운동 시작</h1>
      <StartForm
        bodyParts={bodyParts}
        exercises={exercises}
        templates={templates}
        recentSets={recentSets}
      />
    </main>
  );
}
