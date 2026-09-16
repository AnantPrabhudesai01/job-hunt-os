import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, getAchStats } from "@/lib/achievements";
import { TrophiesClient } from "./trophies-client";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [stats, owned] = await Promise.all([
    getAchStats(),
    supabase.from("user_achievements").select("achievement_id,unlocked_at,xp_awarded"),
  ]);
  const ownedMap: Record<string, { at: string; xp: number }> = {};
  (owned.data ?? []).forEach((r) =>
    ownedMap[r.achievement_id] = { at: r.unlocked_at, xp: r.xp_awarded },
  );
  const progress: Record<string, number> = {};
  for (const a of ACHIEVEMENTS) progress[a.id] = stats[a.metric] ?? 0;

  return <TrophiesClient owned={ownedMap} progress={progress} />;
}
