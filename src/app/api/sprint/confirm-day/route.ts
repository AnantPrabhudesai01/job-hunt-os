import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreDay, sprintMissionKey, SPRINT_XP } from "@/lib/sprint";
import { checkAndAward } from "@/lib/achievements";

// POST { run_id, day_number } — recompute the day from LIVE rows, award each
// completed goal's XP once (dedupe key), set COMPLETED only on 5/5,
// otherwise IN_PROGRESS. Incomplete work stays incomplete.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const runId = Number(b.run_id);
  const day = Number(b.day_number);
  if (!runId || !(day >= 1 && day <= 30))
    return NextResponse.json({ error: "run_id, day_number 1-30 required." }, { status: 400 });

  const { data: dayRow } = await supabase
    .from("sprint_days")
    .select("day_date")
    .eq("run_id", runId)
    .eq("day_number", day)
    .single();
  if (!dayRow) return NextResponse.json({ error: "Day not found." }, { status: 404 });
  const dateKey = String(dayRow.day_date);

  const { data: run } = await supabase
    .from("sprint_runs")
    .select("daily_app_target")
    .eq("id", runId)
    .single();
  const target = run?.daily_app_target ?? 100;

  const [{ count: creates }, { data: lc }, { data: proj }, { data: gh }, { data: li }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${dateKey}T00:00:00Z`)
        .lt("created_at", `${dateKey}T23:59:59.999Z`),
      supabase.from("sprint_leetcode").select("status").eq("run_id", runId).eq("day_number", day),
      supabase.from("sprint_projects").select("status").eq("run_id", runId).eq("day_number", day).limit(1),
      supabase.from("sprint_github").select("status").eq("run_id", runId).eq("day_number", day).limit(1),
      supabase.from("sprint_linkedin_posts").select("status").eq("run_id", runId).eq("day_number", day).limit(1),
    ]);

  const goals = {
    apps: (creates ?? 0) >= target,
    leetcode: (lc ?? []).filter((r) => String(r.status).toUpperCase() === "SOLVED").length >= 5,
    project: proj?.[0] ? String(proj[0].status).toUpperCase() === "COMPLETED" : false,
    github: gh?.[0]
      ? ["COMMITTED", "VERIFIED"].includes(String(gh[0].status).toUpperCase())
      : false,
    linkedin: li?.[0]
      ? ["PUBLISHED", "VERIFIED"].includes(String(li[0].status).toUpperCase())
      : false,
  };
  const { done, pct } = scoreDay(goals);

  // Goal XP, once per run/day/goal.
  const { data: paid } = await supabase
    .from("xp_transactions")
    .select("mission_id,action")
    .like("mission_id", `SPRINT-${runId}-D${day}-%`);
  const have = new Set((paid ?? []).map((r) => `${r.mission_id}|${r.action}`));
  const fresh: { mission_id: string; action: string; xp: number }[] = [];
  (Object.keys(goals) as (keyof typeof goals)[]).forEach((g) => {
    if (!goals[g]) return;
    const key = sprintMissionKey(runId, day, g);
    const action = `Sprint D${day} ${g}`;
    if (!have.has(`${key}|${action}`))
      fresh.push({ mission_id: key, action, xp: SPRINT_XP.goal });
  });
  if (done === 5) {
    const key = sprintMissionKey(runId, day, "perfect");
    if (!have.has(`${key}|Sprint D${day} PERFECT`))
      fresh.push({ mission_id: key, action: `Sprint D${day} PERFECT`, xp: SPRINT_XP.perfectDay });
  }
  if (fresh.length > 0)
    await supabase.from("xp_transactions").insert(
      fresh.map((f) => ({ user_id: user.id, ...f }))
    );

  await supabase
    .from("sprint_days")
    .update({ status: done === 5 ? "COMPLETED" : "IN_PROGRESS" })
    .eq("run_id", runId)
    .eq("day_number", day);

  const freshAch = await checkAndAward();
  return NextResponse.json({ goals, done, pct, creates: creates ?? 0, target, freshAch });
}
