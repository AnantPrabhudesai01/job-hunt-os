"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle } from "@/components/ui";
import { checkAchievements, CelebrationHost, type Unlocked } from "@/components/celebration";
import { DSA_CURRICULUM } from "@/lib/dsa-problems";

export type SolveRow = {
  title: string | null;
  topic: string;
  difficulty: string;
  verdict: string | null;
  solved_at: string;
};

// Real tracker: curriculum picker + verdict log + revision queue (anything
// ATTEMPTED/REVISIT with no later SOLVED for the same title).
export function DsaLogger({ total, recent }: { total: number; recent: SolveRow[] }) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");
  const [diff, setDiff] = useState("Easy");
  const [verdict, setVerdict] = useState("SOLVED");
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Unlocked[]>([]);
  const F = "rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";

  const revision = useMemo(() => {
    const solved = new Set(
      recent.filter((r) => (r.verdict ?? "SOLVED") === "SOLVED").map((r) => (r.title ?? r.topic).toLowerCase()),
    );
    const seen = new Set<string>();
    return recent.filter((r) => {
      const key = (r.title ?? r.topic).toLowerCase();
      if ((r.verdict ?? "SOLVED") === "SOLVED" || solved.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recent]);

  async function log(title: string, topic: string, difficulty: string, v: string, pattern?: string) {
    setBusy(true);
    const res = await fetch("/api/dsa/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, topic, difficulty, verdict: v, pattern }),
    });
    setBusy(false);
    if (!res.ok) return;
    setCustom("");
    setQueue(await checkAchievements());
    router.refresh();
  }

  const chosen = DSA_CURRICULUM.find((p) => p.title === pick);

  return (
    <section className="os-panel border-violet-400/25 p-4">
      <SectionTitle kicker="TRAINING" title={`DSA tracker · ${total} logged`} />
      <div className="flex flex-wrap gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Curriculum problem" className={`${F} min-w-52 flex-1`}>
          <option value="">Pick from curriculum…</option>
          {DSA_CURRICULUM.map((p) => (
            <option key={p.title} value={p.title}>
              {p.title} · {p.topic} · {p.difficulty}
            </option>
          ))}
        </select>
        <select value={verdict} onChange={(e) => setVerdict(e.target.value)} aria-label="Verdict" className={F}>
          <option>SOLVED</option>
          <option>ATTEMPTED</option>
          <option>REVISIT</option>
        </select>
        <button
          onClick={() => chosen && void log(chosen.title, chosen.topic, chosen.difficulty, verdict, chosen.pattern)}
          disabled={busy || !chosen}
          className="btn btn-elite text-xs disabled:opacity-40"
        >
          {busy ? "Logging…" : "LOG"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or custom problem title…"
          aria-label="Custom problem"
          className={`${F} min-w-40 flex-1`}
        />
        <select value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty" className={F}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <button
          onClick={() => custom.trim() && void log(custom.trim(), "Custom", diff, verdict)}
          disabled={busy || !custom.trim()}
          className="rounded-md border os-hud-line px-2.5 py-1.5 text-xs disabled:opacity-40"
        >
          Log custom
        </button>
      </div>
      {revision.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold tracking-widest text-amber-200">
            REVISION QUEUE ({revision.length})
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {revision.map((r, i) => (
              <li key={i} className="rounded border border-amber-300/40 bg-amber-300/5 px-2 py-1 text-zinc-200">
                {r.title ?? r.topic} · {r.verdict}
                <button
                  onClick={() => void log(r.title ?? r.topic, r.topic, r.difficulty, "SOLVED")}
                  disabled={busy}
                  className="ml-2 font-bold text-emerald-300 hover:text-emerald-100"
                >
                  Mark solved
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recent.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs text-zinc-400">
          {recent.slice(0, 8).map((r, i) => (
            <li key={i} className="rounded border os-hud-line px-2 py-0.5">
              {r.title ?? r.topic} · {r.difficulty} · {r.verdict ?? "SOLVED"}
            </li>
          ))}
        </ul>
      )}
      <CelebrationHost queue={queue} onDone={() => { setQueue([]); router.refresh(); }} />
    </section>
  );
}
