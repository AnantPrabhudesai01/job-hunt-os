"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Radar,
  Swords,
  Search,
  ListChecks,
  Network,
  Skull,
  FlaskConical,
  Building2,
  Users,
  Mail,
  MessageCircle,
  Send,
  Sunrise,
  HardDrive,
  Inbox,
  Megaphone,
  Table,
  Map as MapIcon,  Newspaper,
  BellRing,
  CalendarClock,
  PhoneCall,
  Trophy,
  BarChart3,
  Zap,
  Settings,
  FolderOpen,
  Flame,
  Footprints,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Command", Icon: Radar, color: "text-sky-300", glow: "shadow-[inset_2px_0_0_#38bdf8]" },
  { href: "/today", label: "Today", Icon: Sunrise, color: "text-amber-200", glow: "shadow-[inset_2px_0_0_#fcd34d]" },
  { href: "/missions", label: "Missions", Icon: Swords, color: "text-cyan-300", glow: "shadow-[inset_2px_0_0_#22d3ee]" },
  { href: "/deadlines", label: "Deadlines", Icon: CalendarClock, color: "text-red-200", glow: "shadow-[inset_2px_0_0_#fca5a5]" },
  { href: "/walkins", label: "Walk-ins", Icon: Footprints, color: "text-yellow-200", glow: "shadow-[inset_2px_0_0_#fde047]" },
  { href: "/reminders", label: "Reminders", Icon: BellRing, color: "text-orange-200", glow: "shadow-[inset_2px_0_0_#fdba74]" },
  { href: "/contacts", label: "Network", Icon: Users, color: "text-pink-300", glow: "shadow-[inset_2px_0_0_#f472b6]" },
  { href: "/directory", label: "Directory", Icon: Building2, color: "text-orange-200", glow: "shadow-[inset_2px_0_0_#fdba74]" },
  { href: "/mailshots", label: "Mailshots", Icon: Mail, color: "text-violet-200", glow: "shadow-[inset_2px_0_0_#a78bfa]" },
  { href: "/calls", label: "Calls", Icon: PhoneCall, color: "text-emerald-300", glow: "shadow-[inset_2px_0_0_#6ee7b7]" },
  { href: "/mails", label: "Mails", Icon: Mail, color: "text-teal-200", glow: "shadow-[inset_2px_0_0_#5eead4]" },
  { href: "/groups", label: "Groups", Icon: MessageCircle, color: "text-lime-200", glow: "shadow-[inset_2px_0_0_#bef264]" },
  { href: "/outreach", label: "Outreach", Icon: Send, color: "text-orange-200", glow: "shadow-[inset_2px_0_0_#fdba74]" },
  { href: "/intake", label: "Intake", Icon: Inbox, color: "text-cyan-200", glow: "shadow-[inset_2px_0_0_#22d3ee]" },
  { href: "/posts", label: "My Posts", Icon: Megaphone, color: "text-fuchsia-200", glow: "shadow-[inset_2px_0_0_#e879f9]" },
  { href: "/sources", label: "Sources", Icon: Table, color: "text-slate-200", glow: "shadow-[inset_2px_0_0_#cbd5e1]" },
  { href: "/storage", label: "Storage", Icon: HardDrive, color: "text-zinc-200", glow: "shadow-[inset_2px_0_0_#52525b]" },
  { href: "/quests", label: "Quests", Icon: ListChecks, color: "text-orange-300", glow: "shadow-[inset_2px_0_0_#fb923c]" },
  { href: "/sprint", label: "Sprint", Icon: Zap, color: "text-yellow-200", glow: "shadow-[inset_2px_0_0_#facc15]" },
  { href: "/map", label: "Map", Icon: MapIcon, color: "text-teal-200", glow: "shadow-[inset_2px_0_0_#5eead4]" },
  { href: "/search", label: "Search", Icon: Search, color: "text-sky-200", glow: "shadow-[inset_2px_0_0_#7dd3fc]" },
  { href: "/skills", label: "Skills", Icon: Network, color: "text-violet-300", glow: "shadow-[inset_2px_0_0_#8b5cf6]" },
  { href: "/interviews", label: "Boss Room", Icon: Skull, color: "text-red-300", glow: "shadow-[inset_2px_0_0_#f87171]" },
  { href: "/resumes", label: "Loadout", Icon: FlaskConical, color: "text-blue-300", glow: "shadow-[inset_2px_0_0_#60a5fa]" },
  { href: "/library", label: "Vault", Icon: FolderOpen, color: "text-cyan-200", glow: "shadow-[inset_2px_0_0_#22d3ee]" },
  { href: "/companies", label: "Targets", Icon: Building2, color: "text-amber-200", glow: "shadow-[inset_2px_0_0_#fbbf24]" },
  { href: "/achievements", label: "Trophies", Icon: Trophy, color: "text-yellow-200", glow: "shadow-[inset_2px_0_0_#fde047]" },
  { href: "/analytics", label: "Intel", Icon: BarChart3, color: "text-emerald-300", glow: "shadow-[inset_2px_0_0_#34d399]" },
  { href: "/digest", label: "Digest", Icon: Newspaper, color: "text-zinc-200", glow: "shadow-[inset_2px_0_0_#e4e4e7]" },
  { href: "/settings", label: "Systems", Icon: Settings, color: "text-teal-200", glow: "shadow-[inset_2px_0_0_#2dd4bf]" },
];

