"use client";

import { useState } from "react";
import { ChevronDown, ScrollText } from "lucide-react";

// How the game works. Read-only explainer — rules live in lib/gamification.ts
// (bounties/combo/seasons/rarity) and lib/game.ts + lib/achievements-data.ts
// (XP/levels/trophies). Positive-only: nothing here can ever subtract XP.
const RULES: { title: string; desc: string }[] = [
  {
    title: "XP & Levels",
    desc: "Every real action earns XP: tailoring resumes, drafting outreach, interview prep, follow-ups, applications (manual MARK AS APPLIED only). XP totals set your level — Recruit → Career Breakthrough across 10 ranks. All XP comes from database rows, never demo numbers.",
  },
  {
    title: "Daily Bounties",
    desc: "Three bounties regenerate every day: First Move (+15, any hunt action), Fresh Intel (+20, new missions), Battle Ready (+25, preps or APPLIEDs). Each is verified against today's real rows before it unlocks — Locked means the action isn't done yet. One claim per bounty per day.",
  },
  {
    title: "Combo Meter",
    desc: "Clear all 3 bounties in a day to build combo: each consecutive full-clear day adds +25% bonus XP, up to ×2. Missing a day simply pauses the combo — nothing is ever taken away.",
  },
  {
    title: "Seasons",
    desc: "Every calendar month is a themed campaign (this month's banner shows above). Seasons are fresh starts for momentum — your XP, levels and trophies always carry over.",
  },
  {
    title: "Loadout Rarity",
    desc: "Resumes wear match-depth badges: EPIC for role-tailored loadouts, RARE for general templates. A labeled estimate from the filename pattern — not a quality judgment.",
  },
  {
    title: "Boss Battles",
    desc: "Missions reaching interview stages become live bosses. Power bars charge from real rows: +50 for a prep pack, +50 for a tailored resume. BATTLE READY means fully armed.",
  },
  {
    title: "Trophies & Celebrations",
    desc: "Long-term achievements (applications, streaks, DSA, offers) award once and pop a celebration the moment they're earned. Bounty claims celebrate the same way.",
  },
  {
    title: "Records",
    desc: "Best XP day, total bounties claimed, and full-clear days — you versus past-you. No public leaderboards, no fake scores.",
  },
  {
    title: "Penalties — the teeth",
    desc: "Every unapplied mission carries a clock from intake: −5 XP at 24 hours, another −10 at 72 hours (max −15 per mission, one-time each). A day closing below the 100 target costs −50. Only your manual MARK AS APPLIED flip stops a mission's clock — shares, drafts and sends never do. Settled automatically when this board loads, never twice for the same fee.",
  },
];

export function RulesSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="os-panel p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ScrollText size={15} className="text-violet-300" aria-hidden />
        <span className="flex-1 text-sm font-semibold text-white">How the game works</span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-2.5 border-t border-white/5 pt-3">
          {RULES.map((r) => (
            <li key={r.title} className="text-sm">
              <p className="font-semibold text-zinc-100">{r.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{r.desc}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
