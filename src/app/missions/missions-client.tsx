"use client";

import { useState } from "react";
import Link from "next/link";
import { getMissions, type MissionRow } from "@/lib/data";
import {
  objectivesFor,
  nextActionFor,
  difficultyFor,
  DIFF_STARS,
  DIFF_THEME,
} from "@/lib/game";
import { matchScoreFor, matchTone } from "@/lib/gamification";
import { SectionTitle, Stars, EmptyState, XPBar, StatusBadge } from "@/components/ui";

const FILTERS = ["ALL", "ACTIVE", "APPLIED", "INTERVIEW", "CLOSED"] as const;
const SORTS = [
  { key: "NEWEST", label: "NEWEST FIRST" },
  { key: "OLDEST", label: "OLDEST FIRST" },
  { key: "AZ", label: "A–Z" },
] as const;

function fmtDay(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function bucket(m: MissionRow) {
  const s = ((m.applications[0]?.stage ?? m.status) ?? "").toUpperCase();
  if (["INTERVIEW", "INTERVIEW SCHEDULED", "INTERVIEW COMPLETED", "FINAL ROUND", "ASSESSMENT", "SCREENING"].includes(s)) return "INTERVIEW";
  if (["APPLIED", "OUTREACH", "WAITING", "RECRUITER CONTACTED", "RECRUITER RESPONDED"].includes(s)) return "APPLIED";
  if (["OFFER", "REJECTED", "WITHDRAWN", "CLOSED"].includes(s)) return "CLOSED";
  return "ACTIVE";
}

export default function MissionsClient({ missions }: { missions: MissionRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("NEWEST");
  const shown = missions
    .filter((m) => filter === "ALL" || bucket(m) === filter)
    .sort((a, b) => {
      if (sort === "AZ")
        return ((a.companies?.name ?? a.title) || "").localeCompare(
          (b.companies?.name ?? b.title) || "",
        );
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sort === "OLDEST" ? at - bt : bt - at;
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle kicker="WAR TABLE" title="Mission board" />
        <Link
          href="/missions/new"
          className="btn btn-primary shrink-0 text-xs"
        >
          + NEW MISSION
        </Link>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Mission filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${
              filter === f
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                : "os-hud-line text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Mission sort">
        <span className="text-[11px] font-bold tracking-widest text-zinc-500">SORT:</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            aria-pressed={sort === s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${
              sort === s.key
                ? "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200"
                : "os-hud-line text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          title="NO MISSIONS IN THIS SECTOR"
          body="No missions match this filter. Adjust the filter or discover a new opportunity."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((m) => {
            const stage = m.applications[0]?.stage ?? m.status;
            const { progress } = objectivesFor({
              description: m.description,
              resumeCount: m.resume_versions.length,
              draftCount: m.email_drafts.length,
              stage,
              prepDone: m.interview_preps.length > 0,
            });
            const diff = difficultyFor(m.priority, m.quality_score);
            const theme = DIFF_THEME[diff];
            const match = matchScoreFor(m.required_skills ?? null);
            const daysLeft = m.deadline
              ? Math.ceil((new Date(m.deadline).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <li key={m.id} className={`card-hover os-panel block p-4 ${theme.edge}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[11px] font-bold tracking-widest text-cyan-300">
                    MISSION {m.mission_id}
                  </span>
                  <span className="flex items-center gap-2">
                    {match && (
                      <span
                        title={`Skill match (heuristic): ${match.hits}/${match.total} JD terms in your stack`}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${matchTone(match.pct)}`}
                      >
                        {match.pct}% MATCH
                      </span>
                    )}
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-widest ${theme.badge}`}>
                      {diff}
                    </span>
                    <Stars n={DIFF_STARS[diff]} />
                  </span>
                </div>
                <Link href={`/missions/${m.id}`}>
                  <p className="mt-1 font-display text-base font-bold text-white hover:text-cyan-200">
                    {m.title}
                  </p>
                </Link>
                <p className="text-sm text-zinc-400">
                  {m.companies?.name} · {m.location}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-1.5 py-0.5 font-bold tracking-wider text-cyan-200">
                    {(m.source_type ?? "UNKNOWN").replace(/_/g, " ")}
                  </span>
                  {m.linkedin_post_url && (
                    <a
                      href={m.linkedin_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border os-hud-line px-1.5 py-0.5 font-bold tracking-wider text-zinc-300 hover:text-white"
                      aria-label={`Open original post for ${m.title}`}
                    >
                      POST ↗
                    </a>
                  )}
                  {daysLeft !== null && (
                    <span
                      className={`rounded border px-1.5 py-0.5 font-bold tracking-wider ${
                        daysLeft < 0
                          ? "border-red-400/50 bg-red-400/10 text-red-200"
                          : daysLeft <= 3
                            ? "border-orange-400/50 bg-orange-400/10 text-orange-200"
                            : "border-zinc-500/40 text-zinc-300"
                      }`}
                    >
                      {daysLeft < 0 ? "PAST DUE" : daysLeft === 0 ? "DUE TODAY" : `${daysLeft}d left`}
                    </span>
                  )}
                  {(m.post_date_display ?? m.posted_at_display) && (
                    <span
                      title="Date shown on the original post (when recorded)"
                      className="rounded border border-violet-400/40 bg-violet-400/10 px-1.5 py-0.5 font-bold tracking-wider text-violet-200"
                    >
                      POSTED {(m.post_date_display ?? m.posted_at_display)!.toUpperCase()}
                    </span>
                  )}
                  {fmtDay(m.created_at) && (
                    <span
                      title="Date this mission was added to your board"
                      className="rounded border border-zinc-500/40 px-1.5 py-0.5 font-bold tracking-wider text-zinc-300"
                    >
                      ADDED {fmtDay(m.created_at)}
                    </span>
                  )}
                </p>
                <div className="mt-3">
                  <XPBar pct={progress} tone={theme.bar} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">
                    NEXT:{" "}
                    <span className="font-semibold text-zinc-100">
                      {nextActionFor({
                        description: m.description,
                        resumeCount: m.resume_versions.length,
                        draftCount: m.email_drafts.length,
                        stage,
                        prepDone: m.interview_preps.length > 0,
                      })}
                    </span>
                  </span>
                  <Link
                    href={`/missions/${m.id}`}
                    className="shrink-0"
                    aria-label={`Open ${m.title}`}
                  >
                    <StatusBadge status={stage} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
