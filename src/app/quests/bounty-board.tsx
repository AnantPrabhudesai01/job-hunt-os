"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Trophy, Medal } from "lucide-react";
import type { BountyKey } from "@/lib/gamification";

export type BountyState = {
  key: BountyKey;
  title: string;
  desc: string;
  xp: number;
  met: boolean;
  claimed: boolean;
};

export function BountyBoard({
  season,
  mult,
  streak,
  bounties,
  records,
}: {
  season: string;
  mult: number;
  streak: number;
  bounties: BountyState[];
  records: { bestDay: string | null; bestDayXp: number; bountiesClaimed: number; fullClears: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<BountyKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function claim(key: BountyKey) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch("/api/bounties/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg(`+${j.xp} XP — ${j.title}${j.streak > 0 ? ` (combo x${j.mult})` : ""}`);
        router.refresh();
      } else {
        setMsg(j.message ?? "Not earned yet.");
      }
    } catch {
      setMsg("Claim failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  const cleared = bounties.filter((b) => b.claimed).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="os-panel flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
        <span className="font-display font-bold text-white">{season}</span>
        <span className="inline-flex items-center gap-1 text-xs text-orange-200">
          <Flame size={13} aria-hidden className="text-orange-400" />
          Combo x{mult}{streak > 0 ? ` · ${streak}-day full-clear` : " · clear all 3 to ignite"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <Trophy size={13} aria-hidden className="text-yellow-200" />
          {cleared}/3 today
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <Medal size={13} aria-hidden className="text-cyan-200" />
          Best day {records.bestDayXp} XP{records.bestDay ? ` (${records.bestDay})` : ""} · {records.bountiesClaimed} bounties · {records.fullClears} full clears
        </span>
      </div>
      {msg && (
        <p className="text-sm text-cyan-200" role="status" aria-live="polite">
          {msg}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {bounties.map((b) => (
          <li key={b.key} className="os-panel flex items-center gap-3 p-3">
            <span className="flex-1 text-sm">
              <span className="font-semibold text-white">{b.title}</span>
              <span className="block text-xs text-zinc-400">{b.desc}</span>
            </span>
            <span className="rounded-full border border-yellow-300/40 bg-yellow-300/10 px-2 py-0.5 text-xs font-bold text-yellow-200">
              +{Math.round(b.xp * mult)} XP
            </span>
            {b.claimed ? (
              <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                CLAIMED
              </span>
            ) : (
              <button
                onClick={() => void claim(b.key)}
                disabled={!b.met || busy === b.key}
                title={b.met ? "Claim bounty" : "Complete the action first"}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  b.met
                    ? "bg-sky-600 hover:bg-sky-500"
                    : "cursor-not-allowed border os-hud-line text-zinc-500"
                }`}
              >
                {busy === b.key ? "…" : b.met ? "Claim" : "Locked"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
