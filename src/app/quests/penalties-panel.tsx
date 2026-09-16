"use client";

import { AlertTriangle } from "lucide-react";

export type PenaltyRow = {
  mid: string;
  title: string;
  ageHours: number;
  settled: ("24h" | "72h")[];
  pending: ("24h" | "72h")[];
};

// The teeth. Every unapplied mission carries a visible clock: −5 XP at 24h,
// another −10 at 72h (max −15 per mission, one-time each). Missing the daily
// 100 costs −50. Settled automatically when this board loads — idempotent,
// so refreshes never double-charge.
export function PenaltiesPanel({
  rows,
  settledTotal,
  missedYesterday,
}: {
  rows: PenaltyRow[];
  settledTotal: number;
  missedYesterday: boolean;
}) {
  const ticking = rows.filter((r) => r.pending.length > 0);
  if (ticking.length === 0 && settledTotal === 0 && !missedYesterday) return null;
  return (
    <div className="os-panel border-red-400/25 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-red-200">
        <AlertTriangle size={14} aria-hidden />
        Penalty watch
        {settledTotal !== 0 && (
          <span className="ml-auto text-xs font-bold text-red-300">{settledTotal} XP settled</span>
        )}
      </p>
      {missedYesterday && (
        <p className="mt-1.5 text-xs text-zinc-400">
          Yesterday closed below 100 — <span className="font-bold text-red-300">−50 XP</span> settled.
        </p>
      )}
      {ticking.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {ticking.slice(0, 6).map((r) => (
            <li key={r.mid} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-zinc-300">
                {r.mid} · {r.title}
              </span>
              <span className="shrink-0 text-zinc-500">
                {r.pending.includes("24h")
                  ? `${Math.max(0, Math.ceil(24 - r.ageHours))}h left before −5`
                  : "−5 paid · −10 at 72h"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {ticking.length > 6 && (
        <p className="mt-1 text-[11px] text-zinc-500">+{ticking.length - 6} more clocks ticking</p>
      )}
    </div>
  );
}
