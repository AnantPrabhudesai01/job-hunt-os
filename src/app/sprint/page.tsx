import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, XPBar } from "@/components/ui";
import { SprintStart } from "./start-client";
import { SPRINT_LEN, SPRINT_TOTAL_TARGET, dayState, scoreDay } from "@/lib/sprint";

export default async function SprintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("sprint_runs")
    .select("id,title,start_date,status,daily_app_target")
    .eq("status", "ACTIVE")
    .order("id", { ascending: false })
    .limit(1);
  const run = runs?.[0];
  if (!run) {
    return (
      <div className="flex flex-col gap-5">
        <SectionTitle kicker="SPRINT" title="30-Day Career Sprint" />
        <SprintStart />
      </div>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const startIso = String(run.start_date);
  const endD = new Date(startIso + "T00:00:00Z");
  endD.setUTCDate(endD.getUTCDate() + SPRINT_LEN - 1);
  const endIso = endD.toISOString().slice(0, 10);

  const [
    { data: days },
    { data: jobs },
    { data: lc },
    { data: projs },
    { data: ghs },
    { data: lis },
    { data: xpRows },
  ] = await Promise.all([
    supabase.from("sprint_days").select("day_number,day_date,status").eq("run_id", run.id).order("day_number"),
    supabase.from("jobs").select("created_at").gte("created_at", `${startIso}T00:00:00Z`).lt("created_at", `${endIso}T23:59:59.999Z`),
    supabase.from("sprint_leetcode").select("day_number,status").eq("run_id", run.id),
    supabase.from("sprint_projects").select("day_number,status").eq("run_id", run.id),
    supabase.from("sprint_github").select("day_number,status").eq("run_id", run.id),
    supabase.from("sprint_linkedin_posts").select("day_number,status").eq("run_id", run.id),
    supabase.from("xp_transactions").select("mission_id,xp,created_at").like("mission_id", `SPRINT-${run.id}-%`),
  ]);

  const createsByDate: Record<string, number> = {};
  for (const j of jobs ?? []) {
    const k = String(j.created_at).slice(0, 10);
    createsByDate[k] = (createsByDate[k] ?? 0) + 1;
  }
  const solvedByDay: Record<number, number> = {};
  for (const r of lc ?? [])
    if (String(r.status).toUpperCase() === "SOLVED")
      solvedByDay[r.day_number] = (solvedByDay[r.day_number] ?? 0) + 1;
  const byDay = <T extends { day_number: number; status: string }>(rows: T[] | null) => {
    const m = new Map<number, string>();
    for (const r of rows ?? []) m.set(r.day_number, String(r.status).toUpperCase());
    return m;
  };
  const projM = byDay(projs);
  const ghM = byDay(ghs);
  const liM = byDay(lis);
  const target = run.daily_app_target ?? 100;

  const goalsOf = (n: number, date: string) => ({
    apps: (createsByDate[date] ?? 0) >= target,
    leetcode: (solvedByDay[n] ?? 0) >= 5,
    project: projM.get(n) === "COMPLETED",
    github: ["COMMITTED", "VERIFIED"].includes(ghM.get(n) ?? ""),
    linkedin: ["PUBLISHED", "VERIFIED"].includes(liM.get(n) ?? ""),
  });

  // Today = run day whose date matches, else nearest upcoming.
  const dayList = days ?? [];
  let todayN = dayList.find((d) => String(d.day_date) === todayKey)?.day_number
    ?? dayList.filter((d) => String(d.day_date) <= todayKey).length
    ?? 1;
  if (todayN < 1) todayN = 1;
  if (todayN > SPRINT_LEN) todayN = SPRINT_LEN;
  const todayRow = dayList.find((d) => d.day_number === todayN);
  const tGoals = todayRow ? goalsOf(todayN, String(todayRow.day_date)) : null;
  const tScore = tGoals ? scoreDay(tGoals) : null;
  const appsToday = todayRow ? (createsByDate[String(todayRow.day_date)] ?? 0) : 0;

  const totalCreates = (jobs ?? []).length;
  const sprintXp = (xpRows ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);
  const xpToday = (xpRows ?? [])
    .filter((r) => String(r.created_at).slice(0, 10) === todayKey)
    .reduce((s, r) => s + (r.xp ?? 0), 0);
  const doneDays = dayList.filter((d) => d.status === "COMPLETED").length;
  const totalPct = Math.round((doneDays / SPRINT_LEN) * 100);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle kicker="SPRINT" title={`${run.title} — Day ${todayN} / ${SPRINT_LEN}`} />
      <section className="os-panel p-5" aria-label="Today">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-bold text-white">
            {tScore ? `${tScore.done}/5` : "—"} <span className="text-sm text-zinc-400">{tScore?.pct ?? 0}% today</span>
          </span>
          <Link href={`/sprint/${todayN}`} className="text-sm text-cyan-300">Open Day {todayN} →</Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <GoalChip label="Apps" value={`${appsToday}/${target}`} ok={tGoals?.apps} />
          <GoalChip label="LeetCode" value={`${solvedByDay[todayN] ?? 0}/5`} ok={tGoals?.leetcode} />
          <GoalChip label="Project" value={projM.get(todayN) ?? "—"} ok={tGoals?.project} />
          <GoalChip label="GitHub" value={ghM.get(todayN) ?? "—"} ok={tGoals?.github} />
          <GoalChip label="LinkedIn" value={liM.get(todayN) ?? "—"} ok={tGoals?.linkedin} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
          <span>XP today <strong className="text-white">{xpToday}</strong></span>
          <span>Sprint XP <strong className="text-white">{sprintXp}</strong></span>
          <span>Creates <strong className="text-white">{totalCreates}/{SPRINT_TOTAL_TARGET}</strong> ({SPRINT_TOTAL_TARGET - totalCreates} left)</span>
          <span>Days <strong className="text-white">{doneDays}/{SPRINT_LEN}</strong> ({totalPct}%)</span>
        </div>
        <div className="mt-2"><XPBar pct={totalPct} /></div>
      </section>
      <section className="os-panel p-5" aria-label="30-day calendar">
        <SectionTitle kicker="CALENDAR" title="30 days" />
        <ol className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-10">
          {dayList.map((d) => {
            const g = goalsOf(d.day_number, String(d.day_date));
            const s = scoreDay(g);
            const st = d.status === "COMPLETED" ? "COMPLETED" : dayState(String(d.day_date), todayKey, false);
            return (
              <li key={d.day_number}>
                <Link
                  href={`/sprint/${d.day_number}`}
                  className={`block rounded-lg border p-2 text-center ${
                    st === "COMPLETED"
                      ? "border-emerald-400/50 bg-emerald-400/10"
                      : st === "TODAY"
                        ? "border-cyan-400/60 bg-cyan-400/10"
                        : "border-white/10"
                  }`}
                >
                  <p className="text-xs font-bold text-white">D{d.day_number}</p>
                  <p className="text-[11px] text-zinc-400">{s.pct}%</p>
                  <p className="text-[10px] text-zinc-500">{createsByDate[String(d.day_date)] ?? 0} apps</p>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function GoalChip({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${ok ? "border-emerald-400/50 bg-emerald-400/10" : "os-hud-line"}`}>
      <p className="text-[11px] tracking-widest text-zinc-500">{label}</p>
      <p className={`text-sm font-bold ${ok ? "text-emerald-200" : "text-white"}`}>{ok ? "✅ " : ""}{value}</p>
    </div>
  );
}
