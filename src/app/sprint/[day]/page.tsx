import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { ROADMAP } from "@/lib/sprint";
import { DayClient } from "./day-client";

export default async function SprintDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const n = Number(day);
  if (!(n >= 1 && n <= 30)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("sprint_runs")
    .select("id,title,start_date,daily_app_target")
    .eq("status", "ACTIVE")
    .order("id", { ascending: false })
    .limit(1);
  const run = runs?.[0];
  if (!run) redirect("/sprint");

  const [{ data: dayRow }, { data: lc }, { data: proj }, { data: li }, { data: gh }] =
    await Promise.all([
      supabase.from("sprint_days").select("day_number,day_date,status,notes").eq("run_id", run.id).eq("day_number", n).single(),
      supabase.from("sprint_leetcode").select("*").eq("run_id", run.id).eq("day_number", n),
      supabase.from("sprint_projects").select("*").eq("run_id", run.id).eq("day_number", n).limit(1),
      supabase.from("sprint_linkedin_posts").select("*").eq("run_id", run.id).eq("day_number", n).limit(1),
      supabase.from("sprint_github").select("*").eq("run_id", run.id).eq("day_number", n).limit(1),
    ]);
  if (!dayRow) notFound();

  const { count: creates } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${dayRow.day_date}T00:00:00Z`)
    .lt("created_at", `${dayRow.day_date}T23:59:59.999Z`);

  const plan = ROADMAP.find((r) => r.day === n);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <SectionTitle kicker={`SPRINT · ${dayRow.day_date}`} title={`Day ${n} / 30`} />
        <Link href="/sprint" className="text-sm text-cyan-300">← Calendar</Link>
      </div>
      <DayClient
        runId={run.id}
        day={n}
        date={String(dayRow.day_date)}
        target={run.daily_app_target ?? 100}
        creates={creates ?? 0}
        initialLc={lc ?? []}
        initialProj={proj?.[0] ?? null}
        initialLi={li?.[0] ?? null}
        initialGh={gh?.[0] ?? null}
        plan={plan ?? null}
      />
    </div>
  );
}
