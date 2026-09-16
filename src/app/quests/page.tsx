import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMissions } from "@/lib/data";
import { nextActionFor, isActiveStage } from "@/lib/game";
import {
  BOUNTIES,
  bountyId,
  clockRuns,
  comboFor,
  FEE_XP,
  feesFor,
  MILESTONES,
  missAction,
  monthStart,
  penaltyAction,
  PENALTIES,
  seasonFor,
  TARGETS,
  todayKey,
  weekStart,
  type BountyKey,
} from "@/lib/gamification";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { BountyBoard } from "./bounty-board";
import { RulesSection } from "./rules-section";
import { TargetsBoard } from "./targets-board";
import { PenaltiesPanel } from "./penalties-panel";
import { FollowupQueueServer } from "./followup-queue-server";

const ACTION_XP: [RegExp, number][] = [
  [/tailor resume/i, 25],
  [/draft outreach|send application/i, 15],
  [/prepare interview/i, 30],
  [/follow up/i, 15],
];

function xpFor(action: string) {
  for (const [re, xp] of ACTION_XP) if (re.test(action)) return xp;
  return 10;
}

function xpPill(action: string) {
  if (/tailor resume/i.test(action))
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  if (/draft outreach|send application/i.test(action))
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (/prepare interview/i.test(action))
    return "border-violet-400/40 bg-violet-400/10 text-violet-200";
  if (/follow up/i.test(action))
    return "border-orange-400/40 bg-orange-400/10 text-orange-200";
  return "border-violet-400/40 bg-violet-400/10 text-violet-200";
}

