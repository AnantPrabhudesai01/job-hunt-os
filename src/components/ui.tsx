import { type ReactNode } from "react";
import { statusColor } from "@/lib/game";

export function XPBar({ pct, tone = "grad-xp" }: { pct: number; tone?: string }) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-zinc-800/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="XP progress"
    >
      <div
        className={`h-full rounded-full ${tone} shadow-[0_0_12px_rgba(139,92,246,0.55)] transition-[width]`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div className="mb-3">
      <p className="font-display text-[11px] font-bold tracking-[0.2em] text-cyan-300/80">
        {kicker}
      </p>
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
    </div>
  );
}

export function CareerCore({
  level,
  title,
  xp,
  missions,
  interviews,
}: {
  level: number;
  title: string;
  xp: number;
  missions: number;
  interviews: number;
}) {
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="#1a2340" strokeWidth="9" />
          <g className="core-ring-anim" style={{ transformOrigin: "64px 64px" }}>
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="url(#coregrad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * 0.22}
            />
          </g>
          <defs>
            <linearGradient id="coregrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="35%" stopColor="#22d3ee" />
              <stop offset="70%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold text-white text-glow-cyan">
            {level}
          </span>
          <span className="text-[10px] tracking-widest text-zinc-400">LVL</span>
        </div>
      </div>
      <div>
        <p className="font-display text-xl font-bold text-white">{title}</p>
        <p className="text-sm text-zinc-400">Anant Prabhudesai · Career Operative</p>
        <dl className="mt-2 flex gap-4 text-sm">
          <div>
            <dt className="text-[11px] text-zinc-500">XP</dt>
            <dd className="font-bold text-cyan-200">{xp}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">MISSIONS</dt>
            <dd className="font-bold text-cyan-200">{missions}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">BATTLES</dt>
            <dd className="font-bold text-cyan-200">{interviews}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function Stars({ n, max = 4 }: { n: number; max?: number }) {
  return (
    <span aria-label={`Difficulty ${n} of ${max}`} className="text-xs tracking-widest">
      <span className="text-amber-300">{"★".repeat(n)}</span>
      <span className="text-zinc-700">{"★".repeat(Math.max(0, max - n))}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${statusColor(status)}`}
    >
      {(status ?? "NOT APPLIED").replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="os-panel flex flex-col items-center gap-2 p-10 text-center">
      <p className="font-display text-sm font-bold tracking-[0.2em] text-cyan-200">
        {title}
      </p>
      <p className="max-w-sm text-sm text-zinc-400">{body}</p>
      {action}
    </div>
  );
}
