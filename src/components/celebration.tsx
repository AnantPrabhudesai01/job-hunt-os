"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { Rarity } from "@/lib/achievements-data";

export type Unlocked = { id: string; title: string; xp: number; rarity: Rarity };

export async function checkAchievements(): Promise<Unlocked[]> {
  try {
    const r = await fetch("/api/achievements/check", { method: "POST" });
    const j = await r.json();
    return j.unlocked ?? [];
  } catch {
    return [];
  }
}

const RARITY_FX: Record<Rarity, string> = {
  COMMON: "border-zinc-500/60",
  UNCOMMON: "border-emerald-400/60 shadow-[0_0_40px_rgba(52,211,153,0.25)]",
  RARE: "border-sky-400/60 shadow-[0_0_44px_rgba(56,189,248,0.3)]",
  EPIC: "border-violet-400/70 shadow-[0_0_52px_rgba(139,92,246,0.4)]",
  LEGENDARY: "border-yellow-300/70 shadow-[0_0_60px_rgba(253,224,71,0.45)]",
};

export function CelebrationHost({
  queue,
  onDone,
}: {
  queue: Unlocked[];
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [leveled, setLeveled] = useState<string | null>(null);
  useEffect(() => {
    setI(0);
    setLeveled(null);
  }, [queue]);
  if (queue.length === 0) return null;
  const multi = queue.length > 1;
  const cur = queue[Math.min(i, queue.length - 1)];

  async function dismiss() {
    const seen = queue.map((q) => q.id);
    await fetch("/api/achievements/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: seen }),
    }).catch(() => {});
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Achievement unlocked">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={dismiss} />
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`os-panel relative w-full max-w-sm border-2 p-6 text-center ${RARITY_FX[cur.rarity]}`}
      >
        <p className="font-display text-[11px] font-bold tracking-[0.25em] text-amber-200">
          {multi ? `${queue.length} ACHIEVEMENTS UNLOCKED` : "ACHIEVEMENT UNLOCKED"}
        </p>
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/30 to-yellow-100/10"
        >
          <Trophy size={30} className="text-yellow-200" aria-hidden />
        </motion.div>
        {multi ? (
          <ul className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
            {queue.map((q) => (
              <li key={q.id} className="font-semibold text-white">
                🏆 {q.title} <span className="text-amber-200">+{q.xp} XP</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="font-display mt-3 text-xl font-bold text-white">{cur.title}</p>
            <p className="mt-1 font-display text-lg font-bold text-amber-200">+{cur.xp} XP</p>
            <p className="mt-1 text-[11px] tracking-widest text-zinc-400">{cur.rarity}</p>
          </>
        )}
        {multi && (
          <p className="mt-2 font-display text-lg font-bold text-amber-200">
            TOTAL +{queue.reduce((s, q) => s + q.xp, 0)} XP
          </p>
        )}
        {leveled && <p className="mt-2 text-sm font-bold text-violet-200">{leveled}</p>}
        <div className="mt-4 flex justify-center gap-2">
          {multi && i < queue.length - 1 && (
            <button
              onClick={() => {
                const n = queue[i + 1];
                setI(i + 1);
                if (n.rarity === "LEGENDARY" || n.rarity === "EPIC")
                  setLeveled(`Next: ${n.title} (+${n.xp} XP)`);
              }}
              className="btn btn-ghost text-xs"
            >
              NEXT →
            </button>
          )}
          <button onClick={dismiss} autoFocus className="btn btn-gold text-xs font-bold">
            CONTINUE
          </button>
        </div>
      </motion.div>
    </div>
  );
}
