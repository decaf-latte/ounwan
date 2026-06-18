import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchActiveChallenges } from "@/lib/queries/challenges";
import { ChallengesView } from "./ChallengesView";

export default async function ChallengesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const challenges = await fetchActiveChallenges(user.id);

  return (
    <main className="p-5 max-w-md lg:max-w-2xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">챌린지</h1>
      <p className="text-caption text-text-muted mt-1">
        N일 도전을 매일 체크. 운동 세션과 독립.
      </p>
      <ChallengesView challenges={challenges} />
    </main>
  );
}
