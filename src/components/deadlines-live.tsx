"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type DeadlineItem = {
  id: number;
  mission: string | null;
  title: string;
  deadline: string;
  stage: string;
  dateApplied: string | null;
};

export type FollowupItem = {
  id: number;
  due: string | null;
  missionId?: string | null;
  jobId?: number | null;
  title?: string | null;
  contact?: string | null;
  channel?: string | null;
};

function parts(target: string, now: number) {
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
  };
}

export function DeadlinesLive({
  items,
  followups,
}: {
  items: DeadlineItem[];
  followups: FollowupItem[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const open = items.filter((i) => i.stage.toUpperCase() !== "APPLIED");
  const done = items.filter((i) => i.stage.toUpperCase() === "APPLIED");
  const rank = (i: DeadlineItem) => {
    const p = parts(i.deadline, now);
    if (!p) return Number.MAX_SAFE_INTEGER - 1;
    return p.d * 1440 + p.h * 60 + p.m;
  };
  open.sort((a, b) => rank(a) - rank(b));

  const fu = followups.map((f) => {
    if (!f.due) return { ...f, label: "date unknown", overdue: false };
    const diff = new Date(f.due).getTime() - now;
    if (diff <= 0) {
      const d = Math.max(1, Math.ceil(-diff / 86400000));
      return { ...f, label: `overdue by ${d}d`, overdue: true };
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return { ...f, label: d > 0 ? `due in ${d}d ${h}h` : `due in ${h}h`, overdue: false };
  });

  if (open.length === 0 && done.length === 0 && fu.length === 0) {
    return <p className="text-sm text-zinc-400">Nothing time-critical. Board is calm.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {open.map((d) => {
        const p = parts(d.deadline, now);
        const mins = !p ? -1 : p.d * 1440 + p.h * 60 + p.m;
        // Escalation tiers: passed → critical (≤24h) → high (≤3d) → watch (≤7d).
        const tier =
          mins < 0
            ? { box: "border-red-400/60 bg-red-400/10", text: "font-bold text-red-200", tag: "DEADLINE PASSED" as const }
            : mins <= 1440
              ? { box: "border-red-400/50 bg-red-400/5", text: "font-bold text-red-200", tag: "CRITICAL" as const }
              : mins <= 4320
                ? { box: "border-orange-400/50 bg-orange-400/5", text: "font-bold text-orange-200", tag: "3-DAY" as const }
                : mins <= 10080
                  ? { box: "border-amber-300/40 bg-amber-300/5", text: "font-bold text-amber-200", tag: "7-DAY" as const }
                  : { box: "os-hud-line", text: "text-zinc-400", tag: null };
        return (
          <li
            key={d.id}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${tier.box}`}
          >
            <Link href={`/missions/${d.id}`} className="font-semibold text-white">
              {d.mission} · {d.title}
            </Link>
            <span className={`text-xs ${tier.text}`}>
              {tier.tag && <span className="mr-1.5 rounded border border-current px-1 py-px text-[10px]">{tier.tag}</span>}
              {!p ? "" : p.d > 0 ? `${p.d}d ${p.h}h ${p.m}m remaining` : `${p.h}h ${p.m}m remaining`}
            </span>
          </li>
        );
      })}
      {done.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2"
        >
          <Link href={`/missions/${d.id}`} className="font-semibold text-white">
            {d.mission} · {d.title}
          </Link>
          <span className="text-xs font-bold text-emerald-200">
            ✓ APPLIED{d.dateApplied ? ` · ${d.dateApplied}` : ""} — no deadline pressure
          </span>
        </li>
      ))}
      {fu.map((f) => (
        <li
          key={`fu-${f.id}`}
          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
            f.overdue
              ? "border-red-400/50 bg-red-400/5"
              : "border-violet-400/30 bg-violet-400/5"
          }`}
        >
          <Link
            href={f.jobId ? `/missions/${f.jobId}` : "/quests"}
            className="font-semibold text-white"
          >
            Follow-up{f.missionId ? ` · ${f.missionId}` : ""}
            {f.title ? ` · ${f.title}` : ""}
          </Link>
          <span className={`text-xs font-bold ${f.overdue ? "text-red-200" : "text-violet-200"}`}>
            {f.contact ? `${f.contact} · ` : ""}{f.channel ? `${f.channel} · ` : ""}{f.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
