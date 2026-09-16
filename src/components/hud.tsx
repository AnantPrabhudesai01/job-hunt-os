import Link from "next/link";
import { Flame } from "lucide-react";
import { levelFor } from "@/lib/game";
import { XPBar } from "./ui";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import type { Notice } from "@/lib/data";

// Pure presentational: data comes from the layout's single getStats() call,
// so navigating pages costs zero extra database round-trips here.
export function GameHUD({ totalXp, active, notices }: { totalXp: number; active: number; notices: Notice[] }) {
  const { cur, next } = levelFor(totalXp);
  const span = next ? next.minXp - cur.minXp : 1;
  const pct = next
    ? Math.min(100, Math.round(((totalXp - cur.minXp) / span) * 100))
    : 100;

  return (
    <div className="border-b border-violet-400/20 bg-[#0a0f22]/90 shadow-[0_2px_24px_rgba(139,92,246,0.12)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-display bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-sm font-bold tracking-widest text-transparent">
            JOB HUNT OS
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-display font-bold text-violet-200">
            LVL {cur.n}
          </span>
          <span className="text-xs text-zinc-400">{cur.title}</span>
        </div>
        <div className="min-w-40 flex-1">
          <XPBar pct={pct} />
        </div>
        <GlobalSearch />
        <NotificationBell notices={notices} />
        <span className="text-xs font-bold text-violet-200">{totalXp} XP</span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-200">
          <Flame size={13} className="text-orange-400" aria-hidden />
          STREAK
        </span>
        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-bold text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.2)]">
          {active} ACTIVE MISSIONS
        </span>
      </div>
    </div>
  );
}
