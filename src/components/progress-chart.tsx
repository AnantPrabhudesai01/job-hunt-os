"use client";
import { useMemo, useState } from "react";
export type ProgressDay = { date: string; shared: number; applied: number };
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    d += ` L ${mx},${pts[i][1]} L ${mx},${pts[i + 1][1]} L ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}
export function ProgressChart({ days }: { days: ProgressDay[] }) {
  const [range, setRange] = useState<30 | 90 | 0>(0);
  const s = useMemo(() => {
    const full = days.map((d, i, arr) => ({
      ...d,
      cumShared: arr.slice(0, i + 1).reduce((t, x) => t + x.shared, 0),
      cumApplied: arr.slice(0, i + 1).reduce((t, x) => t + x.applied, 0),
    }));
    const win = range === 0 ? full : full.slice(-range);
    const avg7 = full.map((_, i) => {
      const w = full.slice(Math.max(0, i - 6), i + 1);
      return w.reduce((t, x) => t + x.shared, 0) / w.length;
    });
    const totalShared = full.reduce((t, x) => t + x.shared, 0);
    const totalApplied = full.reduce((t, x) => t + x.applied, 0);
    const best = full.reduce((b, x) => (x.shared > b.shared ? x : b), full[0] ?? { date: "-", shared: 0, applied: 0 });
    const active = full.filter((x) => x.shared > 0).length;
    const last7 = full.slice(-7);
    const avg = last7.length ? last7.reduce((t, x) => t + x.shared, 0) / last7.length : 0;
    return { win, avg7: range === 0 ? avg7 : avg7.slice(-range), totalShared, totalApplied, best, active, avg };
  }, [days, range]);
  const W = 800, H1 = 230, H2 = 170, P = { l: 34, r: 10, t: 14, b: 22 };
  const n = Math.max(s.win.length, 1);
  const x = (i: number) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (n - 1));
  const maxCum = Math.max(1, ...s.win.map((d) => d.cumShared));
  const y1 = (v: number) => P.t + (H1 - P.t - P.b) * (1 - v / maxCum);
  const maxDay = Math.max(1, ...s.win.map((d) => Math.max(d.shared, d.applied)));
  const y2 = (v: number) => P.t + (H2 - P.t - P.b) * (1 - v / maxDay);
  const cumS: [number, number][] = s.win.map((d, i) => [x(i), y1(d.cumShared)]);
  const cumA: [number, number][] = s.win.map((d, i) => [x(i), y1(d.cumApplied)]);
  const avgL: [number, number][] = s.win.map((_, i) => [x(i), y2(s.avg7[i] ?? 0)]);
  const bw = Math.max(1, Math.min(14, ((W - P.l - P.r) / Math.max(n, 1) - 3) / 2));
  const first = s.win[0]?.date ?? "", last = s.win[n - 1]?.date ?? "";
  const mid = s.win[Math.floor((n - 1) / 2)]?.date ?? "";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [`${s.totalShared}`, "SHARED TOTAL"],
          [`${s.totalApplied}`, "YOU APPLIED"],
          [`${s.best.date} (${s.best.shared})`, "BEST DAY"],
          [`${s.avg.toFixed(1)}/day`, `${s.active} ACTIVE DAYS`],
        ].map(([v, k]) => (
          <div key={k} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center">
            <p className="font-display text-xl font-bold text-white">{v}</p>
            <p className="text-[10px] tracking-widest text-zinc-500">{k}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {([["ALL", 0], ["90D", 90], ["30D", 30]] as [string, 30 | 90 | 0][]).map(([label, v]) => (
          <button
            key={label}
            onClick={() => setRange(v)}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${range === v ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-zinc-700 text-zinc-400"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold tracking-widest text-emerald-300">CAPACITY — CUMULATIVE</p>
        <svg viewBox={`0 0 ${W} ${H1}`} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P.l} x2={W - P.r} y1={P.t + (H1 - P.t - P.b) * f} y2={P.t + (H1 - P.t - P.b) * f} stroke="#27272a" strokeWidth={1} />
          ))}
          <path d={`${smoothPath(cumS)} L ${x(n - 1)},${H1 - P.b} L ${x(0)},${H1 - P.b} Z`} fill="#34d399" opacity={0.08} />
          <path d={smoothPath(cumS)} fill="none" stroke="#34d399" strokeWidth={2.5} strokeLinejoin="round" />
          <path d={smoothPath(cumA)} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={x(n - 1)} cy={y1(s.win[n - 1]?.cumShared ?? 0)} r={4} fill="#34d399" />
          <text x={P.l} y={H1 - 6} fill="#71717a" fontSize={11}>{first}</text>
          <text x={W / 2} y={H1 - 6} fill="#71717a" fontSize={11} textAnchor="middle">{n > 2 ? mid : ""}</text>
          <text x={W - P.r} y={H1 - 6} fill="#71717a" fontSize={11} textAnchor="end">{last}</text>
          <text x={W - P.r} y={P.t + 2} fill="#34d399" fontSize={13} fontWeight="bold" textAnchor="end">{s.win[n - 1]?.cumShared ?? 0} shared</text>
          <text x={W - P.r} y={P.t + 18} fill="#fbbf24" fontSize={13} fontWeight="bold" textAnchor="end">{s.win[n - 1]?.cumApplied ?? 0} applied</text>
        </svg>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold tracking-widest text-cyan-300">CONSISTENCY — DAILY (TEAL SHARED · GOLD APPLIED · DASHED 7-DAY AVG)</p>
        <svg viewBox={`0 0 ${W} ${H2}`} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60">
          {[0.5].map((f) => (
            <line key={f} x1={P.l} x2={W - P.r} y1={P.t + (H2 - P.t - P.b) * f} y2={P.t + (H2 - P.t - P.b) * f} stroke="#27272a" strokeWidth={1} />
          ))}
          {s.win.map((d, i) => (
            <g key={d.date}>
              <title>{`${d.date}: ${d.shared} shared, ${d.applied} applied`}</title>
              <rect x={x(i) - bw - 1} y={y2(d.shared)} width={bw} height={Math.max(1, H2 - P.b - y2(d.shared))} rx={1.5} fill="#34d399" opacity={0.75} />
              <rect x={x(i) + 1} y={y2(d.applied)} width={bw} height={Math.max(1, H2 - P.b - y2(d.applied))} rx={1.5} fill="#fbbf24" opacity={0.9} />
            </g>
          ))}
          <path d={smoothPath(avgL)} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.9} />
          <text x={P.l} y={H2 - 6} fill="#71717a" fontSize={11}>{first}</text>
          <text x={W - P.r} y={H2 - 6} fill="#71717a" fontSize={11} textAnchor="end">{last}</text>
        </svg>
      </div>
      <p className="text-[11px] text-zinc-500">Shared counts every mission logged (all-time). Applied counts only your manual MARK AS APPLIED flips. Zero-days included — gaps are honest.</p>
    </div>
  );
}
