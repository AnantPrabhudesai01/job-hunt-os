import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, checkAndAward } from "@/lib/achievements";

// GET /api/achievements/pending — unseen celebrations (evaluate first, then list).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await checkAndAward();
  const { data } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", user.id)
    .eq("celebration_seen", false);
  const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  return NextResponse.json({
    queue: (data ?? [])
      .map((r) => byId[r.achievement_id])
      .filter(Boolean)
      .map((a) => ({ id: a.id, title: a.title, xp: a.xp, rarity: a.rarity })),
  });
}
