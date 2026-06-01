import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSession } from "@/lib/queries/sessions";
import { fetchUserExercises } from "@/lib/queries/exercises";
import {
  fetchSessionSets,
  fetchLastMainSetsByExercise,
} from "@/lib/queries/sets";
import { SessionRunner } from "./SessionRunner";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ exercises?: string }>;
};

export default async function SessionPage({
  params,
  searchParams,
}: PageProps) {
  const [{ sessionId }, { exercises: exParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await fetchSession(sessionId);
  if (!session) notFound();
  if (session.user_id !== user.id) notFound();

  const [allExercises, existingSets] = await Promise.all([
    fetchUserExercises(user.id),
    fetchSessionSets(sessionId),
  ]);

  const exerciseIds = exParam
    ? exParam.split(",").filter(Boolean)
    : [...new Set(existingSets.map((s) => s.exercise_id))];

  const selectedExercises = exerciseIds
    .map((id) => allExercises.find((e) => e.id === id))
    .filter(<T,>(x: T | undefined): x is T => !!x);

  if (selectedExercises.length === 0) {
    notFound();
  }

  const prefillDefaults = await fetchLastMainSetsByExercise(
    user.id,
    exerciseIds,
  );

  return (
    <main className="p-5 max-w-md mx-auto pb-32">
      <SessionRunner
        session={session}
        exercises={selectedExercises}
        initialSets={existingSets}
        prefillDefaults={prefillDefaults}
      />
    </main>
  );
}