export default async function QuestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [missions, { data: follows }] = await Promise.all([
    getMissions(),
    supabase
      .from("follow_ups")
      .select("id,due_date,status,contact_name,channel,job_id,jobs(mission_id,title,companies(name))")
      .eq("status", "PENDING"),
  ]);

  // ---- Daily bounty board (verified against today's real rows) ----
  const day = todayKey();
  const start = `${day}T00:00:00Z`;
  const end = `${day}T23:59:59.999Z`;
  const createdCount = async (table: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end);
    return count ?? 0;
  };
  const [jobsToday, prepsToday, anyActivity, { data: appliedToday }, { data: claims }, { data: xpRows }] =
    await Promise.all([
      createdCount("jobs"),
      createdCount("interview_preps"),
      Promise.all(
        ["jobs", "companies", "contacts", "resume_versions", "email_drafts", "documents", "interview_preps", "application_events"].map(
          createdCount,
        ),
      ).then((cs) => cs.some((c) => c > 0)),
      supabase.from("applications").select("id").eq("date_applied", day),
      supabase.from("user_achievements").select("achievement_id").like("achievement_id", "bounty-%"),
      supabase.from("xp_transactions").select("xp,created_at"),
    ]);
  const claimedIds = new Set((claims ?? []).map((r) => r.achievement_id));
  const metFor = (key: BountyKey) =>
    key === "first-move"
      ? anyActivity
      : key === "fresh-intel"
        ? jobsToday > 0
        : prepsToday > 0 || (appliedToday ?? []).length > 0;
  const clearDays = [...new Set([...claimedIds].map((s) => String(s).slice(7, 17)))].filter((d) =>
    (["first-move", "fresh-intel", "battle-ready"] as BountyKey[]).every((k) =>
      claimedIds.has(bountyId(d, k)),
    ),
  );
  const { mult, streak } = comboFor(clearDays, day);
  const byDay = new Map<string, number>();
  for (const r of xpRows ?? [])
    byDay.set(String(r.created_at).slice(0, 10), (byDay.get(String(r.created_at).slice(0, 10)) ?? 0) + (r.xp ?? 0));
  let bestDay: string | null = null;
  let bestDayXp = 0;
  for (const [d, x] of byDay) if (x > bestDayXp) { bestDayXp = x; bestDay = d; }

  // ---- Road to 100 (APPLIED flips only — manual MARK AS APPLIED) ----
  const appliedOn = async (from: string, to: string) => {
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("stage", "APPLIED")
      .gte("date_applied", from)
      .lt("date_applied", to);
    return count ?? 0;
  };
  const tomorrow = (() => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const nextMonth = (() => {
    const d = new Date(`${monthStart(day)}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const [tAppliedToday, tAppliedWeek, tAppliedMonth] = await Promise.all([
    appliedOn(day, tomorrow),
    appliedOn(weekStart(day), tomorrow),
    appliedOn(monthStart(day), nextMonth),
  ]);
  const milestonesHit = MILESTONES.filter((m) => tAppliedToday >= m.at).map((m) => m.at);

  // ---- Penalty settlement (idempotent: action-string dedupe, never double) ----
  // Wrapped defensively: ledger hiccups must never blank the board.
  const { data: penRows } = await supabase.from("xp_transactions").select("action,xp");
  const penActions = new Set((penRows ?? []).map((r) => r.action));
  const nowMs = Date.now();
  let settledTotal = 0;
  const penaltyRows: { mid: string; title: string; ageHours: number; settled: ("24h" | "72h")[]; pending: ("24h" | "72h")[] }[] = [];
  let missedYesterday = false;
  try {
  for (const m of missions) {
    const stage = m.applications[0]?.stage ?? m.status;
    if (!clockRuns(stage) || !m.created_at || !m.mission_id) continue;
    const ageHours = (nowMs - new Date(m.created_at).getTime()) / 3600000;
    const owed = feesFor(ageHours);
    const settled = owed.filter((w) => penActions.has(penaltyAction(m.mission_id as string, w)));
    const pending = owed.filter((w) => !penActions.has(penaltyAction(m.mission_id as string, w)));
    for (const w of pending) {
      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        action: penaltyAction(m.mission_id as string, w),
        xp: FEE_XP[w],
      });
      settledTotal += FEE_XP[w];
    }
    // Display truthfully: fees settled seconds ago in THIS load count as
    // settled now — otherwise paid rows keep showing "0h left" until refresh.
    penaltyRows.push({ mid: m.mission_id, title: m.title, ageHours, settled: [...settled, ...pending], pending: [] });
  }
  const yesterday = (() => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const { count: yApplied } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("stage", "APPLIED")
    .eq("date_applied", yesterday);
  if ((yApplied ?? 0) < TARGETS.daily && !penActions.has(missAction(yesterday))) {
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      action: missAction(yesterday),
      xp: PENALTIES.dailyMiss,
    });
    settledTotal += PENALTIES.dailyMiss;
    missedYesterday = true;
  } else if (penActions.has(missAction(yesterday))) {
    missedYesterday = (yApplied ?? 0) < 100;
  }
  } catch {
    /* settlement skipped this load — board still renders, retry next visit */
  }

  const active = missions.filter((m) =>
    isActiveStage(m.applications[0]?.stage ?? m.status),
  );
  const daily = active.slice(0, 5).map((m) => {
    const stage = m.applications[0]?.stage ?? m.status;
    const action = nextActionFor({
      description: m.description,
      resumeCount: m.resume_versions.length,
      draftCount: m.email_drafts.length,
      stage,
      prepDone: m.interview_preps.length > 0,
    });
    return { mission: m, action, xp: xpFor(action) };
  });

  return (
    <div className="flex flex-col gap-5">
      <Reveal>
        <RulesSection />
      </Reveal>
      <Reveal>
        <SectionTitle kicker="BOUNTY BOARD" title="Today's bounties" />
        <BountyBoard
          season={seasonFor().title}
          mult={mult}
          streak={streak}
          bounties={BOUNTIES.map((b) => ({
            ...b,
            met: metFor(b.key),
            claimed: claimedIds.has(bountyId(day, b.key)),
          }))}
          records={{
            bestDay,
            bestDayXp,
            bountiesClaimed: claimedIds.size,
            fullClears: clearDays.length,
          }}
        />
      </Reveal>
      <Reveal>
        <SectionTitle kicker="ROAD TO 100" title="Daily · weekly · monthly targets" />
        <PenaltiesPanel rows={penaltyRows} settledTotal={settledTotal} missedYesterday={missedYesterday} />
        <div className="mt-3">
          <TargetsBoard
          daily={tAppliedToday}
          weekly={tAppliedWeek}
          monthly={tAppliedMonth}
          sharesToday={jobsToday}
          milestonesHit={milestonesHit}
        />
        </div>
      </Reveal>
      <Reveal>
        <SectionTitle kicker="QUEST BOARD" title="Daily quests" />
        {daily.length === 0 ? (
          <EmptyState
            title="NO QUESTS TODAY"
            body="Board clear. Discover the next opportunity to generate quests."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {daily.map((q, i) => (
              <li
                key={q.mission.id}
                className="os-panel flex items-center gap-3 p-3"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    i === 0
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                      : "os-hud-line text-zinc-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-sm">
                  <span className="font-semibold text-white">{q.action}</span>
                  <span className="block text-xs text-zinc-400">
                    {q.mission.mission_id} · {q.mission.title}
                  </span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${xpPill(q.action)}`}>
                  +{q.xp} XP
                </span>
                <Link
                  href={`/missions/${q.mission.id}`}
                  className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500"
                >
                  Go
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal delay={0.05}>
        <SectionTitle kicker="NUDGE QUEUE" title="Follow-ups — who, when, what words" />
        <FollowupQueueServer missions={missions} follows={follows ?? []} />
      </Reveal>
    </div>
  );
}