export function SideNav({
  level,
  title,
  xp,
  pct,
  streak,
}: {
  level: number;
  title: string;
  xp: number;
  pct: number;
  streak: number;
}) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // Tapping any destination closes the mobile drawer.
  useEffect(() => {
    setOpen(false);
  }, [path]);
  const animate = mounted && !reduce;
  const activeLabel =
    [...NAV]
      .sort((a, b) => b.href.length - a.href.length)
      .find(({ href }) =>
        href === "/" ? path === "/" : path.startsWith(href),
      )?.label ?? "Command";
  return (
    <>
      {/* MOBILE: left toggle bar (sticky under the HUD) */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-violet-400/15 bg-[#0a0f22]/95 px-3 py-2 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/25 bg-white/5 text-zinc-100 active:bg-white/10"
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="text-sm font-semibold text-zinc-100">{activeLabel}</span>
      </div>
      {/* MOBILE: backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/60 md:hidden"
        />
      )}
      {/* MOBILE: left slide-in drawer */}
      <aside
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-violet-400/20 bg-[#0a0f22] motion-safe:transition-transform motion-safe:duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-violet-400/15 px-3 py-2.5">
          <span className="text-xs font-bold tracking-widest text-violet-200">
            NAVIGATE
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/25 bg-white/5 text-zinc-100 active:bg-white/10"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RailBody
            path={path}
            level={level}
            title={title}
            xp={xp}
            pct={pct}
            streak={streak}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </aside>
      {/* DESKTOP: static left rail (unchanged) */}
      {animate ? (
        <motion.aside
          initial={{ x: -28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          aria-label="Primary"
          className="hidden md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-violet-400/15"
        >
          <RailBody
            path={path}
            level={level}
            title={title}
            xp={xp}
            pct={pct}
            streak={streak}
          />
        </motion.aside>
      ) : (
        <aside
          aria-label="Primary"
          className="hidden md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-violet-400/15"
        >
          <RailBody
            path={path}
            level={level}
            title={title}
            xp={xp}
            pct={pct}
            streak={streak}
          />
        </aside>
      )}
    </>
  );
}

function RailBody({
  path,
  level,
  title,
  xp,
  pct,
  streak,
  onNavigate,
}: {
  path: string;
  level: number;
  title: string;
  xp: number;
  pct: number;
  streak: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* OPERATIVE CARD */}
      <div className="mx-3 mt-3 rounded-xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-[#121a30] to-cyan-500/10 p-3 md:block">
        <div className="flex items-center gap-2.5">
          <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-[0_0_18px_rgba(139,92,246,0.5)]">
            A
          </span>
          <span>
            <span className="block text-sm font-bold text-white">ANANT PRABHUDESAI</span>
            <span className="block text-[11px] text-violet-200">
              LVL {level} · {title}
            </span>
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="grad-xp h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold text-violet-200">{xp} XP</span>
          <span className="flex items-center gap-1 font-bold text-orange-200">
            <Flame size={12} className="text-orange-400" aria-hidden />
            {streak} DAY STREAK
          </span>
        </div>
      </div>
      {/* NAV */}
      <nav className="flex-1 overflow-x-auto md:min-h-0 md:overflow-y-auto md:overflow-x-hidden">
        <ul className="flex flex-col gap-1 p-3">
          {NAV.map(({ href, label, Icon, color, glow }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all md:w-full ${
                    active
                      ? `bg-gradient-to-r from-white/[0.09] to-transparent font-semibold text-white ${glow}`
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={2}
                    aria-hidden
                    className={active ? color : "text-zinc-500"}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="p-3 text-[10px] tracking-widest text-zinc-600">
        CAREER OS · ONLINE
      </p>
    </>
  );
}
