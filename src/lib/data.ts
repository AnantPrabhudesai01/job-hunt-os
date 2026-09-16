import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type MissionRow = {
  id: number;
  mission_id: string | null;
  title: string;
  location: string | null;
  status: string | null;
  priority: string | null;
  quality_score: number | null;
  deadline: string | null;
  description: string | null;
  source_type: string | null;
  linkedin_post_url: string | null;
  required_skills: string | null;
  created_at: string | null;
  post_date_display: string | null;
  posted_at_display: string | null;
  companies: { name: string | null } | null;
  applications: { stage: string | null; updated_at: string | null }[];
  resume_versions: { id: number }[];
  email_drafts: { id: number }[];
  interview_preps: { status: string | null }[];
};

export async function getMissions(): Promise<MissionRow[]> {  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id,mission_id,title,location,status,priority,quality_score,deadline,description,source_type,linkedin_post_url,created_at,post_date_display,posted_at_display," +
        "companies(name),applications(stage,updated_at),resume_versions(id),email_drafts(id),interview_preps(status),required_skills",
    )
    .order("quality_score", { ascending: false, nullsFirst: false });
  return (data ?? []) as unknown as MissionRow[];
}

async function fetchStats() {
  const supabase = await createClient();
  const [{ data: xpRows }, { data: follows }, { data: drafts }, { data: apps }, assetRes, emailRes, { data: datedJobs }, { data: walkinJobs }] =
    await Promise.all([
      supabase.from("xp_transactions").select("xp,created_at"),
      supabase
        .from("follow_ups")
        .select("id,due_date,status,job_id,jobs(mission_id,title)")
        .eq("status", "PENDING"),
      supabase.from("email_drafts").select("id"),
      supabase.from("applications").select("stage"),
      supabase.from("assets").select("id", { count: "exact", head: true }),
      supabase.from("emails").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id,mission_id,title,deadline,status,created_at,applications(stage)"),
      supabase
        .from("jobs")
        .select("id,mission_id,title,location,deadline,applications(stage)")
        .not("deadline", "is", null)
        .or("description.ilike.%walk-in%,employment_type.ilike.%walk-in%"),
    ]);
  const totalXp = (xpRows ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);
  const activeMissions = (apps ?? []).filter((a) =>
    ["NOT APPLIED", "SHORTLISTED", "PREPARING", "READY TO APPLY", "DISCOVERED", "ANALYZING", "RESUME READY"].includes(
      (a.stage ?? "NOT APPLIED").toUpperCase(),
    ),
  ).length;
  // Streak: consecutive days with XP activity ending today/yesterday
  const days = new Set(
    (xpRows ?? []).map((r) => String(r.created_at).slice(0, 10)),
  );
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return {
    totalXp,
    streak,
    activeMissions,
    pendingFollowups: follows ?? [],
    outreachCount: (drafts ?? []).length,
    assetCount: assetRes.count ?? 0,
    emailCount: emailRes.count ?? 0,
    notices: buildNotices(follows ?? [], datedJobs ?? [], walkinJobs ?? []),
  };
}

export type Notice = {
  id: string;
  kind: "OVERDUE" | "CRITICAL" | "STALE" | "WALKIN";
  text: string;
  href: string;
};

// Bell fuel, computed once per request from already-fetched rows:
// walk-ins ≤3 days (own lane, never mixed with deadlines), overdue nudges,
// deadlines ≤3 days, missions unapplied 24h+.
function buildNotices(
  follows: { id: number; due_date: string | null; job_id: number | null; jobs: unknown }[],
  jobs: { id: number; mission_id: string | null; title: string; deadline: string | null; status: string | null; created_at: string; applications: unknown }[],
  walkins: { id: number; mission_id: string | null; title: string; location: string | null; deadline: string | null; applications: unknown }[],
): Notice[] {
  const out: Notice[] = [];
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const stageOf = (a: unknown) =>
    ((Array.isArray(a) ? a[0] : a) as { stage?: string } | null)?.stage?.toUpperCase() ?? "";
  // Walk-ins first: their own lane. Recomputed every load, so it nags daily until the date.
  for (const w of walkins) {
    if (!w.deadline || stageOf(w.applications) === "APPLIED") continue;
    const days = Math.ceil((new Date(w.deadline).getTime() - now) / 86400000);
    if (days < 0 || days > 3) continue;
    out.push({
      id: `wi-${w.id}`,
      kind: "WALKIN",
      text: `Walk-in ${days === 0 ? "TODAY" : `in ${days}d`}: ${w.mission_id ?? ""} ${w.title} @ ${w.location ?? "venue in post"}`.trim(),
      href: "/walkins",
    });
  }
  for (const f of follows) {
    if (!f.due_date || f.due_date >= day) continue;
    const job = (Array.isArray(f.jobs) ? f.jobs[0] : f.jobs) as { mission_id?: string; title?: string } | null;
    out.push({
      id: `fu-${f.id}`,
      kind: "OVERDUE",
      text: `Nudge overdue: ${job?.mission_id ?? ""} ${job?.title ?? ""}`.trim(),
      href: f.job_id ? `/missions/${f.job_id}` : "/quests",
    });
  }
  for (const j of jobs) {
    const stage = (
      Array.isArray(j.applications) ? j.applications[0] : j.applications
    ) as { stage?: string } | null;
    const st = (stage?.stage ?? j.status ?? "").toUpperCase();
    if (j.deadline && st !== "APPLIED") {
      const days = Math.ceil((new Date(j.deadline).getTime() - now) / 86400000);
      if (days >= 0 && days <= 3) {
        out.push({
          id: `dl-${j.id}`,
          kind: "CRITICAL",
          text: `${j.mission_id ?? ""} deadline ${days === 0 ? "TODAY" : `in ${days}d`}: ${j.title}`.trim(),
          href: `/missions/${j.id}`,
        });
      }
    }
    const pre = ["NOT APPLIED", "DISCOVERED", "ANALYZING", "SHORTLISTED", "PREPARING", "RESUME READY", "READY TO APPLY"];
    if (pre.includes(st) && now - new Date(j.created_at).getTime() > 86400000) {
      out.push({
        id: `st-${j.id}`,
        kind: "STALE",
        text: `${j.mission_id ?? ""} unapplied 24h+: ${j.title}`.trim(),
        href: `/missions/${j.id}`,
      });
    }
  }
  return out.slice(0, 12);
}

// Deduped per request: layout + page share one database round instead of two.
export const getStats = cache(fetchStats);

const TRACKED = [
  "JavaScript",
  "Python",
  "SQL",
  "REST",
  "Git",
  "Java",
  "React",
  "Node",
];

export function skillDemand(jobs: { required_skills: string | null }[]) {
  return TRACKED.map((skill) => ({
    skill,
    count: jobs.filter((j) =>
      (j.required_skills ?? "").toLowerCase().includes(skill.toLowerCase()),
    ).length,
  })).sort((a, b) => b.count - a.count);
}
