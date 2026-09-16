// Central achievement engine — SERVER side (auth + writes).
// Pure rules (types, ACHIEVEMENTS, RARITY_STYLE) live in ./achievements-data
// (client-safe); this module re-exports them so existing server imports keep
// working unchanged.
export * from "./achievements-data";
import { ACHIEVEMENTS } from "./achievements-data";
import type { AchStats, Rarity } from "./achievements-data";
import { kindFor } from "./opportunities";

export async function getAchStats(): Promise<AchStats> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const countOf = async (table: string) => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
    return count ?? 0;
  };
  const [missions, resumes, contacts, companies, dsa, syncedDocs] = await Promise.all([
    countOf("jobs"),
    countOf("resume_versions"),
    countOf("contacts"),
    countOf("companies"),
    countOf("dsa_solves"),
    countOf("documents"),
  ]);
  const { data: apps } = await supabase.from("applications").select("stage");
  const stages = (apps ?? []).map((a) => (a.stage ?? "").toUpperCase());
  const has = (list: string[]) => stages.filter((s) => list.includes(s)).length;
  const { data: comms } = await supabase.from("communications").select("channel,status");
  const { data: preps } = await supabase.from("interview_preps").select("id");
  const { data: follows } = await supabase.from("follow_ups").select("id");
  const { data: xpRows } = await supabase.from("xp_transactions").select("created_at");
  const days = [...new Set((xpRows ?? []).map((r) => String(r.created_at).slice(0, 10)))].sort();
  let longest = 0, run = 0, prev = "";
  for (const d of days) {
    if (!prev) run = 1;
    else {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86400000;
      run = Math.round(diff) === 1 ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }
  let cur = 0;
  {
    const d = new Date();
    const set = new Set(days);
    if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) {
      cur++;
      d.setDate(d.getDate() - 1);
    }
  }
  const ch = (c: string, s: string) =>
    (comms ?? []).filter((x) => x.channel === c && x.status === s).length;
  // Sprint metrics (real rows only; zeros when no run exists)
  const { data: sprintDays } = await supabase
    .from("sprint_days")
    .select("run_id,day_number,day_date,status");
  const doneDays = (sprintDays ?? []).filter((d) => d.status === "COMPLETED");
  const dateOf = new Map(
    (sprintDays ?? []).map((d) => [`${d.run_id}:${d.day_number}`, String(d.day_date)])
  );
  const { data: allJobs } = await supabase.from("jobs").select("created_at,source_type,source");
  const oppKind: Record<string, number> = { LINKEDIN: 0, EMAIL: 0, CAREERS: 0, OTHER: 0 };
  for (const j of allJobs ?? []) oppKind[kindFor(j.source_type, j.source)]++;
  const { data: myPostRows } = await supabase.from("my_linkedin_posts").select("id").eq("status", "POSTED");
  const { data: runs } = await supabase.from("sprint_runs").select("start_date");
  const sprintDates = new Set<string>();
  for (const r of runs ?? []) {
    const d = new Date(String(r.start_date) + "T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      sprintDates.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  const createsByDay: Record<string, number> = {};
  for (const j of allJobs ?? []) {
    const k = String(j.created_at).slice(0, 10);
    if (!sprintDates.has(k)) continue; // sprint-window creates only
    createsByDay[k] = (createsByDay[k] ?? 0) + 1;
  }
  const { data: lcRows } = await supabase
    .from("sprint_leetcode")
    .select("run_id,day_number,status");
  const solvedByDay: Record<string, number> = {};
  for (const r of lcRows ?? []) {
    if (String(r.status).toUpperCase() !== "SOLVED") continue;
    const k = `${r.run_id}:${r.day_number}`;
    solvedByDay[k] = (solvedByDay[k] ?? 0) + 1;
  }
  const { data: projRows } = await supabase
    .from("sprint_projects")
    .select("run_id,day_number,status");
  const projDone = new Set(
    (projRows ?? [])
      .filter((p) => String(p.status).toUpperCase() === "COMPLETED")
      .map((p) => `${p.run_id}:${p.day_number}`)
  );
  const { data: liRows } = await supabase.from("sprint_linkedin_posts").select("status");
  const { data: ghRows } = await supabase
    .from("sprint_github")
    .select("run_id,day_number,status");
  const ghDone = new Set(
    (ghRows ?? [])
      .filter((p) => ["COMMITTED", "VERIFIED"].includes(String(p.status).toUpperCase()))
      .map((p) => `${p.run_id}:${p.day_number}`)
  );
  const isPub = (s: string) => ["PUBLISHED", "VERIFIED"].includes(String(s).toUpperCase());
  // Perfect = COMPLETED day where every goal provably held: 100 creates that
  // date + 5 solved slots + project completed + commit logged. LinkedIn counts
  // via the day's COMPLETED status (confirm-day requires PUBLISHED/VERIFIED).
  let perfect = 0;
  for (const d of doneDays) {
    const key = `${d.run_id}:${d.day_number}`;
    const dt = dateOf.get(key) ?? "";
    if (
      (createsByDay[dt] ?? 0) >= 100 &&
      (solvedByDay[key] ?? 0) >= 5 &&
      projDone.has(key) &&
      ghDone.has(key)
    )
      perfect++;
  }
  return {
    applied: has(["APPLIED", "OUTREACH", "WAITING"]),
    missions,
    resumes: resumes,
    preps: (preps ?? []).length,
    contacts: contacts,
    emailsSent: ch("EMAIL", "SENT"),
    waSent: ch("WHATSAPP", "SENT MANUALLY"),
    liNotes: (comms ?? []).filter((x) => x.channel === "LINKEDIN").length,
    companies,
    followups: (follows ?? []).length,
    dsa,
    streak: cur,
    longestStreak: longest,
    interviews: has(["INTERVIEW", "INTERVIEW SCHEDULED", "INTERVIEW COMPLETED", "FINAL ROUND", "ASSESSMENT", "SCREENING"]),
    offers: has(["OFFER"]),
    rejected: has(["REJECTED"]),
    syncedDocs,
    sprintDays: doneDays.length,
    sprintPerfect: perfect,
    sprintApps100: Object.values(createsByDay).filter((n) => n >= 100).length,
    sprintLeet5: Object.values(solvedByDay).filter((n) => n >= 5).length,
    sprintProjects: projDone.size,
    sprintLi: (liRows ?? []).filter((p) => isPub(p.status)).length,
    sprintGh: ghDone.size,
    oppsLinkedin: oppKind.LINKEDIN,
    oppsEmail: oppKind.EMAIL,
    oppsCareers: oppKind.CAREERS,
    myPosts: (myPostRows ?? []).length,
  };
}

// Award-once: inserts only missing rows; XP flows only for fresh inserts.
export async function checkAndAward(): Promise<{ id: string; title: string; xp: number; rarity: Rarity }[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const stats = await getAchStats();
  const { data: have } = await supabase
    .from("user_achievements")
    .select("achievement_id");
  const owned = new Set((have ?? []).map((r) => r.achievement_id));
  const fresh: { id: string; title: string; xp: number; rarity: Rarity }[] = [];
  for (const a of ACHIEVEMENTS) {
    if (owned.has(a.id)) continue;
    if ((stats[a.metric] ?? 0) < a.target) continue;
    const { data: inserted } = await supabase
      .from("user_achievements")
      .insert({
        user_id: user.id,
        achievement_id: a.id,
        xp_awarded: a.xp,
        celebration_seen: false,
      })
      .select("achievement_id");
    if (inserted && inserted.length > 0) {
      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        action: `Achievement: ${a.title}`,
        xp: a.xp,
      });
      fresh.push({ id: a.id, title: a.title, xp: a.xp, rarity: a.rarity });
    }
  }
  return fresh;
}
