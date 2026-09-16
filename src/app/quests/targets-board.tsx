"use client";

import { Flag, CalendarDays, CalendarRange } from "lucide-react";
import { MILESTONES, TARGETS } from "@/lib/gamification";

// Road to 100. Counts APPLIED-stage flips only (your manual MARK AS APPLIED
// clicks — missions and mails count the same once YOU flip them). Drafts,
// sends and shares never count as applied. Misses cost nothing: milestones
// stay unearned, pace numbers just re-aim.
export function TargetsBoard({
  daily,
  weekly,
  monthly,
  sharesToday,
  milestonesHit,
}: {
  daily: number;
  weekly: number;
  monthly: number;
  sharesToday: number;
  milestonesHit: number[];
}) {
  const rows = [
    { Icon: Flag, label: "Today", done: daily, target: TARGETS.daily, note: `${sharesToday} shared today` },
    { Icon: CalendarDays, label: "This week", done: weekly, target: TARGETS.weekly, note: "Mon–Sun" },
    { Icon: CalendarRange, label: "This month", done: monthly, target: TARGETS.monthly, note: "calendar month" },
  ];
  const toGo = Math.max(0, TARGETS.daily - daily);
  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ Icon, label, done, target, note }) => (
        <div key={label} className="os-panel p-3">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <Icon size={14} className="text-cyan-300" aria-hidden />
              {label}
            </span>
            <span className="text-xs text-zinc-400">
              <span className="text-base font-bold text-white">{done}</span>/{target} · {note}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
            <div
              className="grad-xp h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((done / target) * 100))}%` }}
            />
          </div>
        </div>
      ))}
      <div className="os-panel flex flex-wrap items-center gap-2 p-3">
        <span className="text-xs text-zinc-400">
          {toGo === 0
            ? "Daily 100 smashed — milestones banked."
            : `${toGo} more to hit today's 100 · milestones unlock at`}
        </span>
        {toGo > 0 &&
          MILESTONES.map((m) => (
            <span
              key={m.at}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                milestonesHit.includes(m.at)
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "os-hud-line text-zinc-500"
              }`}
            >
              {m.at}{milestonesHit.includes(m.at) ? " ✓" : ""}
            </span>
          ))}
      </div>
    </div>
  );
}
