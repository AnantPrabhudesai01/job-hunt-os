import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMissions, getStats } from "@/lib/data";
import {
  levelFor,
  objectivesFor,
  nextActionFor,
  DIFF_STARS,
  difficultyFor,
  isActiveStage,
} from "@/lib/game";
import { CareerCore, SectionTitle, Stars, EmptyState, XPBar } from "@/components/ui";
import { LiveClock } from "@/components/clock";
import { DeadlinesLive } from "@/components/deadlines-live";
import { TrophyStrip } from "@/components/trophy-strip";
import { Heatmap } from "@/components/heatmap";
import { TARGETS, todayKey } from "@/lib/gamification";
import { kindFor, type OppKind } from "@/lib/opportunities";
import { PrepLogger } from "@/components/prep-logger";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [missions, stats] = await Promise.all([getMissions(), getStats()]);
  const { data: followRows } = await supabase
    .from("follow_ups")
    .select("id,due_date,status,contact_name,channel,job_id,jobs(mission_id,title)")
    .eq("status", "PENDING");
  // Today's target: APPLIED flips (manual MARK AS APPLIED) vs the 100 goal.
  const day = todayKey();
  const [{ count: appliedToday }, { count: sharedToday }] = await Promise.all([
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("stage", "APPLIED")
      .eq("date_applied", day),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${day}T00:00:00Z`)
      .lt("created_at", `${day}T23:59:59.999Z`),
  ]);
  const targetPct = Math.min(100, Math.round(((appliedToday ?? 0) / TARGETS.daily) * 100));

  // 30-day challenge today + opportunity sources + own LinkedIn output.
  // All real rows; missing tables/columns (pre-migration) degrade to zeros.
  const [
    { data: kindJobs },
    { data: myPosts },
    { data: todayLc },
    { data: todayProj },
    { data: todayGh },
    { data: todaySprintLi },
    { data: todayDay },
  ] = await Promise.all([
    supabase.from("jobs").select("source_type,source"),
    supabase.from("my_linkedin_posts").select("status,posted_date,challenge_day,created_at"),
    supabase.from("sprint_leetcode").select("id").eq("status", "SOLVED").gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${day}T23:59:59.999Z`),
    supabase.from("sprint_projects").select("id").eq("status", "COMPLETED").gte("completed_at", `${day}T00:00:00Z`).lt("completed_at", `${day}T23:59:59.999Z`),
    supabase.from("sprint_github").select("id").in("status", ["COMMITTED", "VERIFIED"]).gte("created_at", `${day}T00:00:00Z`).lt("created_at", `${day}T23:59:59.999Z`),
    supabase.from("sprint_linkedin_posts").select("id").in("status", ["PUBLISHED", "VERIFIED"]).gte("published_at", `${day}T00:00:00Z`).lt("published_at", `${day}T23:59:59.999Z`),
    supabase.from("sprint_days").select("interview_minutes").eq("day_date", day).limit(1),
  ]);
  const oppCounts: Record<OppKind, number> = { LINKEDIN: 0, EMAIL: 0, CAREERS: 0, OTHER: 0 };
  for (const j of kindJobs ?? []) oppCounts[kindFor(j.source_type, j.source)]++;
  const postedMine = (myPosts ?? []).filter((p) => p.status === "POSTED");
  const myMonth = new Date().toISOString().slice(0, 7);
  const myPublished = postedMine.length;
  const myThisMonth = postedMine.filter((p) => String(p.posted_date ?? p.created_at ?? "").startsWith(myMonth)).length;
  const myChallenge = postedMine.filter((p) => p.challenge_day != null).length;
  const liToday =
    (todaySprintLi ?? []).length > 0 ||
    postedMine.some((p) => String(p.posted_date ?? "").startsWith(day));
  const prepToday = (todayDay ?? [])[0]?.interview_minutes ?? 0;
  const challengeCells: [string, string][] = [
    [`${appliedToday ?? 0} / 100`, "APPLICATIONS"],
    [`${(todayLc ?? []).length} / 5`, "LEETCODE"],
    [(todayProj ?? []).length > 0 ? "✓" : "—", "PROJECT"],
    [(todayGh ?? []).length > 0 ? "✓" : "—", "GITHUB"],
    [liToday ? "✓" : "—", "LINKEDIN POST"],
  ];

  // Heatmap fuel: per-day APPLIED flips + shares (last 20 weeks).
  const since = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 140);
    return d.toISOString().slice(0, 10);
  })();
  const [{ data: appliedRows }, { data: sharedRows }] = await Promise.all([
    supabase.from("applications").select("date_applied").eq("stage", "APPLIED").gte("date_applied", since),
    supabase.from("jobs").select("created_at").gte("created_at", `${since}T00:00:00Z`),
  ]);
  const appliedDays: Record<string, number> = {};
  for (const r of appliedRows ?? []) {
    if (!r.date_applied) continue;
    appliedDays[r.date_applied] = (appliedDays[r.date_applied] ?? 0) + 1;
  }
  const sharedDays: Record<string, number> = {};
  for (const r of sharedRows ?? []) {
    const k = String(r.created_at).slice(0, 10);
    sharedDays[k] = (sharedDays[k] ?? 0) + 1;
  }
  const { data: deadlines } = await supabase
    .from("jobs")
    .select("id,mission_id,title,deadline,applications(stage,date_applied)")
    .not("deadline", "is", null)
    .order("deadline");
  const { cur, next } = levelFor(stats.totalXp);
  const span = next ? next.minXp - cur.minXp : 1;
  const pct = next
    ? Math.min(100, Math.round(((stats.totalXp - cur.minXp) / span) * 100))
    : 100;

  const enriched = missions.map((m) => {
    const { progress } = objectivesFor({
      description: m.description,
      resumeCount: m.resume_versions.length,
      draftCount: m.email_drafts.length,
      stage: m.applications[0]?.stage ?? m.status,
      prepDone: m.interview_preps.length > 0,
    });
    return { ...m, progress };
  });
  const active = enriched.filter((m) =>
    isActiveStage(m.applications[0]?.stage ?? m.status),
  );
  // Today's objectives: top-3 next actions across active missions
  const objectives = active
    .map((m) => ({
      mission: m,
      action: nextActionFor({
        description: m.description,
        resumeCount: m.resume_versions.length,
        draftCount: m.email_drafts.length,
        stage: m.applications[0]?.stage ?? m.status,
        prepDone: m.interview_preps.length > 0,
      }),
    }))
    .slice(0, 3);
  const stageOf = (m: (typeof missions)[number]) =>
    ((m.applications[0]?.stage ?? m.status) ?? "").toUpperCase();
  const inStages = (m: (typeof missions)[number], list: string[]) =>
    list.includes(stageOf(m));
  const funnel: [string, number][] = [
    ["Preparing", missions.filter((m) =>
      inStages(m, ["NOT APPLIED", "SHORTLISTED", "PREPARING", "DISCOVERED", "ANALYZING", "RESUME READY", "READY TO APPLY"])).length],
    ["Applied", missions.filter((m) =>
      inStages(m, ["APPLIED", "OUTREACH", "WAITING", "RECRUITER CONTACTED", "RECRUITER RESPONDED"])).length],
    ["Interview", missions.filter((m) =>
      inStages(m, ["SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEW SCHEDULED", "INTERVIEW COMPLETED", "FINAL ROUND"])).length],
    ["Offer", missions.filter((m) => stageOf(m) === "OFFER").length],
  ];
  const campaign = [
    { label: "APPLIED", value: funnel[1][1], chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
    { label: "PENDING", value: funnel[0][1], chip: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
    { label: "INTERVIEWS", value: funnel[2][1], chip: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200" },
    { label: "OFFERS", value: funnel[3][1], chip: "border-yellow-300/40 bg-yellow-300/10 text-yellow-200" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* PLAYER STATUS */}
      <section className="os-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <CareerCore
              level={cur.n}
              title={cur.title}
            xp={stats.totalXp}
            missions={missions.length}
            interviews={0}
          />
          <div className="flex items-center gap-2 rounded-lg border os-hud-line px-3 py-2 text-sm">
            <Flame size={16} className="text-orange-400" aria-hidden />
            <span className="font-bold text-white">{stats.streak}</span>
            <span className="text-zinc-400">day streak</span>
          </div>
        </div>
          <LiveClock />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>
              {stats.totalXp} XP
              {next ? ` · ${next.minXp - stats.totalXp} to LVL ${next.n}` : " · MAX"}
            </span>
            <span>{pct}%</span>
          </div>
          <XPBar pct={pct} />
        </div>
      </section>

      {/* CAMPAIGN STATUS: applied vs pending at a glance */}
      <section className="os-panel p-5" aria-label="Campaign status">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {campaign.map((c) => (
            <div key={c.label} className={`rounded-xl border p-3 text-center ${c.chip}`}>
              <p className="font-display text-2xl font-bold text-white">{c.value}</p>
              <p className="text-[11px] font-bold tracking-widest">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TODAY'S TARGET: applied flips vs the daily 100 */}      <section className="os-panel p-5" aria-label="Today's target">
        <div className="flex items-baseline justify-between gap-2">
          <SectionTitle kicker="ROAD TO 100" title="Today's target" />
          <Link href="/quests" className="shrink-0 text-sm text-cyan-300">
            Full board →
          </Link>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-sm">
          <span className="text-zinc-400">
            <span className="font-display text-2xl font-bold text-white">{appliedToday ?? 0}</span>
            /{TARGETS.daily} applied
          </span>
          <span className="text-xs text-zinc-500">{sharedToday ?? 0} shared today · {targetPct}%</span>
        </div>
        <div className="mt-2">
          <XPBar pct={targetPct} />
        </div>
      </section>

      {/* 30-DAY CHALLENGE: today across all tracks (real rows only) */}
      <section className="os-panel p-5" aria-label="Challenge today">
        <div className="flex items-baseline justify-between gap-2">
          <SectionTitle kicker="STREAK ENGINE" title="30-day challenge" />
          <Link href="/sprint" className="shrink-0 text-sm text-cyan-300">
            Sprint →
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          {challengeCells.map(([v, k]) => (
            <div key={k} className="rounded-lg border os-hud-line p-2">
              <p className="font-display text-lg font-bold text-white">{v}</p>
              <p className="text-[10px] tracking-widest text-zinc-500">{k}</p>
            </div>
          ))}
          <div className="rounded-lg border os-hud-line p-2 text-left">
            <PrepLogger initialMinutes={prepToday} />
            <p className="text-[10px] tracking-widest text-zinc-500">PREP TIME</p>
          </div>
        </div>
      </section>

      {/* OPPORTUNITY SOURCES: where discoveries come from (real missions) */}
      <section className="os-panel p-5" aria-label="Opportunity sources">
        <SectionTitle kicker="ORIGIN" title="Opportunity sources" />
        <div className="mt-2 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {(
            [
              [oppCounts.LINKEDIN, "LINKEDIN"],
              [oppCounts.EMAIL, "EMAIL"],
              [oppCounts.CAREERS, "COMPANY CAREERS"],
              [oppCounts.OTHER, "OTHER"],
            ] as [number, string][]
          ).map(([v, k]) => (
            <div key={k} className="rounded-lg border os-hud-line p-3">
              <p className="font-display text-xl font-bold text-white">{v}</p>
              <p className="text-[11px] tracking-widest text-zinc-500">{k}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MY LINKEDIN OUTPUT: own posts, never mixed with opportunities */}
      <section className="os-panel p-5" aria-label="My LinkedIn output">
        <div className="flex items-baseline justify-between gap-2">
          <SectionTitle kicker="MY OUTPUT" title="LinkedIn posts published" />
          <Link href="/posts" className="shrink-0 text-sm text-cyan-300">
            All posts →
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          {(
            [
              [myPublished, "PUBLISHED"],
              [myThisMonth, "THIS MONTH"],
              [myChallenge, "THIS CHALLENGE"],
            ] as [number, string][]
          ).map(([v, k]) => (
            <div key={k} className="rounded-lg border os-hud-line p-3">
              <p className="font-display text-xl font-bold text-white">{v}</p>
              <p className="text-[11px] tracking-widest text-zinc-500">{k}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTRIBUTIONS: GitHub-style apply/share heatmap */}
      <section className="os-panel p-5" aria-label="Activity heatmap">
        <SectionTitle kicker="CONSISTENCY" title="Apply heat" />
        <Heatmap applied={appliedDays} shared={sharedDays} />
      </section>

      {/* TIME-SENSITIVE */}
      <section className="os-panel p-5">
        <SectionTitle kicker="CHRONO" title="Deadlines & follow-ups" />
        <DeadlinesLive
          items={(deadlines ?? []).map((d) => ({
            id: d.id,
            mission: d.mission_id,
            title: d.title,
            deadline: d.deadline as string,
            stage: d.applications?.[0]?.stage ?? "NOT APPLIED",
            dateApplied: d.applications?.[0]?.date_applied ?? null,
          }))}
          followups={(followRows ?? []).map((f) => {
            const job = Array.isArray(f.jobs) ? f.jobs[0] : f.jobs;
            return {
              id: f.id,
              due: f.due_date,
              missionId: job?.mission_id ?? null,
              jobId: f.job_id,
              title: job?.title ?? null,
              contact: f.contact_name,
              channel: f.channel,
            };
          })}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* TODAY'S OBJECTIVES */}
        <section className="os-panel p-5">
          <SectionTitle kicker="DAILY OPS" title="Today's objectives" />
          {objectives.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Board clear. Discover the next opportunity.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {objectives.map((o, i) => (
                <li key={o.mission.id}>
                  <Link
                    href={`/missions/${o.mission.id}`}
                    className="card-hover flex items-center gap-3 rounded-lg border os-hud-line p-3"
                  >
                    <span className="font-display text-xs font-bold text-cyan-300">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-sm">
                      <span className="font-semibold text-white">{o.action}</span>
                      <span className="block text-xs text-zinc-400">
                        {o.mission.mission_id} · {o.mission.title}
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-zinc-500" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ACTIVE MISSIONS */}
        <section className="os-panel p-5">
          <div className="flex items-center justify-between">
            <SectionTitle kicker="WAR TABLE" title="Active missions" />
          </div>
          {active.length === 0 ? (
            <EmptyState
              title="NO ACTIVE MISSIONS"
              body="Your next career mission is waiting. Discover an opportunity to deploy."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {active.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/missions/${m.id}`}
                    className="card-hover block rounded-lg border os-hud-line p-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">
                        {m.title}
                      </span>
                      <Stars n={DIFF_STARS[difficultyFor(m.priority, m.quality_score)]} />
                    </div>
                    <p className="text-xs text-zinc-400">
                      {m.mission_id} · {m.companies?.name}
                    </p>
                    <div className="mt-2">
                      <XPBar pct={m.progress} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/missions"
            className="mt-3 inline-block text-sm text-cyan-300"
          >
            Open mission board →
          </Link>
        </section>
      </div>

      {/* FUNNEL */}
      <section className="os-panel p-5">
        <SectionTitle kicker="ARSENAL" title="Evidence & intel" />
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border os-hud-line p-3">
            <p className="font-display text-xl font-bold text-white">
              {stats.assetCount}
            </p>
            <p className="text-[11px] tracking-widest text-zinc-500">EVIDENCE FILES</p>
          </div>
          <div className="rounded-lg border os-hud-line p-3">
            <p className="font-display text-xl font-bold text-white">
              {stats.emailCount}
            </p>
            <p className="text-[11px] tracking-widest text-zinc-500">TRACKED EMAILS</p>
          </div>
          <div className="rounded-lg border os-hud-line p-3">
            <p className="font-display text-xl font-bold text-white">
              {stats.outreachCount}
            </p>
            <p className="text-[11px] tracking-widest text-zinc-500">OUTREACH DRAFTS</p>
          </div>
        </div>
      </section>

      <section className="os-panel p-5">
        <SectionTitle kicker="CAMPAIGN" title="Career funnel" />
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {[
            ["DISCOVERED", missions.length],
            ...funnel,
          ].map(([label, n], i, arr) => (
            <li key={label} className="flex items-center gap-2">
              <span className="rounded-lg border os-hud-line px-3 py-1.5">
                <span className="font-display font-bold text-white">{n}</span>{" "}
                <span className="text-xs text-zinc-400">{label}</span>
              </span>
              {i < arr.length - 1 && <span className="text-zinc-600">→</span>}
            </li>
          ))}
        </ol>
      </section>
      <TrophyStrip />
    </div>
  );
}
