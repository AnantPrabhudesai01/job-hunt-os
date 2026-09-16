"use client";

import { useState } from "react";

// GitHub-style contribution grid for APPLIED flips (and shares). Brighter =
// more that day, scaled to YOUR busiest day — beat yesterday, today glows.
// Pure render from server-computed day counts.
export function Heatmap({
  applied,
  shared,
}: {
  applied: Record<string, number>;
  shared: Record<string, number>;
}) {
  const [mode, setMode] = useState<"applied" | "shared">("applied");
  const data = mode === "applied" ? applied : shared;

  const today = new Date();
  const days: { date: string; count: number; dow: number }[] = [];
  for (let i = 139; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: data[key] ?? 0, dow: d.getUTCDay() });
  }
  // Align into week columns starting Sunday.
  const lead = days[0].dow;
  const cells: ({ date: string; count: number } | null)[] = [
    ...Array<null>(lead).fill(null),
    ...days,
  ];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const tier = (c: number) =>
    c === 0
      ? "border-white/5 bg-[#141a2e]"
      : c / max < 0.25
        ? "border-emerald-800 bg-emerald-800"
        : c / max < 0.5
          ? "border-emerald-600 bg-emerald-600"
          : c / max < 0.75
            ? "border-emerald-400 bg-emerald-400"
            : "border-emerald-200 bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]";
  const swatch = [
    "border-white/5 bg-[#141a2e]",
    "border-emerald-800 bg-emerald-800",
    "border-emerald-600 bg-emerald-600",
    "border-emerald-400 bg-emerald-400",
    "border-emerald-200 bg-emerald-300",
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm text-zinc-400">
          <span className="font-bold text-white">{total}</span> {mode} in the last 20 weeks
        </p>
        <span className="ml-auto flex gap-1" role="group" aria-label="Heatmap metric">
          {(["applied", "shared"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${
                mode === m ? "bg-emerald-400/15 text-emerald-200" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {m}
            </button>
          ))}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1" role="img" aria-label={`${total} ${mode} in 20 weeks`}>
        <div className="flex flex-col gap-1 text-[9px] leading-3 text-zinc-500" aria-hidden>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <span key={d} className={i % 2 === 1 ? "" : "invisible"}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d, j) =>
              d === null ? (
                <span key={j} className="h-3 w-3" />
              ) : (
                <span
                  key={j}
                  title={`${d.date}: ${d.count} ${mode}`}
                  className={`h-3 w-3 rounded-[3px] border ${tier(d.count)}`}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
        Less
        {swatch.map((s, t) => (
          <span key={t} className={`h-3 w-3 rounded-[3px] border ${s}`} />
        ))}
        More
      </div>
    </div>
  );
}
