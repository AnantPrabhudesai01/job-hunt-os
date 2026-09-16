import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, getAchStats } from "@/lib/achievements";
import { SectionTitle } from "@/components/ui";

export async function TrophyStrip() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [stats, owned] = await Promise.all([
    getAchStats(),
    supabase
      .from("user_achievements")
      .select("achievement_id,unlocked_at")
      .order("unlocked_at", { ascending: false })
      .limit(1),
  ]);
  const latest = (owned.data ?? [])[0];
  const latestDef = latest
    ? ACHIEVEMENTS.find((a) => a.id === latest.achievement_id)
    : null;
  const ownedIds = new Set((owned.data ?? []).map((r) => r.achievement_id));
  const next = ACHIEVEMENTS.filter((a) => !ownedIds.has(a.id))
    .map((a) => ({ a, r: (stats[a.metric] ?? 0) / a.target }))
    .sort((x, y) => y.r - x.r)
    .slice(0, 2);

  return (
    <section className="os-panel border-yellow-300/20 p-5">
      <SectionTitle kicker="HALL OF FAME" title="Trophies" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border os-hud-line p-3">
          <p className="text-[11px] tracking-widest text-zinc-500">LATEST UNLOCK</p>
          {latestDef ? (
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
              <Trophy size={15} className="text-yellow-200" aria-hidden />
              {latestDef.title}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">No trophies yet — earn your first.</p>
          )}
        </div>
        <div className="rounded-lg border os-hud-line p-3">
          <p className="text-[11px] tracking-widest text-zinc-500">NEXT UP</p>
          {next.map(({ a }) => (
            <p key={a.id} className="mt-1 text-sm text-zinc-200">
              {a.title}{" "}
              <span className="text-xs text-zinc-500">
                {Math.min(stats[a.metric] ?? 0, a.target)}/{a.target}
              </span>
            </p>
          ))}
        </div>
      </div>
      <Link href="/achievements" className="mt-3 inline-block text-sm text-yellow-200">
        Open Hall of Fame →
      </Link>
    </section>
  );
}
