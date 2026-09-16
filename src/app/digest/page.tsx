import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TARGETS, weekStart, todayKey } from "@/lib/gamification";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";

// Sunday digest: the week that was + the week ahead, computed from real rows.
// Open any day — it always covers the current Mon–Sun week.
export default async function DigestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const day = todayKey();
  const ws = weekStart(day);
  const tomorrow = (() => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { count: shared },
    { count: applied },
    { data: penRows },
    { data: hot },
    { data: presence },
  ] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).gte("created_at", `${ws}T00:00:00Z`).lt("created_at", `${tomorrow}T00:00:00Z`),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("stage", "APPLIED").gte("date_applied", ws).lt("date_applied", tomorrow),
    supabase.from("xp_transactions").select("xp").like("action", "Penalty:%").gte("created_at", `${ws}T00:00:00Z`),
    supabase
      .from("jobs")
      .select("id,mission_id,title,deadline,priority,companies(name)")
      .not("deadline", "is", null)
      .order("deadline")
      .limit(3),
    supabase.from("site_visits").select("day,visits,seconds").gte("day", ws).lt("day", tomorrow).order("day"),
  ]);
  const penalties = (penRows ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);
  const pace = Math.max(0, TARGETS.daily * 7 - (applied ?? 0));
  const presDays = (presence ?? []).length;
  const presVisits = (presence ?? []).reduce((s, r) => s + (r.visits ?? 0), 0);
  const presMins = Math.round((presence ?? []).reduce((s, r) => s + (r.seconds ?? 0), 0) / 60);
  const { data: firstEver } = await supabase.from("site_visits").select("day").order("day").limit(1);

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="DEBRIEF" title={`Week of ${ws} — Sunday digest`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: shared ?? 0, l: "SHARED" },
            { v: applied ?? 0, l: `APPLIED (pace ${TARGETS.weekly})` },
            { v: penalties, l: "PENALTY XP" },
            { v: Math.max(0, pace), l: "TO CLOSE THE WEEK" },
          ].map((s) => (
            <div key={s.l} className="os-panel p-4 text-center">
              <p className="font-display text-2xl font-bold text-white">{s.v}</p>
              <p className="text-[11px] tracking-widest text-zinc-500">{s.l}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal>
        <SectionTitle kicker="PRESENCE" title="Time on site" />
        <div className="os-panel flex flex-wrap gap-x-6 gap-y-1 p-4 text-sm">
          <span className="text-zinc-400">
            First visit: <span className="font-bold text-white">{firstEver?.[0]?.day ?? "—"}</span>
          </span>
          <span className="text-zinc-400">
            Active days this week: <span className="font-bold text-white">{presDays}</span>
          </span>
          <span className="text-zinc-400">
            Visits: <span className="font-bold text-white">{presVisits}</span>
          </span>
          <span className="text-zinc-400">
            Time here: <span className="font-bold text-white">{presMins} min</span>
          </span>
        </div>
      </Reveal>
      <Reveal>
        <SectionTitle kicker="RADAR" title="Nearest deadlines" />
        {!hot || hot.length === 0 ? (
          <p className="text-sm text-zinc-400">No dated missions. Nothing hunting you.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {hot.map((h) => (
              <li key={h.id} className="os-panel flex items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/missions/${h.id}`} className="font-semibold text-white">
                  {h.mission_id} · {h.title}
                </Link>
                <span className="text-xs text-zinc-400">{h.deadline}</span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
